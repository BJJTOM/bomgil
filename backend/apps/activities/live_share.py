"""
Live Walk Sharing — Strava Beacon style safety feature.

Lets a user share their real-time GPS location with friends/family
during a walk via a public read-only URL. The mobile app POSTs the
current position every ~15 seconds; viewers GET the latest position.

Storage: Django cache (DatabaseCache in production). No model needed —
shared walks are inherently ephemeral and auto-expire.

Endpoints:
  POST   /api/v1/live-walks/        — start a session, returns {token, url}
  POST   /api/v1/live-walks/<t>/    — push current location (auth = token)
  GET    /api/v1/live-walks/<t>/    — public read for the web viewer
  DELETE /api/v1/live-walks/<t>/    — explicitly end the session
"""
import secrets
import time

from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from rest_framework.views import APIView

# Sessions auto-expire after 2 hours of inactivity. The mobile client
# refreshes every 15s while a walk is active, so 2 hours of silence
# means the walk is over.
SESSION_TTL_SECONDS = 2 * 60 * 60

PUBLIC_BASE_URL = "https://moruwalk.com/live"


def _cache_key(token: str) -> str:
    return f"live_walk:{token}"


class LiveStartThrottle(UserRateThrottle):
    scope = "live_start"
    rate = "30/day"


class LiveUpdateThrottle(UserRateThrottle):
    scope = "live_update"
    rate = "1000/hour"  # ~15s × 240 updates/hour, with headroom


class LiveViewThrottle(AnonRateThrottle):
    scope = "live_view"
    rate = "240/hour"  # 1 view per 15 sec for 1 hour


class LiveStartView(APIView):
    """POST /live-walks/ — start a live session, return token + share URL."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [LiveStartThrottle]

    def post(self, request):
        token = secrets.token_urlsafe(8)
        nickname = getattr(request.user, "nickname", "사용자")
        record = {
            "owner_id": request.user.id,
            "owner_nickname": nickname,
            "started_at": time.time(),
            "last_update": time.time(),
            "current": None,  # {lat, lng, accuracy, speed_kmh}
            "track": [],      # list of [lat, lng, ts] tuples for trail
            "distance_km": 0,
            "duration_seconds": 0,
        }
        cache.set(_cache_key(token), record, timeout=SESSION_TTL_SECONDS)
        return Response({
            "token": token,
            "share_url": f"{PUBLIC_BASE_URL}/{token}",
            "expires_in": SESSION_TTL_SECONDS,
        }, status=status.HTTP_201_CREATED)


class LiveDetailView(APIView):
    """
    POST /live-walks/<token>/ — push location update (owner only)
    GET  /live-walks/<token>/ — read latest location (public)
    DELETE /live-walks/<token>/ — end session (owner only)
    """
    # GET is public so anyone with the link can view; POST/DELETE check
    # token-vs-user inside the handler.
    permission_classes = [permissions.AllowAny]

    def get_throttles(self):
        if self.request.method == "POST":
            return [LiveUpdateThrottle()]
        if self.request.method == "DELETE":
            return [LiveUpdateThrottle()]
        return [LiveViewThrottle()]

    def get(self, request, token):
        record = cache.get(_cache_key(token))
        if not record:
            return Response(
                {"error": "이 공유는 만료되었거나 존재하지 않습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Strip owner_id from public response
        return Response({
            "owner_nickname": record.get("owner_nickname"),
            "started_at": record.get("started_at"),
            "last_update": record.get("last_update"),
            "current": record.get("current"),
            "track": record.get("track", []),
            "distance_km": record.get("distance_km", 0),
            "duration_seconds": record.get("duration_seconds", 0),
            "is_live": (time.time() - record.get("last_update", 0)) < 60,
        })

    def post(self, request, token):
        record = cache.get(_cache_key(token))
        if not record:
            return Response(
                {"error": "세션이 만료되었습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Owner-only: must be authenticated and match the original user.
        if not request.user.is_authenticated or request.user.id != record.get("owner_id"):
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        try:
            lat = float(request.data.get("lat"))
            lng = float(request.data.get("lng"))
        except (TypeError, ValueError):
            return Response({"error": "lat/lng가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        accuracy = request.data.get("accuracy")
        speed = request.data.get("speed_kmh")
        distance_km = request.data.get("distance_km")
        duration = request.data.get("duration_seconds")

        record["current"] = {
            "lat": lat,
            "lng": lng,
            "accuracy": float(accuracy) if accuracy is not None else None,
            "speed_kmh": float(speed) if speed is not None else None,
        }
        record["last_update"] = time.time()
        if distance_km is not None:
            try:
                record["distance_km"] = float(distance_km)
            except (TypeError, ValueError):
                pass
        if duration is not None:
            try:
                record["duration_seconds"] = float(duration)
            except (TypeError, ValueError):
                pass
        # Append to trail (keep last 500 points to limit memory)
        track = record.get("track", [])
        track.append([lat, lng, int(time.time())])
        if len(track) > 500:
            track = track[-500:]
        record["track"] = track

        cache.set(_cache_key(token), record, timeout=SESSION_TTL_SECONDS)
        return Response({"ok": True})

    def delete(self, request, token):
        record = cache.get(_cache_key(token))
        if not record:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if not request.user.is_authenticated or request.user.id != record.get("owner_id"):
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)
        cache.delete(_cache_key(token))
        return Response(status=status.HTTP_204_NO_CONTENT)
