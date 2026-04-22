"""Import walking trail data from the Korea Tourism Organization public API.

Usage:
    python manage.py import_public_trails
    python manage.py import_public_trails --limit 10        # test with 10 courses
    python manage.py import_public_trails --area 39          # Jeju only
    python manage.py import_public_trails --dry-run          # preview without saving

Data source: Korea Tourism Organization (한국관광공사) KorService2 API
Content Type ID 25 = 걷기코스 (walking courses)
"""

import os
import re
import time
from decimal import Decimal, InvalidOperation

import requests
import urllib3
from django.core.management.base import BaseCommand

from apps.trails.models import Trail

# Suppress InsecureRequestWarning when verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://apis.data.go.kr/B551011/KorService2"

AREA_CODE_MAP = {
    "1": "서울",
    "2": "인천",
    "3": "대전",
    "4": "대구",
    "5": "광주",
    "6": "부산",
    "7": "울산",
    "8": "세종",
    "31": "경기",
    "32": "강원",
    "33": "충북",
    "34": "충남",
    "35": "경북",
    "36": "경남",
    "37": "전북",
    "38": "전남",
    "39": "제주",
}


def _get_api_key():
    return os.environ.get(
        "VISITKOREA_API_KEY",
        "c4ce39010fc2ee141dba784bc1fe1c4f357a7b81fca0af04e39c92d19ac1a8d0",
    )


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
    """Parse distance string like '28km', '5.2Km', '약 3km' into float.

    Returns None if unparseable.
    """
    if not raw:
        return None
    match = re.search(r"([\d]+(?:[.,]\d+)?)\s*(?:km|㎞)", raw, re.IGNORECASE)
    if match:
        return float(match.group(1).replace(",", "."))
    # Try bare number
    match = re.search(r"([\d]+(?:[.,]\d+)?)", raw)
    if match:
        return float(match.group(1).replace(",", "."))
    return None


def _parse_time(raw):
    """Parse time string into total minutes.

    Examples:
        '7시간'         -> 420
        '2시간 30분'    -> 150
        '30분'          -> 30
        '약 1시간 30분' -> 90
        '3~4시간'       -> 210 (average)
    """
    if not raw:
        return None

    # Handle range like '3~4시간' or '3-4시간'
    range_match = re.search(r"(\d+)\s*[~\-]\s*(\d+)\s*시간", raw)
    if range_match:
        low = int(range_match.group(1))
        high = int(range_match.group(2))
        return int((low + high) / 2 * 60)

    hours = 0
    minutes = 0

    h_match = re.search(r"(\d+)\s*시간", raw)
    if h_match:
        hours = int(h_match.group(1))

    m_match = re.search(r"(\d+)\s*분", raw)
    if m_match:
        minutes = int(m_match.group(1))

    total = hours * 60 + minutes
    return total if total > 0 else None


def _infer_difficulty(distance_km):
    """Infer difficulty from distance: <5km=easy, 5-15km=moderate, >15km=hard."""
    if distance_km is None:
        return "moderate"
    if distance_km < 5:
        return "easy"
    if distance_km <= 15:
        return "moderate"
    return "hard"


