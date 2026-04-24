"""Nearby POI (points of interest) proxy for the Korea Tourism API.

Fetches nearby attractions along a trail's full route using the
KorService2 `locationBasedList2` endpoint and caches results for 24 hours.

Uses adaptive sampling based on trail length:
  - Short trails (<5km):   3 sample points, 500m radius
  - Medium trails (5-15km): 5 sample points, 1km radius
  - Long trails (>15km):   7 sample points, 1.5km radius

Enforces minimum 500m spacing between sample points so short or
looping trails don't query the same area repeatedly.

After collection, POIs are distributed across 3 route segments
(start / middle / end) with a cap of 7 per segment, preventing
all results from clustering in one area.
"""

import logging
import os
import time
from math import asin, cos, radians, sin, sqrt

import requests
from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Trail

logger = logging.getLogger(__name__)

# Maps contenttypeid to human-readable Korean category names.
CONTENT_TYPE_MAP = {
    "12": "관광지",
    "14": "문화시설",
    "15": "축제/행사",
    "25": "여행코스",
    "28": "레포츠",
    "32": "숙박",
    "38": "쇼핑",
    "39": "음식점",
}

# Content types to include (skip 쇼핑(38), 레포츠(28))
ALLOWED_CONTENT_TYPES = {"12", "14", "32", "39"}

# Sort priority: 음식점 first, then 관광지, then 숙박, then 문화시설
SORT_PRIORITY = {"39": 0, "12": 1, "32": 2, "14": 3}

CACHE_TTL = 60 * 60 * 24  # 24 hours
MAX_POIS = 20
MAX_POIS_PER_SEGMENT = 7
RATE_LIMIT_DELAY = 0.3  # seconds between API calls
MIN_SAMPLE_SPACING_M = 500.0  # minimum meters between sample points


def _haversine_m(lat1, lng1, lat2, lng2) -> float:
    """Return distance in meters between two (lat, lng) points."""
    r = 6371000.0
    phi1 = radians(float(lat1))
    phi2 = radians(float(lat2))
    d_phi = radians(float(lat2) - float(lat1))
    d_lam = radians(float(lng2) - float(lng1))
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lam / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _get_trail_params(distance_km):
    """Return (num_sample_points, search_radius_m) based on trail length."""
    dist = float(distance_km) if distance_km else 0
    if dist < 5:
        return 3, 500
    elif dist <= 15:
        return 5, 1000
    else:
        return 7, 1500


def _sample_route_points(trail):
    """Return sampled (lat, lng) points along the trail route.

    The number of points is adaptive based on trail distance_km.
    Points closer than 500m to an already-selected point are skipped
    to avoid redundant API queries on short or looping trails.

    Falls back to the trail's start_lat/start_lng if no path data.
    """
    num_points, _ = _get_trail_params(trail.distance_km)

    coords = None
    path_data = trail.path_data

    if isinstance(path_data, dict):
        coords = path_data.get("coordinates")

    if not coords or not isinstance(coords, list) or len(coords) < 2:
        # Fallback: start point only
        return [(float(trail.start_lat), float(trail.start_lng))]

    n = len(coords)

    # Build evenly-spaced candidate indices
    if num_points >= n:
        candidate_indices = list(range(n))
    else:
        candidate_indices = [
            round(i * (n - 1) / (num_points - 1)) for i in range(num_points)
        ]

    # Deduplicate indices
    seen_idx = set()
    unique_indices = []
    for idx in candidate_indices:
        if idx not in seen_idx:
            seen_idx.add(idx)
            unique_indices.append(idx)

    # Parse coordinates and enforce minimum spacing
    points = []
    for idx in unique_indices:
        coord = coords[idx]
        # GeoJSON coordinates are [lng, lat] (or [lng, lat, elev])
        if not isinstance(coord, (list, tuple)) or len(coord) < 2:
            continue
        lng, lat = float(coord[0]), float(coord[1])

        # Skip if too close to any already-accepted point
        too_close = False
        for plat, plng in points:
            if _haversine_m(lat, lng, plat, plng) < MIN_SAMPLE_SPACING_M:
                too_close = True
                break
        if too_close:
            continue

        points.append((lat, lng))

    return points if points else [(float(trail.start_lat), float(trail.start_lng))]


