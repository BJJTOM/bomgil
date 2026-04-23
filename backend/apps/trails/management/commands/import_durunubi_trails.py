"""Import walking trail data WITH GPS route coordinates from the Durunubi API.

Usage:
    python manage.py import_durunubi_trails
    python manage.py import_durunubi_trails --limit 10   # test with 10 courses
    python manage.py import_durunubi_trails --dry-run     # preview without saving

Data source: Korea Tourism Organization Durunubi (두루누비) trail API.
Each trail includes a full GPS track (LineString) for map rendering.

IMPORTANT: API key must come from the DURUNUBI_API_KEY environment variable.
Never hardcode API keys.
"""

import os
import re
import time
from decimal import Decimal

import requests
import urllib3
from django.core.management.base import BaseCommand

from apps.trails.models import Trail

# Suppress InsecureRequestWarning when verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://apis.data.go.kr/B551011/Durunubi"

# brdDiv (trail type) mapping to our TRAIL_TYPE_CHOICES
BRD_DIV_MAP = {
    "DNBW01": "coastal",   # 해파랑길 (coastal trail)
    "DNBW02": "nature",    # 코리아둘레길 (Korea perimeter trail)
    "DNBW03": "nature",    # 지리산둘레길
    "DNBW04": "nature",    # DMZ 평화의 길
    "DNBW05": "nature",    # 서해랑길
    "DNBW06": "nature",    # 남파랑길
}

# crsDifficulty / crsLevel mapping to our DIFFICULTY_CHOICES
DIFFICULTY_MAP = {
    "1": "easy",
    "2": "moderate",
    "3": "hard",
}


def _get_api_key():
    """Pull the Durunubi API key strictly from the environment.

    Refuses to run with a missing key rather than falling back to a
    hard-coded secret. Set `DURUNUBI_API_KEY` in Render -> Environment.
    """
    key = os.environ.get("DURUNUBI_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "DURUNUBI_API_KEY is not configured. "
            "Set it in the service environment (Render -> Environment) "
            "before running import_durunubi_trails."
        )
    return key


def _strip_html(text):
    """Remove HTML tags and decode common entities."""
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&quot;", '"')
    text = text.replace("&#39;", "'")
    text = text.replace("&nbsp;", " ")
    return text.strip()


def _parse_distance(raw):
    """Parse distance value to float.

    Durunubi crsDstnc is typically a numeric string like '13.2' (km).
    """
    if not raw:
        return None
    try:
        return float(str(raw).replace(",", "."))
    except (ValueError, TypeError):
        match = re.search(r"([\d]+(?:[.,]\d+)?)", str(raw))
        if match:
            return float(match.group(1).replace(",", "."))
        return None


def _parse_time_to_minutes(raw):
    """Parse crsTotlRqrmHour to total minutes.

    The Durunubi API returns time as hours, e.g. '3', '4.5', '2:30',
    or free-form like '3시간 30분'.
    """
    if not raw:
        return None

    raw_str = str(raw).strip()

    # Try pure numeric — Durunubi returns minutes (e.g. 420 = 7시간)
    try:
        val = float(raw_str)
        # If value > 24, it's already in minutes (e.g. 420)
        # If value <= 24, it's in hours (e.g. 7)
        if val > 24:
            return max(1, int(round(val)))
        else:
            return max(1, int(round(val * 60)))
    except (ValueError, TypeError):
        pass

    # Try H:MM format
    colon_match = re.match(r"(\d+):(\d+)", raw_str)
    if colon_match:
        h = int(colon_match.group(1))
        m = int(colon_match.group(2))
        return max(1, h * 60 + m)

    # Try Korean format
    hours = 0
    minutes = 0
    h_match = re.search(r"(\d+)\s*시간", raw_str)
    if h_match:
        hours = int(h_match.group(1))
    m_match = re.search(r"(\d+)\s*분", raw_str)
    if m_match:
        minutes = int(m_match.group(1))
    total = hours * 60 + minutes
    return total if total > 0 else None