def _api_get(endpoint, params, label=""):
    """Make a GET request to the KorService2 API with retry logic."""
    url = f"{BASE_URL}/{endpoint}"
    params["serviceKey"] = _get_api_key()
    params["MobileOS"] = "ETC"
    params["MobileApp"] = "Moru"
    params["_type"] = "json"

    for attempt in range(3):
        try:
            resp = requests.get(url, params=params, verify=False, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            # Navigate the nested response structure
            body = data.get("response", {}).get("body", {})
            items = body.get("items", {})
            if isinstance(items, str) and items == "":
                return []
            if not items:
                return []
            item_list = items.get("item", [])
            if isinstance(item_list, dict):
                # Single item returned as dict instead of list
                return [item_list]
            return item_list
        except (requests.RequestException, ValueError) as exc:
            if attempt < 2:
                time.sleep(1)
                continue
            raise RuntimeError(
                f"API request failed after 3 attempts ({label}): {exc}"
            ) from exc
    return []


class Command(BaseCommand):
    help = "Import walking trail data from the Korea Tourism Organization public API"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Only import first N courses (0 = all)",
        )
        parser.add_argument(
            "--area",
            type=str,
            default="",
            help="Only import from specific area code (e.g. 39 for Jeju)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be imported without saving to the database",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        area_filter = options["area"]
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no data will be saved"))

        # ----------------------------------------------------------
        # Step 1: Fetch the course list in batches of 100
        # ----------------------------------------------------------
        self.stdout.write("Fetching course list from areaBasedList2 ...")

        all_courses = []
        page = 1
        per_page = 100

        while True:
            params = {
                "numOfRows": per_page,
                "pageNo": page,
                "contentTypeId": "25",
                "arrange": "P",
            }
            if area_filter:
                params["areaCode"] = area_filter

            items = _api_get("areaBasedList2", params, label=f"list page {page}")
            if not items:
                break

            all_courses.extend(items)
            self.stdout.write(f"  Page {page}: fetched {len(items)} items (total so far: {len(all_courses)})")

            if limit and len(all_courses) >= limit:
                all_courses = all_courses[:limit]
                break

            if len(items) < per_page:
                break

            page += 1
            time.sleep(0.2)

        self.stdout.write(f"Total courses fetched: {len(all_courses)}")

        # ----------------------------------------------------------
        # Step 2: Process each course
        # ----------------------------------------------------------
        created = 0
        updated = 0
        skipped = 0
        errors = 0

        for idx, course in enumerate(all_courses):
            try:
                self._process_course(course, idx, len(all_courses), dry_run)
                if not dry_run:
                    result = self._save_course(course)
                    if result == "created":
                        created += 1
                    elif result == "updated":
                        updated += 1
                    else:
                        skipped += 1
                else:
                    skipped += 1
            except Exception as exc:
                errors += 1
                content_id = course.get("contentid", "?")
                title = course.get("title", "?")
                self.stderr.write(
                    self.style.ERROR(
                        f"  Error processing [{content_id}] {title}: {exc}"
                    )
                )

            # Progress logging every 50 courses
            if (idx + 1) % 50 == 0:
                self.stdout.write(
                    f"  Progress: {idx + 1}/{len(all_courses)} "
                    f"(created={created}, updated={updated}, skipped={skipped}, errors={errors})"
                )

        # ----------------------------------------------------------
        # Final summary
        # ----------------------------------------------------------
        prefix = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{prefix}Import complete: "
                f"total={len(all_courses)}, created={created}, updated={updated}, "
                f"skipped={skipped}, errors={errors}"
            )
        )

    def _process_course(self, course, idx, total, dry_run):
        """Enrich course dict with detail data from the API.

        Mutates `course` in place by adding parsed fields.
        """
        content_id = course.get("contentid", "")
        title = course.get("title", "").strip()
        mapx = course.get("mapx", "")
        mapy = course.get("mapy", "")

        # Skip invalid entries
        if not title:
            raise ValueError("Empty title")

        try:
            lng = float(mapx) if mapx else 0
            lat = float(mapy) if mapy else 0
        except (ValueError, TypeError):
            lng, lat = 0, 0

        if lng <= 0 or lat <= 0:
            raise ValueError(f"Invalid coordinates: mapx={mapx}, mapy={mapy}")

        # Fetch detail (distance, time, theme)
        time.sleep(0.2)
        detail_items = _api_get(
            "detailIntro2",
            {"contentId": content_id, "contentTypeId": "25"},
            label=f"detail {content_id}",
        )
        detail = detail_items[0] if detail_items else {}

        # Fetch description
        time.sleep(0.2)
        common_items = _api_get(
            "detailCommon2",
            {"contentId": content_id, "contentTypeId": "25", "defaultYN": "Y", "overviewYN": "Y"},
            label=f"common {content_id}",
        )
        common = common_items[0] if common_items else {}

        # Parse fields
        raw_distance = detail.get("distance", "")
        raw_time = detail.get("taketime", "")
        raw_overview = common.get("overview", "")

        distance_km = _parse_distance(raw_distance)
        estimated_minutes = _parse_time(raw_time)
        description = _strip_html(raw_overview)

        # Truncate description to model max_length (1000 chars)
        if len(description) > 1000:
            description = description[:997] + "..."

        # Map area code to region
        area_code = str(course.get("areacode", ""))
        region = AREA_CODE_MAP.get(area_code, "")

        # Image: prefer firstimage, fallback to firstimage2. Normalize
        # http → https so the browser doesn't block as mixed content.
        image_url = course.get("firstimage", "") or course.get("firstimage2", "")
        if image_url.startswith("http://"):
            image_url = "https://" + image_url[len("http://"):]

        # The public API's contentTypeId=25 includes drive/overnight tour
        # packages, not just walking courses. Filter by distance so only
        # true walking-scale trails come through (≤15 km).
        if distance_km is None or distance_km <= 0 or distance_km > 15:
            raise ValueError(
                f"Not a walking-scale trail (distance_km={distance_km})"
            )

        # Store parsed data back into course dict for _save_course
        course["_parsed"] = {
            "title": title,
            "description": description or f"{title} 걷기 코스",
            "region": region,
            "country": "KR",
            "distance_km": distance_km if distance_km else 0,
            "estimated_minutes": estimated_minutes if estimated_minutes else 0,
            "difficulty": _infer_difficulty(distance_km),
            "start_lat": lat,
            "start_lng": lng,
            "thumbnail_url": image_url or "",
            "trail_type": "nature",
            "best_season": "all",
            "is_official": True,
            "source": "visitkorea",
            "source_url": f"https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid={content_id}",
            "status": "approved",
        }

        if dry_run:
            p = course["_parsed"]
            self.stdout.write(
                f"  [{idx + 1}/{total}] {p['title']} | "
                f"{p['region']} | {p['distance_km']}km | "
                f"{p['estimated_minutes']}min | {p['difficulty']}"
            )

    def _save_course(self, course):
        """Create or update a Trail from the parsed course data.

        Returns 'created', 'updated', or 'skipped'.
        """
        p = course["_parsed"]

        source_url = p["source_url"]
        source = p["source"]

        # Use end_lat/end_lng same as start since the API only gives one point
        defaults = {
            "title": p["title"],
            "description": p["description"],
            "region": p["region"],
            "country": p["country"],
            "distance_km": Decimal(str(p["distance_km"])),
            "estimated_minutes": p["estimated_minutes"],
            "difficulty": p["difficulty"],
            "start_lat": Decimal(str(p["start_lat"])),
            "start_lng": Decimal(str(p["start_lng"])),
            "end_lat": Decimal(str(p["start_lat"])),
            "end_lng": Decimal(str(p["start_lng"])),
            "thumbnail_url": p["thumbnail_url"],
            "trail_type": p["trail_type"],
            "best_season": p["best_season"],
            "is_official": p["is_official"],
            "status": p["status"],
        }

        trail, was_created = Trail.objects.update_or_create(
            source=source,
            source_url=source_url,
            defaults=defaults,
        )

        return "created" if was_created else "updated"
