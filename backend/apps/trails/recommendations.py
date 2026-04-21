"""
AI-powered trail recommendation engine for Moru.

Scoring-based approach (no ML dependencies) that considers:
- User preference patterns from liked trails
- Activity level / difficulty fit
- Seasonal relevance
- Social signals from followed users
- Image availability
- Freshness
- Popularity baseline

All queries are optimized with select_related/prefetch_related and
results are cached per user for 5 minutes.
"""

from collections import Counter
from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone

from .models import Trail, TrailCompletion, TrailLike


# ── Scoring weights ──────────────────────────────────────────────────
WEIGHT_PREFERENCE = 0.40
WEIGHT_DIFFICULTY = 0.15
WEIGHT_SEASONAL = 0.10
WEIGHT_SOCIAL = 0.10
WEIGHT_IMAGE = 0.05
WEIGHT_FRESHNESS = 0.05
WEIGHT_POPULARITY = 0.15

# ── Season mapping ───────────────────────────────────────────────────
MONTH_TO_SEASON = {
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer",
    9: "fall", 10: "fall", 11: "fall",
    12: "winter", 1: "winter", 2: "winter",
}

# ── Recommendation reason strings (multilingual) ────────────────────
REASON_STRINGS = {
    "preference_type": {
        "ko": "좋아하신 {type_name} 코스와 비슷해요",
        "en": "Similar to {type_name} trails you liked",
        "ja": "お気に入りの{type_name}コースに似ています",
        "zh": "与您喜欢的{type_name}路线相似",
    },
    "preference_country": {
        "ko": "관심 있는 지역의 코스예요",
        "en": "A trail in a region you're interested in",
        "ja": "興味のある地域のコースです",
        "zh": "您感兴趣的地区路线",
    },
    "difficulty_fit": {
        "ko": "회원님의 활동량에 딱 맞는 난이도예요",
        "en": "Difficulty matches your activity level",
        "ja": "あなたの活動量にぴったりの難易度です",
        "zh": "难度与您的活动水平匹配",
    },
    "seasonal": {
        "ko": "지금 시즌에 딱 맞는 코스예요",
        "en": "Perfect for this season",
        "ja": "今の季節にぴったりのコースです",
        "zh": "正适合当前季节",
    },
    "social": {
        "ko": "팔로우 중인 유저가 좋아한 코스예요",
        "en": "Liked by people you follow",
        "ja": "フォロー中のユーザーがお気に入りのコースです",
        "zh": "您关注的用户喜欢的路线",
    },
    "fresh": {
        "ko": "새로 등록된 코스예요",
        "en": "Newly added trail",
        "ja": "新しく登録されたコースです",
        "zh": "新上线的路线",
    },
    "popular": {
        "ko": "많은 사람들이 좋아하는 인기 코스예요",
        "en": "A popular trail loved by many",
        "ja": "多くの人に愛されている人気コースです",
        "zh": "深受大家喜爱的热门路线",
    },
    "official": {
        "ko": "공식 추천 코스예요",
        "en": "An officially recommended trail",
        "ja": "公式おすすめコースです",
        "zh": "官方推荐路线",
    },
}

TRAIL_TYPE_DISPLAY = {
    "urban": {"ko": "도심산책", "en": "urban", "ja": "都市散歩", "zh": "城市漫步"},
    "coastal": {"ko": "해안길", "en": "coastal", "ja": "海岸", "zh": "海岸"},
    "village": {"ko": "마을길", "en": "village", "ja": "村道", "zh": "村庄"},
    "cultural": {"ko": "문화탐방", "en": "cultural", "ja": "文化探訪", "zh": "文化探访"},
    "nature": {"ko": "자연길", "en": "nature", "ja": "自然道", "zh": "自然"},
    "mixed": {"ko": "복합", "en": "mixed", "ja": "複合", "zh": "综合"},
}


def _get_current_season():
    """Return the season string for the current month."""
    return MONTH_TO_SEASON[timezone.now().month]


