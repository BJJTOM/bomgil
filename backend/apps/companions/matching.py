"""
Companion compatibility scoring engine.

Computes a 0-100 compatibility score between two users for walking together.
Scoring is purely algorithmic (no external API calls) and designed to run
under 200ms per pair with proper prefetching.

Breakdown (max 100 points):
    walking_style   25pts   Walking style preference match
    pace_match      25pts   Fitness-level similarity (avg daily distance)
    social_signals  20pts   Mutual follows, shared groups, shared trail likes
    reputation      15pts   companion_rating, verification, trusted badges
    availability    15pts   Schedule compatibility with a walk plan
"""

from __future__ import annotations

import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.cache import cache
from django.db.models import Avg, Q

if TYPE_CHECKING:
    from apps.accounts.models import CustomUser
    from apps.companions.models import WalkPlan

# ── Constants ──────────────────────────────────────────────────────

BASE_SCORE = 50  # Default score when insufficient data exists
CACHE_TTL = 60 * 30  # 30 minutes

# Walking style affinity matrix — higher means more compatible.
# Rows/columns indexed by WALKING_STYLE_CHOICES value.
_STYLE_KEYS = ["explorer", "foodie", "photographer", "talker", "silent"]
_STYLE_AFFINITY = {
    # (style_a, style_b) -> affinity 0.0-1.0
    # Same style = perfect match
    ("explorer", "explorer"): 1.0,
    ("foodie", "foodie"): 1.0,
    ("photographer", "photographer"): 1.0,
    ("talker", "talker"): 1.0,
    ("silent", "silent"): 1.0,
    # Good pairings
    ("explorer", "photographer"): 0.8,
    ("explorer", "foodie"): 0.7,
    ("foodie", "photographer"): 0.7,
    ("talker", "foodie"): 0.7,
    ("talker", "explorer"): 0.6,
    # Neutral pairings
    ("explorer", "talker"): 0.6,
    ("photographer", "talker"): 0.5,
    ("foodie", "silent"): 0.4,
    ("photographer", "silent"): 0.5,
    # Low compatibility
    ("explorer", "silent"): 0.4,
    ("talker", "silent"): 0.2,
}


def _style_affinity(style_a: str | None, style_b: str | None) -> float:
    """Return affinity score (0.0-1.0) for two walking styles."""
    if not style_a or not style_b:
        return 0.5  # Unknown style -> neutral
    if style_a == style_b:
        return 1.0
    # Look up in both directions
    key = (style_a, style_b)
    rev = (style_b, style_a)
    return _STYLE_AFFINITY.get(key, _STYLE_AFFINITY.get(rev, 0.5))


# ── Reason strings (ko / en / ja / zh) ────────────────────────────

REASONS = {
    "style_match": {
        "ko": "걷기 스타일이 비슷해요",
        "en": "Similar walking style",
        "ja": "歩くスタイルが似ています",
        "zh": "步行风格相似",
    },
    "pace_match": {
        "ko": "비슷한 체력 수준이에요",
        "en": "Similar fitness level",
        "ja": "似た体力レベルです",
        "zh": "体力水平相近",
    },
    "same_trails": {
        "ko": "같은 코스를 좋아해요",
        "en": "Likes similar trails",
        "ja": "同じコースが好きです",
        "zh": "喜欢相同的路线",
    },
    "mutual_follow": {
        "ko": "서로 팔로우하고 있어요",
        "en": "You follow each other",
        "ja": "お互いフォローしています",
        "zh": "互相关注中",
    },
    "same_group": {
        "ko": "같은 모임에 참여하고 있어요",
        "en": "In the same group",
        "ja": "同じグループに参加しています",
        "zh": "在同一个小组中",
    },
    "trusted": {
        "ko": "신뢰할 수 있는 동행자예요",
        "en": "Trusted companion",
        "ja": "信頼できる同行者です",
        "zh": "值得信赖的同行者",
    },
    "high_rating": {
        "ko": "높은 동행 평점이에요",
        "en": "Highly rated companion",
        "ja": "高い同行評価です",
        "zh": "同行评分很高",
    },
    "schedule_fit": {
        "ko": "일정이 잘 맞아요",
        "en": "Schedule fits well",
        "ja": "スケジュールが合います",
        "zh": "时间安排很合适",
    },
    "experienced": {
        "ko": "동행 경험이 풍부해요",
        "en": "Experienced companion",
        "ja": "同行経験が豊富です",
        "zh": "同行经验丰富",
    },
}


