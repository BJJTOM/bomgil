"""
AI-powered weekly activity coaching for Moru users.

Generates personalized weekly insights by analyzing the user's last 14 days
of DailyActivitySummary data (this week + last week for comparison), then
optionally uses Claude claude-haiku-4-5-20251001 to produce natural-language coaching in the
user's preferred language.

Falls back to a fully rule-based generator when ANTHROPIC_API_KEY is not set.
"""

import calendar
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from django.conf import settings
from django.db.models import Avg, Max, Sum
from django.utils import timezone

from .models import ActivityTrack, DailyActivitySummary

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Translations for rule-based fallback
# ---------------------------------------------------------------------------
_T = {
    "summary": {
        "ko": "이번 주 {dist}km 걸으셨어요! {comparison}",
        "en": "You walked {dist}km this week! {comparison}",
        "ja": "今週は{dist}km歩きました！ {comparison}",
        "zh": "本周走了{dist}km！ {comparison}",
    },
    "comparison_up": {
        "ko": "지난주 대비 {pct}% 증가",
        "en": "{pct}% more than last week",
        "ja": "先週より{pct}%アップ",
        "zh": "比上周增加了{pct}%",
    },
    "comparison_down": {
        "ko": "지난주 대비 {pct}% 감소",
        "en": "{pct}% less than last week",
        "ja": "先週より{pct}%ダウン",
        "zh": "比上周减少了{pct}%",
    },
    "comparison_same": {
        "ko": "지난주와 비슷한 수준이에요",
        "en": "Similar to last week",
        "ja": "先週と同じくらいです",
        "zh": "和上周差不多",
    },
    "comparison_no_prev": {
        "ko": "첫 주 기록이에요! 좋은 시작이에요",
        "en": "Your first week! Great start",
        "ja": "最初の1週間です！良いスタートです",
        "zh": "第一周的记录！好的开始",
    },
    "goal_reached": {
        "ko": "주간 목표를 달성했어요! 대단해요!",
        "en": "You reached your weekly goal! Amazing!",
        "ja": "週間目標を達成しました！すごい！",
        "zh": "达到了周目标！太棒了！",
    },
    "goal_almost": {
        "ko": "목표까지 {remaining}km 남았어요. 조금만 더 힘내세요!",
        "en": "Only {remaining}km to your goal. You're almost there!",
        "ja": "目標まであと{remaining}km。もう少しです！",
        "zh": "距目标还差{remaining}km，加油！",
    },
    "best_day": {
        "ko": "{day}에 최장 거리 {dist}km 기록!",
        "en": "Best distance on {day}: {dist}km!",
        "ja": "{day}に最長距離{dist}km記録！",
        "zh": "{day}走了最远的{dist}km！",
    },
    "pace_improved": {
        "ko": "평균 페이스가 {pct}% 향상됐어요",
        "en": "Average pace improved by {pct}%",
        "ja": "平均ペースが{pct}%向上しました",
        "zh": "平均配速提升了{pct}%",
    },
    "streak": {
        "ko": "{days}일 연속 걷기 중! 꾸준함이 힘이에요",
        "en": "{days}-day walking streak! Consistency is key",
        "ja": "{days}日連続ウォーキング中！継続は力なり",
        "zh": "连续走了{days}天！坚持就是力量",
    },
    "steps_highlight": {
        "ko": "이번 주 총 {steps:,}보를 걸었어요",
        "en": "You took {steps:,} steps this week",
        "ja": "今週は合計{steps:,}歩歩きました",
        "zh": "本周共走了{steps:,}步",
    },
    "try_trail": {
        "ko": "이번 주말 '{trail}'에 도전해보세요",
        "en": "Try '{trail}' this weekend",
        "ja": "今週末は『{trail}』に挑戦してみましょう",
        "zh": "这个周末试试'{trail}'",
    },
    "no_activity": {
        "ko": "이번 주는 아직 활동 기록이 없어요. 가볍게 산책부터 시작해볼까요?",
        "en": "No activity yet this week. How about starting with a light walk?",
        "ja": "今週はまだ活動記録がありません。軽い散歩から始めてみませんか？",
        "zh": "本周还没有活动记录。从轻松散步开始怎么样？",
    },
    "suggestion_rest": {
        "ko": "이번 주는 회복에 집중하면서, 가벼운 산책으로 몸을 풀어보세요",
        "en": "Focus on recovery this week with a light walk",
        "ja": "今週は回復に集中して、軽い散歩で体をほぐしましょう",
        "zh": "这周注重恢复，来一次轻松的散步吧",
    },
    "suggestion_push": {
        "ko": "좋은 흐름이에요! 조금 더 긴 코스에 도전해보는 건 어떨까요?",
        "en": "Great momentum! How about trying a longer trail?",
        "ja": "良い調子です！もう少し長いコースに挑戦してみませんか？",
        "zh": "状态不错！试试更长的路线怎么样？",
    },
}