def _assign_segment(poi_lat, poi_lng, route_coords):
    """Determine which route segment (0=start, 1=middle, 2=end) a POI belongs to.

    Finds the closest coordinate on the route and maps its position
    (as a fraction of the total route length) to one of 3 segments.
    """
    n = len(route_coords)
    best_idx = 0
    best_dist = float("inf")

    # Check a subset of route coords for performance (every ~5th point,
    # but always first and last)
    step = max(1, n // 60)
    check_indices = list(range(0, n, step))
    if (n - 1) not in check_indices:
        check_indices.append(n - 1)

    for idx in check_indices:
        coord = route_coords[idx]
        if not isinstance(coord, (list, tuple)) or len(coord) < 2:
            continue
        clng, clat = float(coord[0]), float(coord[1])
        d = _haversine_m(poi_lat, poi_lng, clat, clng)
        if d < best_dist:
            best_dist = d
            best_idx = idx

    fraction = best_idx / max(n - 1, 1)
    if fraction < 1.0 / 3:
        return 0  # start segment
    elif fraction < 2.0 / 3:
        return 1  # middle segment
    else:
        return 2  # end segment


def _fetch_pois_for_point(api_key, lat, lng, radius=1000, num_rows=10):
    """Fetch nearby POIs from KorService2 for a single point."""
    params = {
        "serviceKey": api_key,
        "numOfRows": num_rows,
        "pageNo": 1,
        "MobileOS": "ETC",
        "MobileApp": "Moru",
        "_type": "json",
        "mapX": lng,
        "mapY": lat,
        "radius": radius,
    }

    try:
        resp = requests.get(
            "https://apis.data.go.kr/B551011/KorService2/locationBasedList2",
            params=params,
            timeout=10,
            verify=False,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("Failed to fetch nearby POIs for point (%s, %s)", lat, lng)
        return []

    try:
        items = (
            data.get("response", {})
            .get("body", {})
            .get("items", {})
            .get("item", [])
        )
        # API returns a single dict (not list) when there's exactly 1 result
        if isinstance(items, dict):
            items = [items]
    except (AttributeError, TypeError):
        items = []

    return items


class TrailNearbyPOIView(APIView):
    """GET /api/v1/trails/{id}/nearby/

    Returns nearby points of interest along the trail's full route,
    fetched from the Korea Tourism API (KorService2).

    Uses adaptive sampling and radius based on trail length.
    POIs are spatially distributed across 3 route segments,
    filtered, deduplicated, sorted, and cached per trail for 24 hours.
    No authentication required.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        # Look up the trail
        try:
            trail = Trail.objects.get(pk=pk)
        except Trail.DoesNotExist:
            return Response(
                {"detail": "코스를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check cache — key includes distance so cache refreshes if trail changes
        distance_km = float(trail.distance_km) if trail.distance_km else 0
        cache_key = f"trail_nearby_poi_{pk}_{distance_km}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        # Build the API request
        api_key = os.environ.get("VISITKOREA_API_KEY")
        if not api_key:
            logger.warning("VISITKOREA_API_KEY not set; returning empty nearby POIs.")
            return Response([])

        # Adaptive parameters
        _, search_radius = _get_trail_params(trail.distance_km)

        # Sample points along the full route
        sample_points = _sample_route_points(trail)

        # Fetch POIs for each sample point, with rate limiting
        all_items = []
        seen_content_ids = set()

        for i, (lat, lng) in enumerate(sample_points):
            if i > 0:
                time.sleep(RATE_LIMIT_DELAY)

            items = _fetch_pois_for_point(
                api_key, lat, lng, radius=search_radius, num_rows=10,
            )
            all_items.extend(items)

        # Deduplicate by contentid and filter to allowed categories
        pois = []
        for item in all_items:
            content_id = str(item.get("contentid", ""))
            content_type_id = str(item.get("contenttypeid", ""))

            # Skip if already seen (dedup)
            if content_id in seen_content_ids:
                continue
            seen_content_ids.add(content_id)

            # Filter: only allow 음식점(39), 관광지(12), 숙박(32), 문화시설(14)
            if content_type_id not in ALLOWED_CONTENT_TYPES:
                continue

            category = CONTENT_TYPE_MAP.get(content_type_id, "기타")

            poi = {
                "name": item.get("title", ""),
                "category": category,
                "content_type_id": content_type_id,
                "content_id": content_id,
                "lat": float(item.get("mapy", 0)),
                "lng": float(item.get("mapx", 0)),
                "image": item.get("firstimage") or item.get("firstimage2") or "",
                "address": item.get("addr1", ""),
                "tel": item.get("tel", ""),
            }
            pois.append(poi)

        # --- Spatial diversity: distribute across 3 route segments ---
        route_coords = None
        path_data = trail.path_data
        if isinstance(path_data, dict):
            route_coords = path_data.get("coordinates")

        if route_coords and isinstance(route_coords, list) and len(route_coords) >= 2:
            # Assign each POI to a segment
            for poi in pois:
                poi["_segment"] = _assign_segment(
                    poi["lat"], poi["lng"], route_coords,
                )

            # Sort within each segment by category priority
            pois.sort(
                key=lambda p: (
                    p["_segment"],
                    SORT_PRIORITY.get(p["content_type_id"], 99),
                ),
            )

            # Take up to MAX_POIS_PER_SEGMENT from each segment
            segments = {0: [], 1: [], 2: []}
            for poi in pois:
                seg = poi["_segment"]
                if len(segments[seg]) < MAX_POIS_PER_SEGMENT:
                    segments[seg].append(poi)

            # Interleave: start, middle, end ordering
            pois = segments[0] + segments[1] + segments[2]

            # Remove internal _segment key before returning
            for poi in pois:
                poi.pop("_segment", None)
        else:
            # No route data — fall back to simple priority sort
            pois.sort(
                key=lambda p: SORT_PRIORITY.get(p["content_type_id"], 99),
            )

        # Limit to max 20 POIs
        pois = pois[:MAX_POIS]

        # Cache the results
        cache.set(cache_key, pois, CACHE_TTL)

        return Response(pois)
