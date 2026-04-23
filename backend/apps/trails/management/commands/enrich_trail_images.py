"""Enrich Durunubi trails with images from the KorService2 API.

The Durunubi API provides GPS routes but NO images. This command
searches KorService2 (Korea Tourism Organization) for matching
walking-course content and copies the image URL into the trail's
thumbnail_url field.

Strategy:
  1. searchKeyword2 with the trail title -> look for contentTypeId=25
  2. Fallback: locationBasedList2 with the trail's start coordinates
     + contentTypeId=25 (walking courses) within 2km radius

Usage:
    python manage.py enrich_trail_images
    python manage.py enrich_trail_images --limit 10
    python manage.py enrich_trail_images --dry-run
"""

import os
import time

import requests
import urllib3
from django.core.management.base import BaseCommand

from apps.trails.models import Trail

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://apis.data.go.kr/B551011/KorService2"


def _get_api_key():
    key = os.environ.get("VISITKOREA_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "VISITKOREA_API_KEY is not configured. "
            "Set it in the service environment before running enrich_trail_images."
        )
    return key


def _api_get(endpoint, params, label=""):
    """GET request to KorService2 with retry + backoff."""
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


def _extract_image_url(item):
    """Extract the best image URL from a KorService2 result item."""
    url = item.get("firstimage", "") or item.get("firstimage2", "")
    if url and url.startswith("http://"):
        url = "https://" + url[len("http://"):]
    return url or ""


def _simplify_title(title):
    """Simplify trail title for keyword search.

    Durunubi titles often look like:
      '해파랑길 01코스'  -> search for '해파랑길'
      '코리아둘레길 서울 02코스' -> search for '코리아둘레길'
      '남파랑길 23코스' -> search for '남파랑길'

    We take the first "word" (Korean trail name) which is the series
    identifier, giving the best chance of finding a match in KorService2.
    """
    if not title:
        return title
    # Remove course/segment numbers like "01코스", "1구간"
    parts = title.split()
    # Return just the first word (series name) for broader matching
    return parts[0] if parts else title


class Command(BaseCommand):
    help = "Enrich Durunubi trails with images from KorService2 API"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Only process first N trails (0 = all)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be updated without saving",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN -- no data will be saved"))

        # Find Durunubi trails without images
        qs = Trail.objects.filter(
            source="durunubi",
            cover_image="",
            thumbnail_url="",
        ).order_by("id")

        total = qs.count()
        self.stdout.write(f"Found {total} Durunubi trails without images")

        if limit:
            qs = qs[:limit]
            self.stdout.write(f"Processing first {limit}")

        enriched = 0
        skipped = 0
        errors = 0

        for idx, trail in enumerate(qs):
            try:
                image_url = self._find_image(trail, idx)
                if image_url:
                    if not dry_run:
                        trail.thumbnail_url = image_url
                        trail.save(update_fields=["thumbnail_url"])
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  [{idx + 1}] {trail.title} -> {image_url[:80]}..."
                        )
                    )
                    enriched += 1
                else:
                    self.stdout.write(f"  [{idx + 1}] {trail.title} -> no image found")
                    skipped += 1
            except Exception as exc:
                errors += 1
                self.stderr.write(
                    self.style.ERROR(
                        f"  [{idx + 1}] Error for {trail.title}: {exc}"
                    )
                )

            # Rate limit between calls
            time.sleep(0.5)

        prefix = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{prefix}Enrich complete: "
                f"enriched={enriched}, skipped={skipped}, errors={errors}"
            )
        )

    def _find_image(self, trail, idx):
        """Try to find an image URL for the given trail.

        Strategy 1: searchKeyword2 with simplified trail title
        Strategy 2: locationBasedList2 with trail start coordinates
        """
        # Strategy 1: keyword search
        keyword = _simplify_title(trail.title)
        if keyword:
            items = _api_get(
                "searchKeyword2",
                {
                    "keyword": keyword,
                    "contentTypeId": "25",
                    "numOfRows": 10,
                    "pageNo": 1,
                },
                label=f"search '{keyword}'",
            )
            for item in items:
                img = _extract_image_url(item)
                if img:
                    return img

        # Strategy 2: location-based search near trail start
        start_lat = float(trail.start_lat or 0)
        start_lng = float(trail.start_lng or 0)
        if start_lat > 0 and start_lng > 0:
            time.sleep(0.5)
            items = _api_get(
                "locationBasedList2",
                {
                    "mapX": str(start_lng),
                    "mapY": str(start_lat),
                    "radius": "2000",
                    "contentTypeId": "25",
                    "numOfRows": 5,
                    "pageNo": 1,
                },
                label=f"location ({start_lat},{start_lng})",
            )
            for item in items:
                img = _extract_image_url(item)
                if img:
                    return img

        return ""