def _map_difficulty(crs_difficulty, crs_level, distance_km):
    """Map Durunubi difficulty/level fields to our easy/moderate/hard.

    Falls back to distance-based inference if both fields are empty.
    """
    for val in (crs_difficulty, crs_level):
        val_str = str(val).strip() if val else ""
        if val_str in DIFFICULTY_MAP:
            return DIFFICULTY_MAP[val_str]
        # Handle Korean labels
        val_lower = val_str.lower()
        if val_lower in ("쉬움", "하", "초급"):
            return "easy"
        if val_lower in ("보통", "중", "중급"):
            return "moderate"
        if val_lower in ("어려움", "상", "고급"):
            return "hard"

    # Fallback: infer from distance
    if distance_km is not None:
        if distance_km < 5:
            return "easy"
        if distance_km <= 15:
            return "moderate"
        return "hard"
    return "moderate"


def _map_trail_type(brd_div):
    """Map brdDiv code to our trail_type choices."""
    if not brd_div:
        return "nature"
    return BRD_DIV_MAP.get(str(brd_div).strip(), "nature")


def _api_get(endpoint, params, label=""):
    """Make a GET request to the Durunubi API with retry + backoff."""
    url = f"{BASE_URL}/{endpoint}"
    params["serviceKey"] = _get_api_key()
    params["MobileOS"] = "ETC"
    params["MobileApp"] = "Moru"
    params["_type"] = "json"

    backoff = [2, 5, 15]

    for attempt in range(4):
        try:
            resp = requests.get(url, params=params, verify=False, timeout=30)
            if resp.status_code == 429:
                if attempt < len(backoff):
                    time.sleep(backoff[attempt])
                    continue
                raise RuntimeError(
                    f"API rate-limited (429) after retries ({label})"
                )
            resp.raise_for_status()
            data = resp.json()
            body = data.get("response", {}).get("body", {})
            items = body.get("items", {})
            if isinstance(items, str) and items == "":
                return []
            if not items:
                return []
            item_list = items.get("item", [])
            if isinstance(item_list, dict):
                return [item_list]
            return item_list
        except (requests.RequestException, ValueError) as exc:
            if attempt < len(backoff):
                time.sleep(backoff[attempt])
                continue
            raise RuntimeError(
                f"API request failed after retries ({label}): {exc}"
            ) from exc
    return []


