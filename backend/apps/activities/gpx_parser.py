import math
from datetime import datetime
from decimal import Decimal


def parse_gpx(file_obj):
    """Parse GPX XML file and return (track_points, summary)."""
    import xml.etree.ElementTree as ET

    content = file_obj.read()
    if isinstance(content, bytes):
        content = content.decode("utf-8")

    root = ET.fromstring(content)
    ns = {"gpx": "http://www.topografix.com/GPX/1/1"}

    points = []

    # Try <trk><trkseg><trkpt>
    for trk in root.findall(".//gpx:trk", ns) or root.findall(".//trk"):
        for seg in trk.findall("gpx:trkseg", ns) if trk.findall("gpx:trkseg", ns) else trk.findall("trkseg"):
            for pt in seg.findall("gpx:trkpt", ns) if seg.findall("gpx:trkpt", ns) else seg.findall("trkpt"):
                lat = float(pt.get("lat"))
                lng = float(pt.get("lon"))
                ele_el = pt.find("gpx:ele", ns) or pt.find("ele")
                time_el = pt.find("gpx:time", ns) or pt.find("time")
                points.append({
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "ele": round(float(ele_el.text), 1) if ele_el is not None and ele_el.text else None,
                    "time": time_el.text if time_el is not None else None,
                })

    # Fallback: try <rte><rtept>
    if not points:
        for rte in root.findall(".//gpx:rte", ns) or root.findall(".//rte"):
            for pt in rte.findall("gpx:rtept", ns) if rte.findall("gpx:rtept", ns) else rte.findall("rtept"):
                lat = float(pt.get("lat"))
                lng = float(pt.get("lon"))
                ele_el = pt.find("gpx:ele", ns) or pt.find("ele")
                points.append({
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "ele": round(float(ele_el.text), 1) if ele_el is not None and ele_el.text else None,
                    "time": None,
                })

    summary = compute_summary(points)
    return points, summary


def _haversine(lat1, lng1, lat2, lng2):
    """Distance in km between two points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_summary(points):
    """Compute distance, elevation, speed, bounding box from track points."""
    if not points:
        return {}

    total_distance = 0.0
    elevation_gain = 0
    elevation_loss = 0
    elevations = []
    max_speed = 0.0
    speeds = []

    lats = [p["lat"] for p in points]
    lngs = [p["lng"] for p in points]

    for i in range(1, len(points)):
        prev, curr = points[i - 1], points[i]
        d = _haversine(prev["lat"], prev["lng"], curr["lat"], curr["lng"])
        total_distance += d

        if prev.get("ele") is not None and curr.get("ele") is not None:
            diff = curr["ele"] - prev["ele"]
            if diff > 0:
                elevation_gain += diff
            else:
                elevation_loss += abs(diff)
            elevations.append(curr["ele"])

        if prev.get("time") and curr.get("time"):
            try:
                t1 = datetime.fromisoformat(prev["time"].replace("Z", "+00:00"))
                t2 = datetime.fromisoformat(curr["time"].replace("Z", "+00:00"))
                dt_hours = (t2 - t1).total_seconds() / 3600
                if dt_hours > 0:
                    speed = d / dt_hours
                    speeds.append(speed)
                    max_speed = max(max_speed, speed)
            except (ValueError, TypeError):
                pass

    if points[0].get("ele") is not None:
        elevations.insert(0, points[0]["ele"])

    started_at = None
    finished_at = None
    duration_minutes = None
    if points[0].get("time") and points[-1].get("time"):
        try:
            started_at = datetime.fromisoformat(points[0]["time"].replace("Z", "+00:00"))
            finished_at = datetime.fromisoformat(points[-1]["time"].replace("Z", "+00:00"))
            duration_minutes = int((finished_at - finished_at).total_seconds() / 60) if started_at else None
            duration_minutes = int((finished_at - started_at).total_seconds() / 60)
        except (ValueError, TypeError):
            pass

    avg_speed = 0.0
    avg_pace = None
    if duration_minutes and duration_minutes > 0:
        hours = duration_minutes / 60
        if hours > 0:
            avg_speed = total_distance / hours
            if total_distance > 0:
                avg_pace = duration_minutes / total_distance

    return {
        "distance_km": Decimal(str(round(total_distance, 2))),
        "duration_minutes": duration_minutes,
        "elevation_gain_m": int(elevation_gain),
        "elevation_loss_m": int(elevation_loss),
        "max_elevation_m": Decimal(str(round(max(elevations), 1))) if elevations else None,
        "min_elevation_m": Decimal(str(round(min(elevations), 1))) if elevations else None,
        "avg_speed_kmh": Decimal(str(round(avg_speed, 1))),
        "max_speed_kmh": Decimal(str(round(max_speed, 1))) if max_speed > 0 else None,
        "avg_pace_min_km": Decimal(str(round(avg_pace, 1))) if avg_pace else None,
        "started_at": started_at,
        "finished_at": finished_at,
        "min_lat": Decimal(str(round(min(lats), 6))),
        "max_lat": Decimal(str(round(max(lats), 6))),
        "min_lng": Decimal(str(round(min(lngs), 6))),
        "max_lng": Decimal(str(round(max(lngs), 6))),
    }


def simplify_track(points, tolerance=0.0001):
    """Douglas-Peucker simplification to reduce track size."""
    if len(points) <= 2:
        return points

    def _perpendicular_distance(point, start, end):
        if start["lat"] == end["lat"] and start["lng"] == end["lng"]:
            return _haversine(point["lat"], point["lng"], start["lat"], start["lng"])
        dx = end["lng"] - start["lng"]
        dy = end["lat"] - start["lat"]
        norm = math.sqrt(dx * dx + dy * dy)
        return abs(dy * point["lng"] - dx * point["lat"] + end["lng"] * start["lat"] - end["lat"] * start["lng"]) / norm

    max_dist = 0
    max_idx = 0
    for i in range(1, len(points) - 1):
        d = _perpendicular_distance(points[i], points[0], points[-1])
        if d > max_dist:
            max_dist = d
            max_idx = i

    if max_dist > tolerance:
        left = simplify_track(points[:max_idx + 1], tolerance)
        right = simplify_track(points[max_idx:], tolerance)
        return left[:-1] + right
    else:
        return [points[0], points[-1]]