def _reason(key: str, lang: str = "ko") -> str:
    """Get a localized reason string."""
    return REASONS.get(key, {}).get(lang, REASONS.get(key, {}).get("ko", key))


# ── Prefetching helpers ────────────────────────────────────────────

def _get_avg_daily_distance(user_id: int, days: int = 30) -> Decimal | None:
    """Average daily walking distance over the last N days.

    Uses DailyActivitySummary aggregation — a single query.
    """
    from apps.activities.models import DailyActivitySummary

    cutoff = datetime.date.today() - datetime.timedelta(days=days)
    result = DailyActivitySummary.objects.filter(
        user_id=user_id,
        date__gte=cutoff,
    ).aggregate(avg_dist=Avg("total_distance_km"))
    return result["avg_dist"]


def _get_shared_trail_like_count(user_a_id: int, user_b_id: int) -> int:
    """Count trails liked by both users — single query with subquery."""
    from apps.trails.models import TrailLike

    a_trails = TrailLike.objects.filter(user_id=user_a_id).values_list("trail_id", flat=True)
    return TrailLike.objects.filter(user_id=user_b_id, trail_id__in=a_trails).count()


def _get_shared_group_count(user_a_id: int, user_b_id: int) -> int:
    """Count groups both users belong to — single query with subquery."""
    from apps.community.models import GroupMember

    a_groups = GroupMember.objects.filter(user_id=user_a_id).values_list("group_id", flat=True)
    return GroupMember.objects.filter(user_id=user_b_id, group_id__in=a_groups).count()


def _is_mutual_follow(user_a: "CustomUser", user_b: "CustomUser") -> bool:
    """Check if two users follow each other.

    Assumes user_a and user_b are already loaded. Uses the M2M
    `following` field on CustomUser.
    """
    return (
        user_a.following.filter(pk=user_b.pk).exists()
        and user_b.following.filter(pk=user_a.pk).exists()
    )


def _has_badge(user_id: int, badge_type: str) -> bool:
    """Check if user has a specific badge."""
    from apps.accounts.models import UserBadge

    return UserBadge.objects.filter(user_id=user_id, badge_type=badge_type).exists()


def _user_has_open_plan_on_date(user_id: int, date: datetime.date) -> bool:
    """Check if user already has an open/matched walk plan on the given date."""
    from apps.companions.models import WalkPlan

    return WalkPlan.objects.filter(
        user_id=user_id,
        planned_date=date,
        companion_status__in=["open", "matched"],
    ).exists()


def _user_accepted_request_on_date(user_id: int, date: datetime.date) -> bool:
    """Check if user already has an accepted companion request on the given date."""
    from apps.companions.models import CompanionRequest

    return CompanionRequest.objects.filter(
        requester_id=user_id,
        status="accepted",
        walk_plan__planned_date=date,
    ).exists()


# ── Main scoring function ─────────────────────────────────────────

def _cache_key(user_a_id: int, user_b_id: int, walk_plan_id: int | None) -> str:
    """Deterministic cache key — order users so (A,B) == (B,A) for the
    non-plan-specific portion."""
    lo, hi = sorted([user_a_id, user_b_id])
    plan_suffix = f":wp{walk_plan_id}" if walk_plan_id else ""
    return f"compat:{lo}:{hi}{plan_suffix}"