def _build_user_profile(user):
    """Analyze user's liked trails and activity to build a preference profile.

    Returns a dict with:
    - difficulty_dist: Counter of difficulty preferences
    - type_dist: Counter of trail_type preferences
    - country_dist: Counter of country preferences
    - ideal_difficulty: str based on recent activity distances
    - liked_trail_ids: set of trail IDs the user liked
    - completed_trail_ids: set of trail IDs the user completed
    - followed_liked_trail_ids: set of trail IDs liked by followed users
    """
    # Liked trails — fetch in one query
    liked_trails = list(
        Trail.objects.filter(
            likes__user=user,
        ).values("id", "difficulty", "trail_type", "country")
    )
    liked_trail_ids = {t["id"] for t in liked_trails}

    # Completed trails
    completed_trail_ids = set(
        TrailCompletion.objects.filter(user=user).values_list("trail_id", flat=True)
    )

    # Preference distributions from liked trails
    difficulty_dist = Counter(t["difficulty"] for t in liked_trails)
    type_dist = Counter(t["trail_type"] for t in liked_trails)
    country_dist = Counter(t["country"] for t in liked_trails)

    # Determine ideal difficulty from recent activity
    ideal_difficulty = _compute_ideal_difficulty(user)

    # Social: trails liked by users the person follows
    followed_user_ids = list(user.following.values_list("id", flat=True))
    followed_liked_trail_ids = set()
    if followed_user_ids:
        followed_liked_trail_ids = set(
            TrailLike.objects.filter(
                user_id__in=followed_user_ids,
            ).values_list("trail_id", flat=True)[:500]  # cap for performance
        )

    return {
        "difficulty_dist": difficulty_dist,
        "type_dist": type_dist,
        "country_dist": country_dist,
        "ideal_difficulty": ideal_difficulty,
        "liked_trail_ids": liked_trail_ids,
        "completed_trail_ids": completed_trail_ids,
        "followed_liked_trail_ids": followed_liked_trail_ids,
    }


def _compute_ideal_difficulty(user):
    """Determine ideal difficulty based on user's recent daily activity distances.

    - avg < 3 km/day -> easy
    - avg 3-8 km/day -> moderate
    - avg > 8 km/day -> hard
    """
    from apps.activities.models import DailyActivitySummary

    cutoff = timezone.now().date() - timedelta(days=30)
    summaries = DailyActivitySummary.objects.filter(
        user=user,
        date__gte=cutoff,
    ).values_list("total_distance_km", flat=True)

    distances = list(summaries)
    if not distances:
        return "easy"

    avg_km = float(sum(distances)) / len(distances)
    if avg_km < 3:
        return "easy"
    elif avg_km <= 8:
        return "moderate"
    else:
        return "hard"


