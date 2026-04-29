"""
Regression tests for the activity-create flow.

Pins down two pieces of behavior that have bitten us before:

1. `compute_summary()` (apps/activities/gpx_parser.py) must produce
   sensible distance/duration/elevation values for a known set of
   track points.

2. `ActivityTrackViewSet.perform_create()` must NOT clobber a
   client-supplied `distance_km` with the chord-recomputed value when
   the phone also sent `track_points`. The mobile app computes
   distance from the FULL GPS stream and downsamples the points
   before POST, so re-running `compute_summary` on the server always
   gets a shorter (~5–10%) chord-only distance — see commit a7e39cf
   for the regression that fix prevents.

3. Conversely, when the client did NOT send `distance_km` (e.g., a
   GPX-only upload or an older mobile build), `compute_summary`
   should backfill it.
"""
from datetime import datetime
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser
from apps.activities.gpx_parser import compute_summary
from apps.activities.models import ActivityTrack


# A small, hand-checked track of four points near Seoul City Hall.
# Distances (haversine):
#   p0→p1:  ~0.1112 km
#   p1→p2:  ~0.0881 km
#   p2→p3:  ~0.1112 km
#   total:  ~0.3105 km  → rounded to 0.31 km
# Elevation profile: 30 → 35 → 32 → 30  (gain 5 m, loss 5 m)
# Time span: 10:00:00 → 10:04:00  → 4 minutes
KNOWN_POINTS = [
    {"lat": 37.5665, "lng": 126.9780, "ele": 30.0, "time": "2024-01-01T10:00:00Z"},
    {"lat": 37.5675, "lng": 126.9780, "ele": 35.0, "time": "2024-01-01T10:01:00Z"},
    {"lat": 37.5675, "lng": 126.9790, "ele": 32.0, "time": "2024-01-01T10:02:30Z"},
    {"lat": 37.5665, "lng": 126.9790, "ele": 30.0, "time": "2024-01-01T10:04:00Z"},
]


def _make_user(**kwargs):
    """Create a CustomUser. Mirrors the helper in apps/accounts/tests.py."""
    i = CustomUser.objects.count()
    defaults = {
        "username": f"walker_{i}",
        "email": f"walker_{i}@example.com",
        "nickname": f"walker_{i}",
    }
    defaults.update(kwargs)
    return CustomUser.objects.create_user(**defaults)


class ComputeSummaryTests(TestCase):
    """Direct tests of the pure compute_summary() function."""

    def test_distance_within_tolerance(self):
        s = compute_summary(KNOWN_POINTS)
        # Hand-computed haversine total ≈ 0.3105 km, rounded to 0.31.
        self.assertAlmostEqual(float(s["distance_km"]), 0.31, delta=0.01)

    def test_duration_minutes(self):
        s = compute_summary(KNOWN_POINTS)
        self.assertEqual(s["duration_minutes"], 4)

    def test_elevation_gain_and_loss(self):
        s = compute_summary(KNOWN_POINTS)
        # Profile 30→35 (+5), 35→32 (-3), 32→30 (-2)  → gain 5, loss 5
        self.assertEqual(s["elevation_gain_m"], 5)
        self.assertEqual(s["elevation_loss_m"], 5)

    def test_min_max_elevation(self):
        s = compute_summary(KNOWN_POINTS)
        self.assertEqual(s["max_elevation_m"], Decimal("35.0"))
        self.assertEqual(s["min_elevation_m"], Decimal("30.0"))

    def test_started_finished_at(self):
        s = compute_summary(KNOWN_POINTS)
        self.assertEqual(
            s["started_at"], datetime.fromisoformat("2024-01-01T10:00:00+00:00")
        )
        self.assertEqual(
            s["finished_at"], datetime.fromisoformat("2024-01-01T10:04:00+00:00")
        )

    def test_bounding_box(self):
        s = compute_summary(KNOWN_POINTS)
        self.assertEqual(s["min_lat"], Decimal("37.566500"))
        self.assertEqual(s["max_lat"], Decimal("37.567500"))
        self.assertEqual(s["min_lng"], Decimal("126.978000"))
        self.assertEqual(s["max_lng"], Decimal("126.979000"))

    def test_empty_points_returns_empty(self):
        self.assertEqual(compute_summary([]), {})


