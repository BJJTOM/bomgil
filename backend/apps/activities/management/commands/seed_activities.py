import math
import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import CustomUser
from apps.activities.models import ActivityTrack, DailyActivitySummary
from apps.trails.models import Trail


# Starting coordinates for various areas
ROUTE_ORIGINS = {
    "성수동": (37.5446, 127.0559),
    "해운대": (35.1587, 129.1604),
    "북촌": (37.5796, 126.9770),
    "제주 서귀포": (33.2449, 126.5118),
    "전주 한옥마을": (35.8150, 127.1530),
    "강릉 경포": (37.7940, 128.8960),
    "도쿄 야나카": (35.7250, 139.7700),
    "삼청동": (37.5800, 126.9820),
    "서울숲": (37.5444, 127.0374),
    "뚝섬": (37.5315, 127.0665),
    "달맞이길": (35.1610, 129.1750),
    "안목해변": (37.7730, 128.9460),
}

ACTIVITY_TEMPLATES = [
    {"title": "성수동 오후 산책", "area": "성수동", "heading": 180},
    {"title": "해운대 해안 산책", "area": "해운대", "heading": 90},
    {"title": "북촌 골목길 탐방", "area": "북촌", "heading": 45},
    {"title": "서귀포 올레길 걷기", "area": "제주 서귀포", "heading": 270},
    {"title": "전주 한옥마을 야경 산책", "area": "전주 한옥마을", "heading": 200},
    {"title": "경포호 둘레길 산책", "area": "강릉 경포", "heading": 150},
    {"title": "야나카 골목 탐방", "area": "도쿄 야나카", "heading": 60},
    {"title": "삼청동 카페거리 산책", "area": "삼청동", "heading": 120},
    {"title": "서울숲 아침 조깅", "area": "서울숲", "heading": 350},
    {"title": "뚝섬 한강 러닝", "area": "뚝섬", "heading": 90},
    {"title": "달맞이길 일몰 산책", "area": "달맞이길", "heading": 70},
    {"title": "안목해변 카페길 걷기", "area": "안목해변", "heading": 180},
    {"title": "북촌 8경 탐방", "area": "북촌", "heading": 130},
    {"title": "성수동 카페 골목 투어", "area": "성수동", "heading": 220},
    {"title": "해운대 새벽 산책", "area": "해운대", "heading": 45},
    {"title": "서울숲 주말 산책", "area": "서울숲", "heading": 90},
    {"title": "전주 남부시장 먹거리 탐방", "area": "전주 한옥마을", "heading": 160},
    {"title": "제주 해안 트레킹", "area": "제주 서귀포", "heading": 310},
]

SOURCES = ["apple_watch", "garmin", "phone_gps", "cashwalk", "strava", "samsung_health"]


def generate_track_points(start_lat, start_lng, num_points=100, heading=None):
    """Generate realistic GPS track points."""
    points = []
    lat, lng = start_lat, start_lng
    ele = random.uniform(5, 50)
    base_time = datetime.now() - timedelta(hours=random.randint(1, 48))

    if heading is None:
        heading = random.uniform(0, 360)

    for i in range(num_points):
        heading += random.gauss(0, 15)
        step = random.uniform(0.00005, 0.00015)
        lat += step * math.cos(math.radians(heading))
        lng += step * math.sin(math.radians(heading))
        ele += random.gauss(0, 1)
        ele = max(0, ele)

        points.append({
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "ele": round(ele, 1),
            "time": (base_time + timedelta(seconds=i * random.randint(8, 15))).isoformat(),
        })

    return points