DAY_NAMES = {
    "ko": ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"],
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "ja": ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"],
    "zh": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
}


def _get_season() -> str:
    """Return the current season string for trail matching."""
    month = timezone.now().month
    if month in (3, 4, 5):
        return "spring"
    elif month in (6, 7, 8):
        return "summer"
    elif month in (9, 10, 11):
        return "fall"
    return "winter"


def _lang(user) -> str:
    """Get user's preferred language, defaulting to 'ko'."""
    return getattr(user, "preferred_language", "ko") or "ko"


def _t(key: str, lang: str, **kwargs) -> str:
    """Lookup a translated template and format it."""
    templates = _T.get(key, {})
    template = templates.get(lang, templates.get("ko", key))
    try:
        return template.format(**kwargs)
    except (KeyError, ValueError):
        return template


def _day_name(d: date, lang: str) -> str:
    """Return localized weekday name."""
    names = DAY_NAMES.get(lang, DAY_NAMES["ko"])
    return names[d.weekday()]


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------

def _gather_data(user) -> dict:
    """
    Fetch 14 days of DailyActivitySummary (this week + last week).
    Returns structured data for analysis.
    """
    today = timezone.now().date()
    # "This week" = last 7 days including today
    this_week_start = today - timedelta(days=6)
    last_week_start = this_week_start - timedelta(days=7)

    all_summaries = list(
        DailyActivitySummary.objects.filter(
            user=user,
            date__gte=last_week_start,
            date__lte=today,
        ).order_by("date")
    )

    this_week = [s for s in all_summaries if s.date >= this_week_start]
    last_week = [s for s in all_summaries if s.date < this_week_start]

    # Aggregate this week
    tw_distance = sum(float(s.total_distance_km or 0) for s in this_week)
    tw_steps = sum(s.total_steps or 0 for s in this_week)
    tw_duration = sum(s.total_duration_minutes or 0 for s in this_week)
    tw_calories = sum(s.total_calories or 0 for s in this_week)
    tw_tracks = sum(s.track_count or 0 for s in this_week)

    # Aggregate last week
    lw_distance = sum(float(s.total_distance_km or 0) for s in last_week)
    lw_steps = sum(s.total_steps or 0 for s in last_week)
    lw_duration = sum(s.total_duration_minutes or 0 for s in last_week)

    # Best day this week
    best_day = None
    best_day_dist = 0
    for s in this_week:
        d = float(s.total_distance_km or 0)
        if d > best_day_dist:
            best_day_dist = d
            best_day = s.date

    # Average pace this week vs last week (from ActivityTrack)
    tw_avg_pace = (
        ActivityTrack.objects.filter(
            user=user,
            is_hidden=False,
            started_at__date__gte=this_week_start,
            started_at__date__lte=today,
            avg_pace_min_km__isnull=False,
        ).aggregate(avg=Avg("avg_pace_min_km"))["avg"]
    )
    lw_avg_pace = (
        ActivityTrack.objects.filter(
            user=user,
            is_hidden=False,
            started_at__date__gte=last_week_start,
            started_at__date__lt=this_week_start,
            avg_pace_min_km__isnull=False,
        ).aggregate(avg=Avg("avg_pace_min_km"))["avg"]
    )

    # Streak calculation
    summary_dates = set(
        DailyActivitySummary.objects.filter(
            user=user, track_count__gt=0,
        ).values_list("date", flat=True)
    )
    current_streak = 0
    cursor = today
    while cursor in summary_dates:
        current_streak += 1
        cursor -= timedelta(days=1)

    # Weekly goal
    weekly_goal_km = float(getattr(user, "weekly_goal_km", 20) or 20)

    return {
        "this_week": this_week,
        "last_week": last_week,
        "tw_distance": round(tw_distance, 1),
        "tw_steps": tw_steps,
        "tw_duration": tw_duration,
        "tw_calories": tw_calories,
        "tw_tracks": tw_tracks,
        "lw_distance": round(lw_distance, 1),
        "lw_steps": lw_steps,
        "lw_duration": lw_duration,
        "tw_avg_pace": float(tw_avg_pace) if tw_avg_pace else None,
        "lw_avg_pace": float(lw_avg_pace) if lw_avg_pace else None,
        "best_day": best_day,
        "best_day_dist": round(best_day_dist, 1),
        "current_streak": current_streak,
        "weekly_goal_km": weekly_goal_km,
        "today": today,
    }


# ---------------------------------------------------------------------------
# Trail suggestion
# ---------------------------------------------------------------------------