# Default settings point caches at Redis on host "redis", which the
# unit-test environment doesn't have. Swap to an in-memory cache and
# disable throttling so the create endpoint can be exercised here.
@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": [],
        "DEFAULT_PERMISSION_CLASSES": [],
        "DEFAULT_THROTTLE_CLASSES": [],
        "DEFAULT_THROTTLE_RATES": {},
    },
)
class ActivityCreateAPITests(TestCase):
    """End-to-end tests for POST /api/v1/activities/."""

    URL = "/api/v1/activities/"

    def setUp(self):
        self.user = _make_user()
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    # ── Regression for commit a7e39cf ──────────────────────────────
    def test_client_distance_km_is_preserved(self):
        """If the client posted distance_km AND track_points, the saved
        row must keep the client value — the server's chord-recomputed
        number is always shorter (downsampled JSON) and would silently
        lower the user's recorded distance.
        """
        # Client claims 16.40 km — nothing like the ~0.31 km the chord
        # recompute would produce on KNOWN_POINTS. The whole point is
        # to verify the server does NOT overwrite this value.
        client_distance = "16.40"
        payload = {
            "source": "phone_gps",
            "title": "Long hike",
            "distance_km": client_distance,
            "duration_minutes": 240,
            "track_points": KNOWN_POINTS,
            "started_at": "2024-01-01T10:00:00Z",
            "finished_at": "2024-01-01T14:00:00Z",
        }
        response = self.client.post(self.URL, data=payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)

        # The create serializer doesn't include `id`, so fetch the row
        # we just made by user (each test creates a single activity).
        activity = ActivityTrack.objects.get(user=self.user)
        # Pin: client value wins.
        self.assertEqual(activity.distance_km, Decimal(client_distance))
        # Sanity: it is *not* the chord-recompute value (~0.31).
        self.assertNotAlmostEqual(float(activity.distance_km), 0.31, delta=0.5)
        self.assertEqual(activity.duration_minutes, 240)

    def test_client_explicit_distance_wins_even_if_smaller(self):
        """Even when the client's value is *smaller* than the chord
        recompute, the client still wins. The contract is "trust
        whatever the client sent" — we don't second-guess it. This
        locks the rule in regardless of which way the comparison
        goes (the original regression went the other direction; this
        guards against an over-corrective "use whichever is bigger"
        fix).
        """
        payload = {
            "source": "phone_gps",
            "title": "Tiny client value",
            "distance_km": "0.10",  # smaller than chord (~0.31)
            "track_points": KNOWN_POINTS,
        }
        response = self.client.post(self.URL, data=payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)

        # The create serializer doesn't include `id`, so fetch the row
        # we just made by user (each test creates a single activity).
        activity = ActivityTrack.objects.get(user=self.user)
        self.assertEqual(activity.distance_km, Decimal("0.10"))

    def test_track_points_only_backfills_summary(self):
        """No distance_km on the request → compute_summary runs and
        populates distance/elevation/bbox from the points.
        """
        payload = {
            "source": "phone_gps",
            "title": "Auto-summarized",
            "track_points": KNOWN_POINTS,
        }
        response = self.client.post(self.URL, data=payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)

        # The create serializer doesn't include `id`, so fetch the row
        # we just made by user (each test creates a single activity).
        activity = ActivityTrack.objects.get(user=self.user)
        # Backfilled from KNOWN_POINTS.
        self.assertAlmostEqual(float(activity.distance_km), 0.31, delta=0.05)
        self.assertEqual(activity.elevation_gain_m, 5)
        self.assertEqual(activity.elevation_loss_m, 5)
        # Bounding box backfilled too.
        self.assertEqual(activity.min_lat, Decimal("37.566500"))
        self.assertEqual(activity.max_lat, Decimal("37.567500"))

    def test_no_track_points_no_overwrite(self):
        """Manual entry (no points, just a stat blob) saves cleanly."""
        payload = {
            "source": "manual_gpx",
            "title": "Manual entry",
            "distance_km": "5.20",
            "duration_minutes": 60,
            "started_at": "2024-01-01T10:00:00Z",
        }
        response = self.client.post(self.URL, data=payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        # The create serializer doesn't include `id`, so fetch the row
        # we just made by user (each test creates a single activity).
        activity = ActivityTrack.objects.get(user=self.user)
        self.assertEqual(activity.distance_km, Decimal("5.20"))
        self.assertEqual(activity.duration_minutes, 60)
