"""Heuristic trail-completion detection.

Given an ActivityTrack (a user's recorded walk), find trails whose
path is substantially covered by the walk. This gets called from the
activity create hook, so it must be cheap:

- bail immediately if the activity is shorter than 0.5 km
- shortlist trails by bounding-box overlap, limited to ~30 candidates
- for each candidate, sample points along the trail path and count
  how many have a nearby GPS fix in the walk (within MATCH_RADIUS_M)
- if coverage >= COMPLETION_THRESHOLD, record a TrailCompletion

The algorithm intentionally does NOT require the user to follow the
trail in order or start at the same place — a lot of users walk a
Trail backwards or join mid-way, and we'd rather reward them than
demand exact compliance. Coverage is the key signal.
"""

from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
from typing import Iterable

from .models import Trail, TrailCompletion


# Heuristics tuned to be forgiving but not wrong:
#  - MATCH_RADIUS_M: a trail sample counts as "visited" if any walk
#    fix is within this many meters. 25m handles GPS noise + minor
#    path deviations (different side of street, pedestrian cut-through).
#  - COMPLETION_THRESHOLD: 0.75 means the walker covered 75% of
#    sampled trail points. Allows for skipped intro/outro.
#  - MAX_CANDIDATES: hard cap on trails we actually score per walk.
#  - MIN_WALK_KM: skip detection for very short walks.
MATCH_RADIUS_M = 25.0
COMPLETION_THRESHOLD = 0.75
MAX_CANDIDATES = 30
MIN_WALK_KM = 0.5
# Number of samples to take along the trail path. Higher = more
# accurate coverage, but also O(n*m) so stays small.
TRAIL_SAMPLE_POINTS = 30


def _haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000.0
    phi1 = radians(float(lat1))
    phi2 = radians(float(lat2))
    d_phi = radians(float(lat2) - float(lat1))
    d_lam = radians(float(lng2) - float(lng1))
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lam / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _extract_walk_points(activity) -> list[tuple[float, float]]:
    """Return [(lat, lng), ...] from activity.track_points, tolerant of
    legacy shapes. Returns at most 300 points via uniform sampling."""
    tps = activity.track_points or []
    if not tps:
        return []
    pts: list[tuple[float, float]] = []
    for p in tps:
        if not isinstance(p, dict):
            continue
        lat = p.get("lat") if "lat" in p else p.get("latitude")
        lng = p.get("lng") if "lng" in p else p.get("longitude")
        try:
            if lat is None or lng is None:
                continue
            lat_f = float(lat)
            lng_f = float(lng)
            if lat_f == 0 and lng_f == 0:
                continue
            pts.append((lat_f, lng_f))
        except (TypeError, ValueError):
            continue
    if len(pts) > 300:
        step = len(pts) // 300
        pts = pts[::step][:300]
    return pts


def _sample_trail_points(trail) -> list[tuple[float, float]]:
    """Sample up to TRAIL_SAMPLE_POINTS points along trail.path_data.

    path_data is a GeoJSON LineString: {"type": "LineString",
    "coordinates": [[lng, lat], ...]}. If the LineString is missing
    or malformed, fall back to just (start_lat, start_lng) /
    (end_lat, end_lng) so we still give the walker partial credit
    for hitting the endpoints.
    """
    pd = trail.path_data or {}
    coords = pd.get("coordinates") if isinstance(pd, dict) else None
    if isinstance(coords, list) and len(coords) >= 2:
        pts: list[tuple[float, float]] = []
        for c in coords:
            if isinstance(c, (list, tuple)) and len(c) >= 2:
                try:
                    lng = float(c[0])
                    lat = float(c[1])
                    pts.append((lat, lng))
                except (TypeError, ValueError):
                    continue
        if pts:
            if len(pts) > TRAIL_SAMPLE_POINTS:
                # Uniform downsample to exactly TRAIL_SAMPLE_POINTS points,
                # always including the first and last. Earlier version used
                # `int(i * step)` which could skip the last point entirely.
                last = len(pts) - 1
                pts = [
                    pts[min(last, round(i * last / (TRAIL_SAMPLE_POINTS - 1)))]
                    for i in range(TRAIL_SAMPLE_POINTS)
                ]
            return pts
    # Fallback: start / end only
    return [
        (float(trail.start_lat), float(trail.start_lng)),
        (float(trail.end_lat), float(trail.end_lng)),
    ]


def _coverage(walk_pts: list[tuple[float, float]], trail_pts: Iterable[tuple[float, float]]) -> float:
    """Fraction of trail_pts that have ANY walk fix within MATCH_RADIUS_M."""
    if not walk_pts:
        return 0.0
    hit = 0
    total = 0
    for tp in trail_pts:
        total += 1
        # Linear scan; walk_pts is already capped at 300.
        for wp in walk_pts:
            if _haversine_m(tp[0], tp[1], wp[0], wp[1]) <= MATCH_RADIUS_M:
                hit += 1
                break
    return hit / total if total else 0.0


def _bounding_box(pts: list[tuple[float, float]]):
    lats = [p[0] for p in pts]
    lngs = [p[1] for p in pts]
    return min(lats), min(lngs), max(lats), max(lngs)


def detect_completions(activity) -> list[dict]:
    """Detect which trails the user likely completed with this walk.

    Returns a list of dicts with {trail_id, title, coverage} so the
    caller (activity create endpoint) can surface them in the response
    and the mobile UI can show a completion card. Side effect: writes
    TrailCompletion rows.
    """
    # Skip very short walks and walks with no path
    if activity.distance_km is not None:
        try:
            if Decimal(activity.distance_km) < Decimal(str(MIN_WALK_KM)):
                return []
        except (TypeError, ValueError):
            pass

    walk_pts = _extract_walk_points(activity)
    if len(walk_pts) < 10:
        return []

    min_lat, min_lng, max_lat, max_lng = _bounding_box(walk_pts)
    # Small padding so the box catches trails that start at the walk edge
    pad = 0.01
    candidates_qs = (
        Trail.objects
        .filter(
            status="approved", is_hidden=False,
            start_lat__range=(min_lat - pad, max_lat + pad),
            start_lng__range=(min_lng - pad, max_lng + pad),
        )
        .only("id", "title", "start_lat", "start_lng", "end_lat", "end_lng", "path_data")
        [:MAX_CANDIDATES]
    )

    # De-dupe: we may already have a completion for this (user, trail)
    existing_trail_ids = set(
        TrailCompletion.objects
        .filter(user=activity.user, trail__in=[c.id for c in candidates_qs])
        .values_list("trail_id", flat=True)
    )

    matched: list[dict] = []
    for trail in candidates_qs:
        if trail.id in existing_trail_ids:
            # Already completed — don't double-record, but still
            # surface to the client so the UI can say "또 완주!".
            matched.append({
                "trail_id": trail.id,
                "title": trail.title,
                "coverage": 1.0,
                "already_completed": True,
            })
            continue
        tpts = _sample_trail_points(trail)
        cov = _coverage(walk_pts, tpts)
        if cov >= COMPLETION_THRESHOLD:
            TrailCompletion.objects.create(
                user=activity.user,
                trail=trail,
                activity=activity,
                source="auto",
                coverage=Decimal(str(round(cov, 3))),
            )
            matched.append({
                "trail_id": trail.id,
                "title": trail.title,
                "coverage": round(cov, 3),
                "already_completed": False,
            })

    return matched