def _score_trail(trail, profile, current_season, max_like_count, now):
    """Compute a composite score (0.0 - 1.0) for a single trail.

    Returns (score, primary_reason_key, reason_context).
    """
    scores = {}
    reason_key = "popular"  # default fallback reason
    reason_context = {}

    # ── 1. Preference match (40%) ────────────────────────────────────
    pref_score = 0.0
    total_likes = sum(profile["difficulty_dist"].values()) or 1

    # Difficulty preference (1/3 of preference weight)
    diff_match = profile["difficulty_dist"].get(trail.difficulty, 0) / total_likes
    pref_score += diff_match * 0.33

    # Trail type preference (1/3 of preference weight)
    type_match = profile["type_dist"].get(trail.trail_type, 0) / total_likes
    pref_score += type_match * 0.33

    # Country preference (1/3 of preference weight)
    country_match = profile["country_dist"].get(trail.country, 0) / total_likes
    pref_score += country_match * 0.33

    scores["preference"] = min(pref_score, 1.0)

    # Track strongest preference reason
    if type_match >= diff_match and type_match >= country_match and type_match > 0:
        reason_key = "preference_type"
        reason_context["trail_type"] = trail.trail_type
    elif country_match > 0:
        reason_key = "preference_country"

    # ── 2. Difficulty fit (15%) ──────────────────────────────────────
    ideal = profile["ideal_difficulty"]
    if trail.difficulty == ideal:
        scores["difficulty"] = 1.0
        if scores.get("preference", 0) < 0.3:
            reason_key = "difficulty_fit"
    elif (
        (ideal == "easy" and trail.difficulty == "moderate")
        or (ideal == "moderate" and trail.difficulty in ("easy", "hard"))
        or (ideal == "hard" and trail.difficulty == "moderate")
    ):
        scores["difficulty"] = 0.5
    else:
        scores["difficulty"] = 0.1

    # ── 3. Seasonal fit (10%) ───────────────────────────────────────
    if trail.best_season == current_season or trail.best_season == "all":
        scores["seasonal"] = 1.0
        if scores.get("preference", 0) < 0.2 and scores.get("difficulty", 0) < 0.8:
            reason_key = "seasonal"
    elif trail.best_season == "rainy_ok" and current_season == "summer":
        scores["seasonal"] = 0.7
    else:
        scores["seasonal"] = 0.1

    # ── 4. Social boost (10%) ───────────────────────────────────────
    if trail.id in profile["followed_liked_trail_ids"]:
        scores["social"] = 1.0
        # Social is a strong signal — upgrade reason if preference is weak
        if scores.get("preference", 0) < 0.4:
            reason_key = "social"
    else:
        scores["social"] = 0.0

    # ── 5. Image boost (5%) ─────────────────────────────────────────
    has_image = bool(trail.cover_image) or bool(trail.thumbnail_url)
    scores["image"] = 1.0 if has_image else 0.0

    # ── 6. Freshness (5%) ──────────────────────────────────────────
    age_days = (now - trail.created_at).days
    if age_days <= 7:
        scores["freshness"] = 1.0
        if scores.get("preference", 0) < 0.2:
            reason_key = "fresh"
    elif age_days <= 30:
        scores["freshness"] = 0.5
    else:
        scores["freshness"] = 0.0

    # ── 7. Popularity (15%) ────────────────────────────────────────
    if max_like_count > 0:
        scores["popularity"] = min(trail.like_count / max_like_count, 1.0)
    else:
        scores["popularity"] = 0.0

    if scores.get("popularity", 0) > 0.8 and scores.get("preference", 0) < 0.2:
        reason_key = "popular"

    # ── Composite ───────────────────────────────────────────────────
    total_score = (
        scores.get("preference", 0) * WEIGHT_PREFERENCE
        + scores.get("difficulty", 0) * WEIGHT_DIFFICULTY
        + scores.get("seasonal", 0) * WEIGHT_SEASONAL
        + scores.get("social", 0) * WEIGHT_SOCIAL
        + scores.get("image", 0) * WEIGHT_IMAGE
        + scores.get("freshness", 0) * WEIGHT_FRESHNESS
        + scores.get("popularity", 0) * WEIGHT_POPULARITY
    )

    # Small bonus for official trails
    if trail.is_official:
        total_score += 0.03
        if reason_key == "popular":
            reason_key = "official"

    return total_score, reason_key, reason_context


def _get_reason_text(reason_key, reason_context, language="ko"):
    """Return the localized recommendation reason string."""
    templates = REASON_STRINGS.get(reason_key, REASON_STRINGS["popular"])
    template = templates.get(language, templates["ko"])

    if reason_key == "preference_type" and "trail_type" in reason_context:
        trail_type = reason_context["trail_type"]
        type_names = TRAIL_TYPE_DISPLAY.get(trail_type, {})
        type_name = type_names.get(language, type_names.get("ko", trail_type))
        return template.format(type_name=type_name)

    return template