class Command(BaseCommand):
    help = "Import walking trail data with GPS routes from the Durunubi API"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Only import first N courses (0 = all)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be imported without saving to the database",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN -- no data will be saved"))

        # ----------------------------------------------------------
        # Step 1: Fetch the course list in batches
        # ----------------------------------------------------------
        self.stdout.write("Fetching course list from Durunubi courseList ...")

        all_courses = []
        page = 1
        per_page = 100

        while True:
            params = {
                "numOfRows": per_page,
                "pageNo": page,
            }

            items = _api_get("courseList", params, label=f"courseList page {page}")
            if not items:
                break

            all_courses.extend(items)
            self.stdout.write(
                f"  Page {page}: fetched {len(items)} items "
                f"(total so far: {len(all_courses)})"
            )

            if limit and len(all_courses) >= limit:
                all_courses = all_courses[:limit]
                break

            if len(items) < per_page:
                break

            page += 1
            time.sleep(0.3)

        self.stdout.write(f"Total courses fetched: {len(all_courses)}")

        # ----------------------------------------------------------
        # Step 2: Process each course
        # ----------------------------------------------------------
        created = 0
        updated = 0
        skipped = 0
        errors = 0
        no_gps = 0

        for idx, course in enumerate(all_courses):
            try:
                result = self._process_course(course, idx, len(all_courses), dry_run)
                if result == "created":
                    created += 1
                elif result == "updated":
                    updated += 1
                elif result == "created_no_gps":
                    created += 1
                    no_gps += 1
                elif result == "updated_no_gps":
                    updated += 1
                    no_gps += 1
                else:
                    skipped += 1
            except Exception as exc:
                errors += 1
                crs_idx = course.get("crsIdx", "?")
                title = course.get("crsKorNm", "?")
                self.stderr.write(
                    self.style.ERROR(
                        f"  Error processing [{crs_idx}] {title}: {exc}"
                    )
                )

            # Progress logging every 20 courses
            if (idx + 1) % 20 == 0:
                self.stdout.write(
                    f"  Progress: {idx + 1}/{len(all_courses)} "
                    f"(created={created}, updated={updated}, "
                    f"skipped={skipped}, errors={errors}, no_gps={no_gps})"
                )

        # ----------------------------------------------------------
        # Final summary
        # ----------------------------------------------------------
        prefix = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{prefix}Import complete: "
                f"total={len(all_courses)}, created={created}, "
                f"updated={updated}, skipped={skipped}, errors={errors}"
            )
        )
        if no_gps:
            self.stdout.write(
                self.style.WARNING(
                    f"  {no_gps} trails saved WITHOUT GPS path data"
                )
            )

    def _process_course(self, course, idx, total, dry_run):
        """Fetch route GPS points and create/update the Trail.

        Returns 'created', 'updated', or 'skipped'.
        """
        crs_idx = course.get("crsIdx", "")
        title = (course.get("crsKorNm") or "").strip()

        if not title:
            raise ValueError(f"Empty course name for crsIdx={crs_idx}")
        if not crs_idx:
            raise ValueError(f"Missing crsIdx for course: {title}")

        # ----------------------------------------------------------
        # Fetch GPS route from GPX file (no API quota needed)
        # ----------------------------------------------------------
        gpx_url = (course.get("gpxpath") or "").strip()
        coordinates = []

        if gpx_url:
            import xml.etree.ElementTree as ET
            import urllib.request
            import ssl

            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE

            try:
                time.sleep(0.3)
                req = urllib.request.Request(
                    gpx_url,
                    headers={"User-Agent": "Moru/1.0"},
                )
                with urllib.request.urlopen(req, timeout=30, context=ssl_ctx) as resp:
                    gpx_xml = resp.read().decode("utf-8")

                self.stdout.write(f"  GPX downloaded: {len(gpx_xml)} bytes for {crs_idx}")

                root = ET.fromstring(gpx_xml)
                # Try with namespace
                ns = {"g": "http://www.topografix.com/GPX/1/1"}
                for trkpt in root.findall(".//g:trkpt", ns):
                    lat = float(trkpt.get("lat", 0))
                    lng = float(trkpt.get("lon", 0))
                    if lat > 0 and lng > 0:
                        ele_el = trkpt.find("g:ele", ns)
                        ele = float(ele_el.text) if ele_el is not None and ele_el.text else 0
                        coordinates.append([lng, lat, ele])
                # Fallback: try without namespace
                if not coordinates:
                    for trkpt in root.iter():
                        if "trkpt" in trkpt.tag:
                            lat = float(trkpt.get("lat", 0))
                            lng = float(trkpt.get("lon", 0))
                            if lat > 0 and lng > 0:
                                ele = 0
                                for child in trkpt:
                                    if "ele" in child.tag and child.text:
                                        ele = float(child.text)
                                coordinates.append([lng, lat, ele])

                self.stdout.write(f"  Parsed {len(coordinates)} GPS points for {crs_idx}")
            except Exception as exc:
                self.stderr.write(
                    self.style.ERROR(f"  GPX FAILED for {crs_idx}: {type(exc).__name__}: {exc}")
                )

        # Build path_data GeoJSON (empty if no coordinates parsed)
        if coordinates:
            path_data = {
                "type": "LineString",
                "coordinates": coordinates,
            }
            start_lng, start_lat = coordinates[0][0], coordinates[0][1]
            end_lng, end_lat = coordinates[-1][0], coordinates[-1][1]

            # Calculate elevation gain from GPS elevation data
            elevation_gain = 0
            for i in range(1, len(coordinates)):
                if len(coordinates[i]) >= 3 and len(coordinates[i - 1]) >= 3:
                    diff = coordinates[i][2] - coordinates[i - 1][2]
                    if diff > 0:
                        elevation_gain += diff
            elevation_gain = round(elevation_gain) if elevation_gain > 0 else None
        else:
            self.stderr.write(
                self.style.WARNING(
                    f"  No GPS data for {crs_idx} ({title}) — "
                    f"saving trail without path_data"
                )
            )
            path_data = {}
            # Use courseList lat/lng as fallback start/end
            start_lat = float(course.get("crsKorPosY", 0) or 0)
            start_lng = float(course.get("crsKorPosX", 0) or 0)
            if start_lat == 0 or start_lng == 0:
                raise ValueError(
                    f"No GPS data AND no fallback coordinates for crsIdx={crs_idx}"
                )
            end_lat = start_lat
            end_lng = start_lng
            elevation_gain = None

        # ----------------------------------------------------------
        # Parse course metadata
        # ----------------------------------------------------------
        raw_summary = _strip_html(course.get("crsSummary", ""))
        raw_tour_info = _strip_html(course.get("crsTourInfo", ""))

        # Combine summary + tour info for description
        description_parts = []
        if raw_summary:
            description_parts.append(raw_summary)
        if raw_tour_info:
            description_parts.append(raw_tour_info)
        description = "\n\n".join(description_parts) or f"{title} 걷기 코스"
        if len(description) > 1000:
            description = description[:997] + "..."

        raw_distance = course.get("crsDstnc", "")
        distance_km = _parse_distance(raw_distance)

        raw_time = course.get("crsTotlRqrmHour", "")
        estimated_minutes = _parse_time_to_minutes(raw_time)

        # Fallback: estimate time from distance at 4 km/h
        if (not estimated_minutes) and distance_km:
            estimated_minutes = int(round(distance_km / 4.0 * 60))

        crs_difficulty = course.get("crsDifficulty", "")
        crs_level = course.get("crsLevel", "")
        difficulty = _map_difficulty(crs_difficulty, crs_level, distance_km)

        region = (course.get("sigun") or "").strip()
        brd_div = course.get("brdDiv", "")
        trail_type = _map_trail_type(brd_div)

        source_url = (
            f"https://www.durunubi.kr/course/courseDetail.do?crsIdx={crs_idx}"
        )

        if dry_run:
            self.stdout.write(
                f"  [{idx + 1}/{total}] {title} | "
                f"{region} | {distance_km}km | "
                f"{estimated_minutes}min | {difficulty} | "
                f"{len(coordinates)} GPS points"
            )
            return "skipped"

        # ----------------------------------------------------------
        # Create or update Trail
        # ----------------------------------------------------------
        defaults = {
            "title": title,
            "description": description,
            "region": region,
            "country": "KR",
            "distance_km": Decimal(str(distance_km)) if distance_km else Decimal("0"),
            "estimated_minutes": estimated_minutes or 0,
            "difficulty": difficulty,
            "start_lat": Decimal(str(start_lat)),
            "start_lng": Decimal(str(start_lng)),
            "end_lat": Decimal(str(end_lat)),
            "end_lng": Decimal(str(end_lng)),
            "path_data": path_data,
            "trail_type": trail_type,
            "elevation_gain": elevation_gain,
            "is_official": True,
            "source_url": source_url,
            "status": "approved",
        }

        trail, was_created = Trail.objects.update_or_create(
            source="durunubi",
            source_url=source_url,
            defaults=defaults,
        )

        # Diagnostic logging: verify path_data was persisted
        coord_count = len(coordinates)
        saved_path = trail.path_data or {}
        saved_coords = len(saved_path.get("coordinates", []))
        action = "CREATED" if was_created else "UPDATED"
        gps_status = "" if coord_count > 0 else " [NO GPS]"
        self.stdout.write(
            f"  [{idx + 1}/{total}] {action} trail id={trail.id} "
            f"\"{title}\" | {coord_count} GPS pts sent, "
            f"{saved_coords} in DB | "
            f"start=({trail.start_lat},{trail.start_lng}){gps_status}"
        )

        if was_created:
            return "created" if coord_count > 0 else "created_no_gps"
        return "updated" if coord_count > 0 else "updated_no_gps"