def _suggest_trail(user, data: dict) -> Optional[dict]:
    """
    Suggest a trail the user hasn't completed yet,
    matching their recent difficulty level and current season.
    Returns {'id': int, 'title': str} or None.
    """
    from apps.trails.models import Trail, TrailCompletion

    # Determine user's typical difficulty from recent activities
    recent_tracks = ActivityTrack.objects.filter(
        user=user,
        is_hidden=False,
        trail__isnull=False,
    ).select_related("trail").order_by("-started_at")[:10]

    difficulties = [t.trail.difficulty for t in recent_tracks if t.trail]
    if difficulties:
        # Most common difficulty
        from collections import Counter
        preferred_diff = Counter(difficulties).most_common(1)[0][0]
    else:
        # Default: easy for new users
        preferred_diff = "easy"

    # Get completed trail IDs
    completed_ids = set(
        TrailCompletion.objects.filter(user=user).values_list("trail_id", flat=True)
    )

    # Find matching trails: season match + difficulty match + not completed
    season = _get_season()
    from django.db.models import Q
    candidates = (
        Trail.objects.filter(
            Q(best_season=season) | Q(best_season="all"),
            status="approved",
            is_hidden=False,
            difficulty=preferred_diff,
        )
        .exclude(id__in=completed_ids)
        .order_by("-like_count")[:5]
    )

    if not candidates:
        # Broaden: any approved trail not completed
        candidates = (
            Trail.objects.filter(status="approved", is_hidden=False)
            .exclude(id__in=completed_ids)
            .order_by("-like_count")[:5]
        )

    trail = candidates.first()
    if trail:
        return {"id": trail.id, "title": trail.title}
    return None


# ---------------------------------------------------------------------------
# Rule-based insights (no LLM)
# ---------------------------------------------------------------------------

def _generate_rule_based(user, data: dict) -> dict:
    """Generate coaching insights using templates only (no API call)."""
    lang = _lang(user)

    # Handle no-activity case
    if data["tw_distance"] == 0 and data["tw_steps"] == 0:
        suggested = _suggest_trail(user, data)
        suggestion_text = ""
        if suggested:
            suggestion_text = _t("try_trail", lang, trail=suggested["title"])
        else:
            suggestion_text = _t("suggestion_push", lang)

        return {
            "summary": _t("no_activity", lang),
            "highlights": [],
            "suggestion": suggestion_text,
            "suggested_trail_id": suggested["id"] if suggested else None,
            "goal_progress": 0.0,
            "trend": "stable",
        }

    # Comparison text
    if data["lw_distance"] > 0:
        pct_change = round(
            ((data["tw_distance"] - data["lw_distance"]) / data["lw_distance"]) * 100
        )
        if pct_change > 5:
            comparison = _t("comparison_up", lang, pct=abs(pct_change))
        elif pct_change < -5:
            comparison = _t("comparison_down", lang, pct=abs(pct_change))
        else:
            comparison = _t("comparison_same", lang)
    else:
        pct_change = 0
        comparison = _t("comparison_no_prev", lang)

    summary = _t("summary", lang, dist=data["tw_distance"], comparison=comparison)

    # Highlights
    highlights = []

    if data["best_day"] and data["best_day_dist"] > 0:
        day_name = _day_name(data["best_day"], lang)
        highlights.append(
            _t("best_day", lang, day=day_name, dist=data["best_day_dist"])
        )

    if data["tw_avg_pace"] and data["lw_avg_pace"]:
        # Lower pace = faster = improved
        if data["lw_avg_pace"] > data["tw_avg_pace"]:
            pace_pct = round(
                ((data["lw_avg_pace"] - data["tw_avg_pace"]) / data["lw_avg_pace"]) * 100
            )
            if pace_pct > 2:
                highlights.append(_t("pace_improved", lang, pct=pace_pct))

    if data["current_streak"] >= 3:
        highlights.append(_t("streak", lang, days=data["current_streak"]))

    if data["tw_steps"] > 0:
        highlights.append(_t("steps_highlight", lang, steps=data["tw_steps"]))

    # Goal progress
    goal_progress = min(1.0, data["tw_distance"] / data["weekly_goal_km"]) if data["weekly_goal_km"] > 0 else 0.0

    if goal_progress >= 1.0:
        highlights.insert(0, _t("goal_reached", lang))
    elif goal_progress >= 0.7:
        remaining = round(data["weekly_goal_km"] - data["tw_distance"], 1)
        highlights.append(_t("goal_almost", lang, remaining=remaining))

    # Trend
    if data["lw_distance"] > 0:
        if pct_change > 5:
            trend = "improving"
        elif pct_change < -5:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "improving" if data["tw_distance"] > 0 else "stable"

    # Suggestion
    suggested = _suggest_trail(user, data)
    if suggested:
        suggestion = _t("try_trail", lang, trail=suggested["title"])
    elif trend == "declining":
        suggestion = _t("suggestion_rest", lang)
    else:
        suggestion = _t("suggestion_push", lang)

    return {
        "summary": summary,
        "highlights": highlights[:5],  # Cap at 5
        "suggestion": suggestion,
        "suggested_trail_id": suggested["id"] if suggested else None,
        "goal_progress": round(goal_progress, 2),
        "trend": trend,
    }


