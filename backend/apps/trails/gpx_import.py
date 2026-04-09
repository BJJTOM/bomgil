"""
GPX → Trail import.

Parses an uploaded .gpx file (GPX 1.1 or 0.x) into a draft Trail
record so users can publish a course they recorded in another app
(Strava, Garmin Connect, etc.).

We use Python's stdlib xml.etree to avoid adding gpxpy as a
dependency. The GPX format is simple enough that ~100 lines of
parsing handles every real file we'd see.
"""
import math
import re
from decimal import Decimal
from xml.etree import ElementTree as ET

from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import Trail


class GpxImportThrottle(UserRateThrottle):
    scope = "gpx_import"
    rate = "30/day"


# GPX namespace — most files use the topografix one. We strip the
# namespace prefix when matching tags so files without an explicit
# namespace declaration also work.
def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometers between two lat/lng pairs."""
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_gpx(content: bytes) -> dict:
    """Parse GPX bytes into {points, distance_km, elevation_gain, name, ...}.

    Raises ValueError on malformed input.
    """
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise ValueError(f"GPX 파일을 읽을 수 없습니다: {e}")

    # Collect every <trkpt> in document order
    points = []
    name = ""
    for elem in root.iter():
        tag = _strip_ns(elem.tag)
        if tag == "name" and not name and elem.text:
            name = elem.text.strip()
        if tag == "trkpt":
            try:
                lat = float(elem.get("lat", ""))
                lon = float(elem.get("lon", ""))
            except (TypeError, ValueError):
                continue
            ele = None
            for child in elem:
                if _strip_ns(child.tag) == "ele" and child.text:
                    try:
                        ele = float(child.text.strip())
                    except ValueError:
                        ele = None
                    break
            points.append({"lat": lat, "lng": lon, "ele": ele})

    if len(points) < 2:
        raise ValueError("GPX 파일에 트랙 포인트가 부족합니다 (최소 2개 필요).")

    # Compute total distance and elevation gain
    total_km = 0.0
    elev_gain = 0.0
    for i in range(1, len(points)):
        a, b = points[i - 1], points[i]
        total_km += _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
        if a["ele"] is not None and b["ele"] is not None:
            diff = b["ele"] - a["ele"]
            if diff > 2:  # 2m noise floor — same as walk engine
                elev_gain += diff

    return {
        "name": name or "GPX 코스",
        "points": points,
        "distance_km": round(total_km, 2),
        "elevation_gain_m": round(elev_gain),
        "start_lat": points[0]["lat"],
        "start_lng": points[0]["lng"],
        "end_lat": points[-1]["lat"],
        "end_lng": points[-1]["lng"],
    }


class GpxImportView(APIView):
    """POST /trails/import-gpx/  — multipart with `gpx` file field.

    Returns a draft Trail record. The user is expected to PATCH it with
    title, description, etc. before publishing.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]
    throttle_classes = [GpxImportThrottle]

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

    def post(self, request):
        gpx_file = request.FILES.get("gpx")
        if not gpx_file:
            return Response(
                {"error": "GPX 파일을 첨부해주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if gpx_file.size > self.MAX_FILE_SIZE:
            return Response(
                {"error": "파일이 너무 큽니다 (최대 5MB)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not gpx_file.name.lower().endswith(".gpx"):
            return Response(
                {"error": "GPX 파일만 업로드할 수 있습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            parsed = parse_gpx(gpx_file.read())
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:  # noqa: BLE001
            return Response(
                {"error": f"GPX 파싱 실패: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Title supplied by client wins, otherwise use the GPX file's <name>
        title = (request.data.get("title") or parsed["name"])[:100]
        description = request.data.get("description", "GPX 파일에서 가져온 코스입니다.")[:1000]

        # Create Trail as draft so the user can review/edit before publishing.
        # Estimated minutes = distance × 12 (5 km/h average walking pace).
        estimated_minutes = max(1, int(parsed["distance_km"] * 12))

        trail = Trail.objects.create(
            author=request.user,
            title=title,
            description=description,
            distance_km=Decimal(str(parsed["distance_km"])),
            estimated_minutes=estimated_minutes,
            difficulty="moderate",
            elevation_gain=parsed["elevation_gain_m"],
            start_lat=Decimal(str(parsed["start_lat"])),
            start_lng=Decimal(str(parsed["start_lng"])),
            end_lat=Decimal(str(parsed["end_lat"])),
            end_lng=Decimal(str(parsed["end_lng"])),
            path_data={"points": parsed["points"]},
            status="draft",
        )

        return Response(
            {
                "id": trail.id,
                "title": trail.title,
                "distance_km": float(trail.distance_km),
                "elevation_gain_m": trail.elevation_gain,
                "point_count": len(parsed["points"]),
                "status": trail.status,
                "message": "GPX를 가져왔습니다. 코스 상세에서 편집 후 등록해주세요.",
            },
            status=status.HTTP_201_CREATED,
        )