def compute_compatibility(
    user_a: "CustomUser",
    user_b: "CustomUser",
    walk_plan: "WalkPlan | None" = None,
    lang: str = "ko",
) -> dict:
    """Score compatibility between two users for walking together.

    Returns:
        {
            'score': float,        # 0-100
            'reasons': list[str],  # Localized human-readable reasons
            'breakdown': {
                'walking_style': float,    # 0-25
                'pace_match': float,       # 0-25
                'social_signals': float,   # 0-20
                'reputation': float,       # 0-15
                'availability': float,     # 0-15
            }
        }
    """
    # Check cache first
    ck = _cache_key(user_a.pk, user_b.pk, walk_plan.pk if walk_plan else None)
    cached = cache.get(ck)
    if cached is not None:
        return cached

    reasons: list[str] = []
    breakdown: dict[str, float] = {
        "walking_style": 0.0,
        "pace_match": 0.0,
        "social_signals": 0.0,
        "reputation": 0.0,
        "availability": 0.0,
    }

    # ── 1. Walking style match (max 25) ───────────────────────────
    affinity = _style_affinity(user_a.walking_style, user_b.walking_style)
    breakdown["walking_style"] = round(affinity * 25, 1)
    if affinity >= 0.7:
        reasons.append(_reason("style_match", lang))

    # ── 2. Pace / fitness compatibility (max 25) ──────────────────
    avg_a = _get_avg_daily_distance(user_a.pk)
    avg_b = _get_avg_daily_distance(user_b.pk)

    if avg_a is not None and avg_b is not None and (avg_a > 0 or avg_b > 0):
        # Compute similarity: 1 - |diff| / max(a,b)
        fa, fb = float(avg_a), float(avg_b)
        max_val = max(fa, fb, 0.1)  # avoid div by zero
        diff_ratio = abs(fa - fb) / max_val
        pace_score = max(0.0, 1.0 - diff_ratio)
        breakdown["pace_match"] = round(pace_score * 25, 1)
        if pace_score >= 0.6:
            reasons.append(_reason("pace_match", lang))
    else:
        # No data: give a neutral half-score
        breakdown["pace_match"] = 12.5

    # Also consider weekly_goal_km if available
    if user_a.weekly_goal_km and user_b.weekly_goal_km:
        ga, gb = float(user_a.weekly_goal_km), float(user_b.weekly_goal_km)
        if ga > 0 or gb > 0:
            max_goal = max(ga, gb, 0.1)
            goal_sim = max(0.0, 1.0 - abs(ga - gb) / max_goal)
            # Blend with existing pace_match (weighted average: 70% activity, 30% goal)
            activity_portion = breakdown["pace_match"]
            goal_portion = round(goal_sim * 25, 1)
            breakdown["pace_match"] = round(activity_portion * 0.7 + goal_portion * 0.3, 1)

    # ── 3. Social signals (max 20) ────────────────────────────────
    social_pts = 0.0

    # Mutual follow (8 pts)
    if _is_mutual_follow(user_a, user_b):
        social_pts += 8.0
        reasons.append(_reason("mutual_follow", lang))

    # Shared groups (up to 6 pts, 3 per group, max 2 groups counted)
    shared_groups = _get_shared_group_count(user_a.pk, user_b.pk)
    if shared_groups > 0:
        social_pts += min(shared_groups * 3.0, 6.0)
        reasons.append(_reason("same_group", lang))

    # Shared trail likes (up to 6 pts, 2 per trail, max 3 trails counted)
    shared_trails = _get_shared_trail_like_count(user_a.pk, user_b.pk)
    if shared_trails > 0:
        social_pts += min(shared_trails * 2.0, 6.0)
        reasons.append(_reason("same_trails", lang))

    breakdown["social_signals"] = min(social_pts, 20.0)

    # ── 4. Reputation (max 15) ────────────────────────────────────
    rep_pts = 0.0

    # companion_rating for user_b (the candidate being scored)
    rating_b = float(user_b.companion_rating) if user_b.companion_rating else 0.0
    if rating_b >= 4.5:
        rep_pts += 7.0
        reasons.append(_reason("high_rating", lang))
    elif rating_b >= 4.0:
        rep_pts += 5.0
        reasons.append(_reason("high_rating", lang))
    elif rating_b >= 3.0:
        rep_pts += 3.0
    # No rating = 0 additional points

    # Verification level (up to 4 pts)
    if user_b.verification_level >= 3:
        rep_pts += 4.0
        reasons.append(_reason("trusted", lang))
    elif user_b.verification_level >= 2:
        rep_pts += 3.0
    elif user_b.verification_level >= 1:
        rep_pts += 1.0

    # Trusted badge (2 pts)
    if _has_badge(user_b.pk, "trusted"):
        rep_pts += 2.0
        if _reason("trusted", lang) not in reasons:
            reasons.append(_reason("trusted", lang))

    # Experience bonus (2 pts)
    if user_b.total_walks >= 10:
        rep_pts += 2.0
        reasons.append(_reason("experienced", lang))
    elif user_b.total_walks >= 5:
        rep_pts += 1.0

    breakdown["reputation"] = min(rep_pts, 15.0)

    # ── 5. Availability (max 15) ──────────────────────────────────
    if walk_plan:
        avail_pts = 15.0  # Start at full and deduct

        # Check if user_b already has a plan on that date
        has_plan = _user_has_open_plan_on_date(user_b.pk, walk_plan.planned_date)
        has_accepted = _user_accepted_request_on_date(user_b.pk, walk_plan.planned_date)

        if has_plan or has_accepted:
            avail_pts = 3.0  # Low but not zero (they might still cancel)
        else:
            reasons.append(_reason("schedule_fit", lang))

        # Pace preference match with the walk plan
        if walk_plan.pace:
            pace_pref = walk_plan.pace
            # If user_b has walking data, check if their pace matches the plan
            if avg_b is not None:
                fb = float(avg_b)
                if pace_pref == "slow" and fb > 8:
                    avail_pts -= 3.0  # Very active user on a slow walk
                elif pace_pref == "fast" and fb < 2:
                    avail_pts -= 3.0  # Sedentary user on a fast walk

        breakdown["availability"] = max(avail_pts, 0.0)
    else:
        # No walk plan context -> neutral score
        breakdown["availability"] = 7.5

    # ── Final score ───────────────────────────────────────────────
    total = sum(breakdown.values())
    total = round(min(total, 100.0), 1)

    result = {
        "score": total,
        "reasons": reasons[:5],  # Cap at 5 reasons for UI brevity
        "breakdown": breakdown,
    }

    # Cache for 30 minutes
    cache.set(ck, result, CACHE_TTL)

    return result


