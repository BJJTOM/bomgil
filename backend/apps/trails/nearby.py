"""Nearby POI (points of interest) proxy for the Korea Tourism API.

Fetches nearby attractions along a trail's full route using the
KorService2 `locationBasedList2` endpoint and caches results for 24 hours.

Samples 5 points along the route (start, 25%, 50%, 75%, end) to discover
POIs near the entire trail, not just the starting location.
"""

import logging
import os
import time

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
RATE_LIMIT_DELAY = 0.3  # seconds between API calls


def _sample_route_points(trail):
    """Return up to 5 (lat, lng) points sampled along the trail route.

    If path_data.coordinates is available, samples at 0%, 25%, 50%, 75%, 100%.
    Otherwise falls back to the trail's start_lat/start_lng only.
    """
    coords = None
    path_data = trail.path_data

    if isinstance(path_data, dict):
        coords = path_data.get("coordinates")

    if not coords or not isinstance(coords, list) or len(coords) < 2:
        # Fallback: start point only
        return [(float(trail.start_lat), float(trail.start_lng))]

    n = len(coords)
    # Sample indices: 0%, 25%, 50%, 75%, 100%
    indices = [
        0,
        max(0, n // 4),
        max(0, n // 2),
        max(0, (3 * n) // 4),
        n - 1,
    ]
    # Deduplicate indices (e.g. very short routes)
    seen = set()
    unique_indices = []
    for idx in indices:
        if idx not in seen:
            seen.add(idx)
            unique_indices.append(idx)

    points = []
    for idx in unique_indices:
        coord = coords[idx]
        # GeoJSON coordinates are [lng, lat] (or [lng, lat, elev])
        if isinstance(coord, (list, tuple)) and len(coord) >= 2:
            lng, lat = float(coord[0]), float(coord[1])
            points.append((lat, lng))

    return points if points else [(float(trail.start_lat), float(trail.start_lng))]


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

    Samples 5 points along the route with 1km radius each.
    Results are filtered, deduplicated, sorted, and cached per trail for 24 hours.
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

        # Check cache first
        cache_key = f"trail_nearby_poi_{pk}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        # Build the API request
        api_key = os.environ.get("VISITKOREA_API_KEY")
        if not api_key:
            logger.warning("VISITKOREA_API_KEY not set; returning empty nearby POIs.")
            return Response([])

        # Sample points along the full route
        sample_points = _sample_route_points(trail)

        # Fetch POIs for each sample point, with rate limiting
        all_items = []
        seen_content_ids = set()

        for i, (lat, lng) in enumerate(sample_points):
            if i > 0:
                time.sleep(RATE_LIMIT_DELAY)

            items = _fetch_pois_for_point(api_key, lat, lng, radius=1000, num_rows=10)
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

        # Sort by priority: 음식점 → 관광지 → 숙박 → 문화시설
        pois.sort(key=lambda p: SORT_PRIORITY.get(p["content_type_id"], 99))

        # Limit to max 20 POIs
        pois = pois[:MAX_POIS]

        # Cache the results
        cache.set(cache_key, pois, CACHE_TTL)

        return Response(pois)