# ---------------------------------------------------------------------------
# LLM-powered insights
# ---------------------------------------------------------------------------

def _generate_llm_insights(user, data: dict) -> Optional[dict]:
    """
    Call Claude claude-haiku-4-5-20251001 to generate natural-language coaching insights.
    Returns None if the API call fails (caller falls back to rule-based).
    """
    api_key = getattr(settings, "ANTHROPIC_API_KEY", None)
    if not api_key:
        api_key = __import__("os").environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic package not installed; skipping LLM insights")
        return None

    lang = _lang(user)
    lang_name = {"ko": "Korean", "en": "English", "ja": "Japanese", "zh": "Chinese"}.get(lang, "Korean")

    # Build context for the LLM
    goal_progress = min(1.0, data["tw_distance"] / data["weekly_goal_km"]) if data["weekly_goal_km"] > 0 else 0.0

    # Determine suggested trail first (we'll pass info to LLM)
    suggested = _suggest_trail(user, data)
    trail_suggestion_context = ""
    if suggested:
        trail_suggestion_context = f"Suggested trail: '{suggested['title']}' (ID: {suggested['id']})"

    prompt = f"""You are a personal walking/hiking coach for the Moru app. Generate a weekly activity report for this user.

USER DATA (last 7 days):
- Distance walked: {data['tw_distance']}km
- Steps: {data['tw_steps']:,}
- Duration: {data['tw_duration']} minutes
- Calories burned: {data['tw_calories']}
- Number of walks: {data['tw_tracks']}
- Best day: {_day_name(data['best_day'], 'en') if data['best_day'] else 'N/A'} ({data['best_day_dist']}km)
- Current streak: {data['current_streak']} days
- Weekly goal: {data['weekly_goal_km']}km (progress: {round(goal_progress * 100)}%)

PREVIOUS WEEK:
- Distance: {data['lw_distance']}km
- Steps: {data['lw_steps']:,}

PACE:
- This week avg: {data['tw_avg_pace'] or 'N/A'} min/km
- Last week avg: {data['lw_avg_pace'] or 'N/A'} min/km

{trail_suggestion_context}

INSTRUCTIONS:
1. Write all text in {lang_name}
2. Be warm, personal, and motivating — like a friendly coach, not a robot
3. Keep it concise — each highlight should be one short sentence
4. Reference specific numbers from the data
5. If they improved, celebrate it. If they declined, be encouraging, not critical.

Respond with EXACTLY this JSON structure (no markdown, no code blocks):
{{
  "summary": "One sentence summarizing the week with key number and comparison to last week",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "suggestion": "One actionable suggestion for next week"
}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        text = response.content[0].text.strip()
        # Handle potential markdown code block wrapping
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        result = json.loads(text)

        # Determine trend from data
        if data["lw_distance"] > 0:
            pct_change = ((data["tw_distance"] - data["lw_distance"]) / data["lw_distance"]) * 100
            if pct_change > 5:
                trend = "improving"
            elif pct_change < -5:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "improving" if data["tw_distance"] > 0 else "stable"

        return {
            "summary": result.get("summary", ""),
            "highlights": result.get("highlights", [])[:5],
            "suggestion": result.get("suggestion", ""),
            "suggested_trail_id": suggested["id"] if suggested else None,
            "goal_progress": round(goal_progress, 2),
            "trend": trend,
        }

    except Exception as e:
        logger.warning("LLM insight generation failed: %s", e)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_weekly_insights(user) -> dict:
    """
    Analyze user's last 7 days of activity and generate coaching insights.

    Returns: {
        'summary': str,           # "이번 주 12.5km 걸으셨어요! 지난주 대비 23% 증가"
        'highlights': list[str],  # ["화요일 최장 거리 기록!", "평균 페이스 8% 향상"]
        'suggestion': str,        # "이번 주말 제주올레 1코스에 도전해보세요"
        'suggested_trail_id': int | None,
        'goal_progress': float,   # 0.0-1.0 of weekly_goal_km
        'trend': str,             # 'improving', 'stable', 'declining'
    }
    """
    data = _gather_data(user)

    # Try LLM first, fall back to rule-based
    result = _generate_llm_insights(user, data)
    if result:
        return result

    return _generate_rule_based(user, data)