def get_personalized_recommendations(user, limit=10):
    """Score and rank trails for a specific authenticated user.

    Returns a list of dicts: [{"trail": Trail, "score": float,
    "reason_key": str, "reasons": {ko, en, ja, zh}}]

    Results are cached per user for 5 minutes.
    """
    cache_key = f"trail_reco:user:{user.id}:limit:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    profile = _build_user_profile(user)
    now = timezone.now()
    current_season = _get_current_season()

    # Exclude completed + liked + hidden/unapproved trails
    exclude_ids = profile["liked_trail_ids"] | profile["completed_trail_ids"]

    # Fetch candidate trails — limit to a reasonable pool
    candidates = list(
        Trail.objects.filter(
            status="approved",
            is_hidden=False,
        ).exclude(
            id__in=exclude_ids,
        ).select_related("author").prefetch_related("tags")[:200]
    )

    if not candidates:
        # Fallback: return popular approved trails (ignoring exclusions)
        candidates = list(
            Trail.objects.filter(
                status="approved",
                is_hidden=False,
            ).select_related("author").prefetch_related("tags")
            .order_by("-like_count")[:limit]
        )
        results = [
            {
                "trail": t,
                "score": 0.0,
                "reason_key": "popular",
                "reasons": {
                    lang: _get_reason_text("popular", {}, lang)
                    for lang in ("ko", "en", "ja", "zh")
                },
            }
            for t in candidates
        ]
        cache.set(cache_key, results, timeout=300)
        return results

    # Compute max like_count for normalization
    max_like_count = max((t.like_count for t in candidates), default=1) or 1

    # Score all candidates
    scored = []
    for trail in candidates:
        score, reason_key, reason_ctx = _score_trail(
            trail, profile, current_season, max_like_count, now,
        )
        scored.append((score, trail, reason_key, reason_ctx))

    # Sort by score descending, take top N
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:limit]

    # Determine user language for primary reason
    language = getattr(user, "preferred_language", "ko") or "ko"

    results = []
    for score, trail, reason_key, reason_ctx in top:
        results.append({
            "trail": trail,
            "score": round(score, 4),
            "reason_key": reason_key,
            "reasons": {
                lang: _get_reason_text(reason_key, reason_ctx, lang)
                for lang in ("ko", "en", "ja", "zh")
            },
        })

    cache.set(cache_key, results, timeout=300)
    return results


def get_anonymous_recommendations(limit=10):
    """Recommendations for anonymous (unauthenticated) users.

    Uses popularity + seasonal fit + image availability.
    Cached globally for 10 minutes.
    """
    cache_key = f"trail_reco:anon:limit:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    current_season = _get_current_season()
    now = timezone.now()

    candidates = list(
        Trail.objects.filter(
            status="approved",
            is_hidden=False,
        ).select_related("author").prefetch_related("tags")
        .order_by("-like_count")[:100]
    )

    if not candidates:
        return []

    max_like_count = max((t.like_count for t in candidates), default=1) or 1

    scored = []
    for trail in candidates:
        score = 0.0

        # Popularity (50% for anonymous)
        pop = min(trail.like_count / max_like_count, 1.0)
        score += pop * 0.50

        # Seasonal fit (25%)
        if trail.best_season == current_season or trail.best_season == "all":
            score += 1.0 * 0.25
        elif trail.best_season == "rainy_ok" and current_season == "summer":
            score += 0.7 * 0.25
        else:
            score += 0.1 * 0.25

        # Image availability (10%)
        has_image = bool(trail.cover_image) or bool(trail.thumbnail_url)
        if has_image:
            score += 1.0 * 0.10

        # Freshness (10%)
        age_days = (now - trail.created_at).days
        if age_days <= 7:
            score += 1.0 * 0.10
        elif age_days <= 30:
            score += 0.5 * 0.10

        # Official bonus (5%)
        if trail.is_official:
            score += 1.0 * 0.05

        # Determine reason
        if trail.is_official:
            reason_key = "official"
        elif (trail.best_season == current_season or trail.best_season == "all"):
            reason_key = "seasonal"
        else:
            reason_key = "popular"

        scored.append((score, trail, reason_key))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:limit]

    results = []
    for score, trail, reason_key in top:
        results.append({
            "trail": trail,
            "score": round(score, 4),
            "reason_key": reason_key,
            "reasons": {
                lang: _get_reason_text(reason_key, {}, lang)
                for lang in ("ko", "en", "ja", "zh")
            },
        })

    cache.set(cache_key, results, timeout=600)
    return results


# ── Legacy function (kept for backward compat) ──────────────────────

def get_recommendations(user, limit=10):
    """Legacy wrapper — returns a queryset of Trail objects.

    Used by the existing RecommendedTrailsView. Returns just the Trail
    queryset (no scores/reasons) so the old serializer continues to work.
    """
    results = get_personalized_recommendations(user, limit=limit)
    trail_ids = [r["trail"].id for r in results]
    if not trail_ids:
        return Trail.objects.none()
    # Preserve score-based ordering via CASE/WHEN
    from django.db.models import Case, When
    ordering = Case(*[When(pk=pk, then=pos) for pos, pk in enumerate(trail_ids)])
    return (
        Trail.objects.filter(pk__in=trail_ids)
        .select_related("author").prefetch_related("tags")
        .order_by(ordering)
    )
