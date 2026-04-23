"""POI detail proxy for the Korea Tourism API.

Fetches detailed information about a single point of interest using the
KorService2 `detailCommon2` and `detailIntro2` endpoints and caches
results for 24 hours.
"""

import logging
import os
import re

import requests
from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

CACHE_TTL = 60 * 60 * 24  # 24 hours

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

# Maps detailIntro2 field names (per content type) to unified output keys.
INTRO_FIELD_MAP = {
    # 음식점 (contentTypeId=39)
    "39": {
        "firstmenu": "main_menu",
        "treatmenu": "menu_info",
        "opentimefood": "operating_hours",
        "restdatefood": "closed_days",
        "parkingfood": "parking",
        "infocenterfood": "info_center",
    },
    # 관광지 (contentTypeId=12)
    "12": {
        "usetime": "operating_hours",
        "restdate": "closed_days",
        "parking": "parking",
        "infocenter": "info_center",
        "usefee": "fee",
    },
    # 숙박 (contentTypeId=32)
    "32": {
        "checkintime": "checkin",
        "checkouttime": "checkout",
        "parkinglodging": "parking",
        "infocenterlodging": "info_center",
        "roomtype": "room_type",
    },
    # 문화시설 (contentTypeId=14)
    "14": {
        "usefee": "fee",
        "usetimeculture": "operating_hours",
        "restdateculture": "closed_days",
        "parkingculture": "parking",
        "infocenterculture": "info_center",
    },
}


def strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", text)
    # Collapse multiple whitespace / newlines into single spaces
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _fetch_detail_intro(api_key: str, content_id, content_type_id: str) -> dict:
    """Call detailIntro2 and return unified field dict.

    Returns an empty dict on failure or if the content type has no
    mapped fields.
    """
    field_map = INTRO_FIELD_MAP.get(content_type_id)
    if not field_map:
        return {}

    params = {
        "serviceKey": api_key,
        "contentId": content_id,
        "contentTypeId": content_type_id,
        "MobileOS": "ETC",
        "MobileApp": "Moru",
        "_type": "json",
    }

    try:
        resp = requests.get(
            "https://apis.data.go.kr/B551011/KorService2/detailIntro2",
            params=params,
            timeout=10,
            verify=False,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("Failed to fetch detailIntro2 for content %s", content_id)
        return {}

    try:
        items = (
            data.get("response", {})
            .get("body", {})
            .get("items", {})
            .get("item", [])
        )
        if isinstance(items, dict):
            items = [items]
    except (AttributeError, TypeError):
        items = []

    if not items:
        return {}

    intro = items[0]
    result = {}
    for api_field, unified_key in field_map.items():
        value = strip_html(str(intro.get(api_field, "") or ""))
        if value:
            result[unified_key] = value

    return result


class POIDetailView(APIView):
    """GET /api/v1/poi/{contentId}/

    Returns detailed information about a single POI, fetched from the
    Korea Tourism API (KorService2 detailCommon2 + detailIntro2).

    Results are cached per contentId for 24 hours. No authentication required.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, content_id):
        # Check cache first
        cache_key = f"poi_detail_{content_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        # Build the API request
        api_key = os.environ.get("VISITKOREA_API_KEY")
        if not api_key:
            logger.warning("VISITKOREA_API_KEY not set; cannot fetch POI detail.")
            return Response(
                {"detail": "API 키가 설정되지 않았습니다."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        params = {
            "serviceKey": api_key,
            "contentId": content_id,
            "MobileOS": "ETC",
            "MobileApp": "Moru",
            "_type": "json",
            "defaultYN": "Y",
            "overviewYN": "Y",
            "addrinfoYN": "Y",
            "firstImageYN": "Y",
        }

        try:
            resp = requests.get(
                "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
                params=params,
                timeout=10,
                verify=False,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            logger.exception("Failed to fetch POI detail from KorService2")
            return Response(
                {"detail": "외부 API 호출에 실패했습니다."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Parse the response
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

        if not items:
            return Response(
                {"detail": "정보를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )

        item = items[0]

        content_type_id = str(item.get("contenttypeid", ""))
        category = CONTENT_TYPE_MAP.get(content_type_id, "기타")

        result = {
            "name": item.get("title", ""),
            "category": category,
            "content_type_id": content_type_id,
            "overview": strip_html(item.get("overview", "")),
            "address": item.get("addr1", ""),
            "tel": item.get("tel", ""),
            "homepage": strip_html(item.get("homepage", "")),
            "image": item.get("firstimage") or item.get("firstimage2") or "",
            "lat": float(item.get("mapy", 0)),
            "lng": float(item.get("mapx", 0)),
            # Intro fields — defaults (overwritten below if available)
            "operating_hours": "",
            "closed_days": "",
            "parking": "",
            "main_menu": "",
            "menu_info": "",
            "fee": "",
            "checkin": "",
            "checkout": "",
            "info_center": "",
            "room_type": "",
        }

        # Fetch type-specific intro data and merge
        intro_data = _fetch_detail_intro(api_key, content_id, content_type_id)
        result.update(intro_data)

        # Cache the result
        cache.set(cache_key, result, CACHE_TTL)

        return Response(result)
