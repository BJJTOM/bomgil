"""Nearby POI (points of interest) proxy for the Korea Tourism API.

Fetches nearby attractions for a trail's starting location using the
KorService2 `locationBasedList2` endpoint and caches results for 24 hours.
"""

import logging
import os

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

CACHE_TTL = 60 * 60 * 24  # 24 hours


class TrailNearbyPOIView(APIView):
    """GET /api/v1/trails/{id}/nearby/

    Returns nearby points of interest within 2km of the trail's start
    location, fetched from the Korea Tourism API (KorService2).

    Results are cached per trail for 24 hours. No authentication required.
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

        lat = float(trail.start_lat)
        lng = float(trail.start_lng)

        params = {
            "serviceKey": api_key,
            "numOfRows": 20,
            "pageNo": 1,
            "MobileOS": "ETC",
            "MobileApp": "Moru",
            "_type": "json",
            "mapX": lng,
            "mapY": lat,
            "radius": 2000,
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
            logger.exception("Failed to fetch nearby POIs from KorService2")
            return Response([])

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

        # Map to clean output
        pois = []
        for item in items:
            content_type_id = str(item.get("contenttypeid", ""))
            category = CONTENT_TYPE_MAP.get(content_type_id, "기타")

            poi = {
                "name": item.get("title", ""),
                "category": category,
                "content_type_id": content_type_id,
                "lat": float(item.get("mapy", 0)),
                "lng": float(item.get("mapx", 0)),
                "image": item.get("firstimage") or item.get("firstimage2") or "",
                "address": item.get("addr1", ""),
                "tel": item.get("tel", ""),
            }
            pois.append(poi)

        # Cache the results
        cache.set(cache_key, pois, CACHE_TTL)

        return Response(pois)