class Command(BaseCommand):
    help = "Seed realistic activity tracking data for the Bomgil walking travel platform"

    def handle(self, *args, **options):
        users = list(CustomUser.objects.all())
        trails = list(Trail.objects.all())

        if not users:
            self.stderr.write(self.style.ERROR("No users found. Run user seed first."))
            return

        self.stdout.write(f"Found {len(users)} users, {len(trails)} trails")

        # Clear existing activity data
        deleted_tracks, _ = ActivityTrack.objects.all().delete()
        deleted_summaries, _ = DailyActivitySummary.objects.all().delete()
        self.stdout.write(f"Cleared {deleted_tracks} tracks, {deleted_summaries} summaries")

        # Pick 18 activity templates
        templates = random.sample(ACTIVITY_TEMPLATES, min(18, len(ACTIVITY_TEMPLATES)))

        created_tracks = []
        now = timezone.now()

        for idx, tmpl in enumerate(templates):
            user = random.choice(users)
            area = tmpl["area"]
            origin = ROUTE_ORIGINS[area]

            # Generate stats
            distance_km = round(random.uniform(2.0, 15.0), 2)
            duration_minutes = random.randint(30, 240)
            steps = random.randint(3000, 20000)
            calories = random.randint(100, 800)
            elevation_gain = random.randint(10, 300)
            elevation_loss = random.randint(10, int(elevation_gain * 1.1) + 1)

            # Number of track points proportional to distance
            num_points = max(50, min(200, int(distance_km * 20)))
            track_points = generate_track_points(
                origin[0], origin[1],
                num_points=num_points,
                heading=tmpl.get("heading"),
            )

            # Bounding box from track points
            lats = [p["lat"] for p in track_points]
            lngs = [p["lng"] for p in track_points]
            eles = [p["ele"] for p in track_points]

            # Random date within past 14 days
            days_ago = random.randint(0, 13)
            hour = random.randint(6, 20)
            minute = random.randint(0, 59)
            started_at = now - timedelta(days=days_ago, hours=random.randint(0, 5))
            started_at = started_at.replace(hour=hour, minute=minute, second=0, microsecond=0)
            finished_at = started_at + timedelta(minutes=duration_minutes)

            # Compute pace and speed
            avg_speed = round(distance_km / (duration_minutes / 60), 1) if duration_minutes > 0 else 0
            max_speed = round(avg_speed * random.uniform(1.2, 1.8), 1)
            avg_pace = round(duration_minutes / distance_km, 1) if distance_km > 0 else 0

            # Maybe link to a trail
            trail = None
            if trails and random.random() < 0.6:
                trail = random.choice(trails)

            source = random.choice(SOURCES)

            track = ActivityTrack.objects.create(
                user=user,
                trail=trail,
                source=source,
                track_points=track_points,
                title=tmpl["title"],
                started_at=started_at,
                finished_at=finished_at,
                total_steps=steps,
                distance_km=Decimal(str(distance_km)),
                duration_minutes=duration_minutes,
                calories_burned=calories,
                elevation_gain_m=elevation_gain,
                elevation_loss_m=elevation_loss,
                max_elevation_m=Decimal(str(round(max(eles), 1))),
                min_elevation_m=Decimal(str(round(min(eles), 1))),
                avg_speed_kmh=Decimal(str(min(avg_speed, 99.9))),
                max_speed_kmh=Decimal(str(min(max_speed, 99.9))),
                avg_pace_min_km=Decimal(str(min(avg_pace, 99.9))),
                min_lat=Decimal(str(round(min(lats), 6))),
                max_lat=Decimal(str(round(max(lats), 6))),
                min_lng=Decimal(str(round(min(lngs), 6))),
                max_lng=Decimal(str(round(max(lngs), 6))),
                is_public=random.random() < 0.85,
            )
            created_tracks.append(track)
            self.stdout.write(
                f"  [{idx+1:2d}] {track.title} | {source} | {distance_km}km | "
                f"{duration_minutes}min | {steps} steps | user={user.nickname}"
            )

        # Build DailyActivitySummary records
        # Group tracks by (user, date)
        daily_map = {}
        for track in created_tracks:
            if not track.started_at:
                continue
            key = (track.user_id, track.started_at.date())
            if key not in daily_map:
                daily_map[key] = {
                    "total_steps": 0,
                    "total_distance_km": Decimal("0"),
                    "total_duration_minutes": 0,
                    "total_calories": 0,
                    "track_count": 0,
                }
            entry = daily_map[key]
            entry["total_steps"] += track.total_steps or 0
            entry["total_distance_km"] += track.distance_km or Decimal("0")
            entry["total_duration_minutes"] += track.duration_minutes or 0
            entry["total_calories"] += track.calories_burned or 0
            entry["track_count"] += 1

        summary_count = 0
        for (user_id, day), data in daily_map.items():
            DailyActivitySummary.objects.create(
                user_id=user_id,
                date=day,
                total_steps=data["total_steps"],
                total_distance_km=data["total_distance_km"],
                total_duration_minutes=data["total_duration_minutes"],
                total_calories=data["total_calories"],
                track_count=data["track_count"],
            )
            summary_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone! Created {len(created_tracks)} activity tracks "
            f"and {summary_count} daily summaries."
        ))