# ── Batch suggestion helper ────────────────────────────────────────

def get_suggested_companions(
    walk_plan: "WalkPlan",
    limit: int = 10,
    lang: str = "ko",
) -> list[dict]:
    """Return top-N user suggestions for a walk plan, ranked by score.

    Excludes:
    - The plan owner
    - Users who already requested to join this plan
    - Users blocked by the plan owner (or who blocked the owner)
    - Users banned from companion features (2+ unresolved safety reports)

    Returns list of dicts:
        [
            {
                'user': CustomUser instance,
                'compatibility': { score, reasons, breakdown },
            },
            ...
        ]
    """
    from apps.accounts.models import CustomUser
    from apps.community.models import UserBlock
    from apps.companions.models import CompanionRequest, SafetyReport

    owner = walk_plan.user
    owner_id = owner.pk

    # Collect IDs to exclude
    already_requested_ids = set(
        CompanionRequest.objects.filter(walk_plan=walk_plan)
        .values_list("requester_id", flat=True)
    )

    # Users blocked by the owner OR who blocked the owner
    block_rows = UserBlock.objects.filter(
        Q(blocker_id=owner_id) | Q(blocked_id=owner_id)
    ).values_list("blocker_id", "blocked_id")
    blocked_ids: set[int] = set()
    for blocker_id, blocked_id in block_rows:
        blocked_ids.add(blocker_id)
        blocked_ids.add(blocked_id)
    blocked_ids.discard(owner_id)  # Don't exclude the owner via their own rows

    # Users with 2+ unresolved safety reports (companion-banned)
    from django.db.models import Count

    banned_ids = set(
        SafetyReport.objects.filter(is_resolved=False)
        .values("reported_user_id")
        .annotate(report_count=Count("id"))
        .filter(report_count__gte=2)
        .values_list("reported_user_id", flat=True)
    )

    exclude_ids = {owner_id} | already_requested_ids | blocked_ids | banned_ids

    # Build candidate queryset
    candidates = CustomUser.objects.filter(
        is_active=True,
    ).exclude(
        pk__in=exclude_ids,
    ).select_related().only(
        "id", "nickname", "profile_image", "walking_style",
        "companion_rating", "total_walks", "companion_count",
        "verification_level", "is_verified", "weekly_goal_km",
        "age_range", "gender", "bio", "one_liner", "level", "xp",
    )

    # Apply plan's demographic preferences as soft filters
    # (We still score everyone, but if the plan owner set preferences
    # we can narrow the candidate pool for performance.)
    if walk_plan.preferred_gender != "any":
        candidates = candidates.filter(gender=walk_plan.preferred_gender)

    if walk_plan.preferred_age_range != "any":
        candidates = candidates.filter(age_range=walk_plan.preferred_age_range)

    # Cap candidates to a reasonable pool for scoring (avoid scoring thousands)
    candidate_list = list(candidates[:100])

    # Score each candidate
    scored = []
    for candidate in candidate_list:
        compat = compute_compatibility(owner, candidate, walk_plan=walk_plan, lang=lang)
        scored.append({
            "user": candidate,
            "compatibility": compat,
        })

    # Sort by score descending
    scored.sort(key=lambda x: x["compatibility"]["score"], reverse=True)

    return scored[:limit]
