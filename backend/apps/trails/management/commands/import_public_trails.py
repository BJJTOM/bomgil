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
from datetime import timedelta
from decimal import Decimal, InvalidOperation

import requests
import urllib3
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.trails.models import Trail

# Re-importing unchanged rows burns the public API quota and triggers
# 429s. Skip enrichment for trails already updated within this window.
REFRESH_STALE_AFTER = timedelta(days=7)

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
    """Pull the VisitKorea API key strictly from the environment.

    Refuses to run with a missing key rather than falling back to a
    hard-coded secret — a hard-coded key once leaked into this repo's
    public history and we don't want that to happen again. Set
    `VISITKOREA_API_KEY` in Render → Environment.
    """
    key = os.environ.get("VISITKOREA_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "VISITKOREA_API_KEY is not configured. "
            "Set it in the service environment (Render → Environment) "
            "before running import_public_trails."
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
    if distance_km < 10:
        return "easy"
    if distance_km <= 30:
        return "moderate"
    return "hard"


def _api_get(endpoint, params, label=""):
    """Make a GET request to the KorService2 API with retry + 429 backoff."""
    url = f"{BASE_URL}/{endpoint}"
    params["serviceKey"] = _get_api_key()
    params["MobileOS"] = "ETC"
    params["MobileApp"] = "Moru"
    params["_type"] = "json"

    # Exponential backoff specifically tuned for the public API's bursty
    # rate limiter: waits 5s, 15s, 45s on 429 before giving up.
    backoff_429 = [5, 15, 45]
    backoff_other = [1, 2, 4]

    for attempt in range(4):
        try:
            resp = requests.get(url, params=params, verify=False, timeout=30)
            if resp.status_code == 429:
                if attempt < len(backoff_429):
                    time.sleep(backoff_429[attempt])
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
            if attempt < len(backoff_other):
                time.sleep(backoff_other[attempt])
                continue
            raise RuntimeError(
                f"API request failed after retries ({label}): {exc}"
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
        parser.add_argument(
            "--ai-enhance",
            action="store_true",
            help="Use Claude to rewrite descriptions + generate tags (costs API credits).",
        )
        parser.add_argument(
            "--ai-budget",
            type=int,
            default=50,
            help="When --ai-enhance is on, cap the number of Claude calls per run.",
        )
        parser.add_argument(
            "--refresh-existing",
            action="store_true",
            help="Bypass the 7-day skip-if-fresh filter and re-process already-imported trails (pair with --ai-enhance to back-fill AI descriptions).",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        area_filter = options["area"]
        dry_run = options["dry_run"]
        self.ai_enhance = bool(options.get("ai_enhance"))
        self.ai_budget_left = int(options.get("ai_budget") or 0)

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
            time.sleep(0.5)

        self.stdout.write(f"Total courses fetched: {len(all_courses)}")

        # ----------------------------------------------------------
        # Step 2: Process each course
        # ----------------------------------------------------------
        created = 0
        updated = 0
        skipped = 0
        errors = 0

        fresh_cutoff = timezone.now() - REFRESH_STALE_AFTER
        refresh_existing = bool(options.get("refresh_existing"))

        for idx, course in enumerate(all_courses):
            try:
                content_id = course.get("contentid", "")
                source_url = (
                    f"https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid={content_id}"
                )
                existing = Trail.objects.filter(
                    source="visitkorea", source_url=source_url
                ).only("updated_at").first()
                if (
                    existing
                    and existing.updated_at
                    and existing.updated_at > fresh_cutoff
                    and not refresh_existing
                ):
                    skipped += 1
                    continue

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

        # Skip invalid entries — including menu/placeholder rows the API
        # occasionally returns with junk titles.
        if not title or title in ("Menu",):
            raise ValueError(f"Skippable title: {title!r}")

        try:
            lng = float(mapx) if mapx else 0
            lat = float(mapy) if mapy else 0
        except (ValueError, TypeError):
            lng, lat = 0, 0

        if lng <= 0 or lat <= 0:
            raise ValueError(f"Invalid coordinates: mapx={mapx}, mapy={mapy}")

        # Fetch detail (distance, time, theme)
        time.sleep(0.5)
        detail_items = _api_get(
            "detailIntro2",
            {"contentId": content_id, "contentTypeId": "25"},
            label=f"detail {content_id}",
        )
        detail = detail_items[0] if detail_items else {}

        # Fetch description
        time.sleep(0.5)
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

        # Image: prefer firstimage, fallback to firstimage2, then
        # detailImage2 for courses that didn't set a primary image.
        image_url = course.get("firstimage", "") or course.get("firstimage2", "")
        if not image_url:
            try:
                time.sleep(0.5)
                image_items = _api_get(
                    "detailImage2",
                    {"contentId": content_id, "imageYN": "Y", "subImageYN": "N", "numOfRows": 1, "pageNo": 1},
                    label=f"image {content_id}",
                )
                if image_items:
                    image_url = (
                        image_items[0].get("originimgurl")
                        or image_items[0].get("smallimageurl")
                        or ""
                    )
            except Exception:
                image_url = ""
        if image_url.startswith("http://"):
            image_url = "https://" + image_url[len("http://"):]

        # The public API's contentTypeId=25 includes drive/overnight tour
        # packages, not just walking courses. Filter by distance so only
        # reasonable walking trails come through (≤100 km).
        if distance_km is None or distance_km <= 0 or distance_km > 100:
            raise ValueError(
                f"Not a walking-scale trail (distance_km={distance_km})"
            )

        # Time fallback: API often returns "약 X시간 Y분" free-form that our
        # parser can't read → taketime = 0. If we already know distance,
        # assume a 4 km/h walking pace so the detail page doesn't show "0분".
        if (not estimated_minutes) and distance_km:
            estimated_minutes = int(round(distance_km / 4.0 * 60))

        parsed = {
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

        # Optional: pass the skeleton through Claude for a nicer ko/en/ja
        # description + suggested tags. Budget-capped so a big re-import
        # can't accidentally spend a fortune. Falls back silently on
        # API/network/budget failures.
        if getattr(self, "ai_enhance", False) and self.ai_budget_left > 0:
            try:
                from apps.trails.ai_utils import generate_trail_description
                enriched = generate_trail_description(parsed) or {}
                self.ai_budget_left -= 1
                if enriched.get("description_ko"):
                    parsed["description"] = enriched["description_ko"][:1000]
                parsed["_ai_description_en"] = enriched.get("description_en", "")
                parsed["_ai_description_ja"] = enriched.get("description_ja", "")
                parsed["_ai_tags"] = enriched.get("suggested_tags", []) or []
            except Exception as exc:
                logger_ai = __import__("logging").getLogger(__name__)
                logger_ai.warning("AI enhance failed for %s: %s", content_id, exc)

        # Store parsed data back into course dict for _save_course
        course["_parsed"] = parsed

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

        # Multilingual descriptions and AI-suggested tags — only overwrite
        # when we actually produced new values (AI enhance was on).
        if p.get("_ai_description_en") and hasattr(trail, "description_en"):
            trail.description_en = p["_ai_description_en"][:1000]
        if p.get("_ai_description_ja") and hasattr(trail, "description_ja"):
            trail.description_ja = p["_ai_description_ja"][:1000]
        ai_tags = p.get("_ai_tags") or []
        if ai_tags:
            from apps.trails.models import Tag
            for name in ai_tags[:5]:  # cap to 5 per trail
                clean = (name or "").strip()[:30]
                if not clean:
                    continue
                tag, _ = Tag.objects.get_or_create(name=clean)
                trail.tags.add(tag)
        if p.get("_ai_description_en") or p.get("_ai_description_ja"):
            trail.save(update_fields=["description_en", "description_ja"])

        return "created" if was_created else "updated"
