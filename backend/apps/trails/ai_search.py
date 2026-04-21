"""
AI-powered natural language trail search.

Uses Claude claude-haiku-4-5-20251001 to parse conversational queries into structured
filters, then builds a Django ORM query to find matching trails.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

# Valid field values for mapping
VALID_DIFFICULTIES = {"easy", "moderate", "hard"}
VALID_TRAIL_TYPES = {"urban", "coastal", "village", "cultural", "nature", "mixed"}
VALID_SEASONS = {"spring", "summer", "fall", "winter", "all", "rainy_ok"}

PARSE_SYSTEM_PROMPT = """You parse trail search queries into JSON filters.
Valid difficulty: easy, moderate, hard
Valid trail_type: urban, coastal, village, cultural, nature, mixed
Valid season: spring, summer, fall, winter, all
Valid country: KR, JP, TW, TH, US, GB, FR, ES (2-letter ISO code)

Respond ONLY with JSON:
{"difficulty":null,"trail_type":null,"min_distance":null,"max_distance":null,"country":null,"region":null,"season":null,"keywords":[]}

Rules:
- null for unspecified fields
- distance in km (float)
- keywords: meaningful search terms from the query (place names, adjectives, features)
- Map time mentions to distance: 1hr~4km, 2hr~8km, 30min~2km
- Map synonyms: beginner/easy=easy, sea/ocean/beach=coastal, city/urban=urban, forest/mountain=nature, village/town=village, temple/history=cultural"""


def parse_search_intent(query: str, language: str = "ko") -> dict:
    """
    Use Claude to parse natural language query into structured filters.

    Input: "조용한 해안길, 3km 이하, 초보자용"
    Output: {
        'difficulty': 'easy',
        'trail_type': 'coastal',
        'max_distance': 3.0,
        'keywords': ['조용한'],
        'country': None,
        'region': None,
        'season': None,
    }
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set. Falling back to keyword search.")
        return _fallback_result(query)

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic package not installed. Falling back to keyword search.")
        return _fallback_result(query)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            timeout=5.0,
            system=PARSE_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"[{language}] {query}"},
            ],
        )

        response_text = ""
        for block in message.content:
            if block.type == "text":
                response_text += block.text

        # Clean markdown fences if present
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [line for line in lines if not line.strip().startswith("```")]
            cleaned = "\n".join(lines)

        parsed = json.loads(cleaned)
        return _validate_parsed(parsed, query)

    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI search response as JSON: %s", e)
        return _fallback_result(query)
    except Exception as e:
        logger.error("AI search intent parsing failed: %s", e)
        return _fallback_result(query)


def _validate_parsed(parsed: dict, original_query: str) -> dict:
    """Validate and sanitize parsed AI output against known field values."""
    result = {
        "difficulty": None,
        "trail_type": None,
        "min_distance": None,
        "max_distance": None,
        "country": None,
        "region": None,
        "season": None,
        "keywords": [],
    }

    difficulty = parsed.get("difficulty")
    if difficulty and difficulty in VALID_DIFFICULTIES:
        result["difficulty"] = difficulty

    trail_type = parsed.get("trail_type")
    if trail_type and trail_type in VALID_TRAIL_TYPES:
        result["trail_type"] = trail_type

    season = parsed.get("season")
    if season and season in VALID_SEASONS:
        result["season"] = season

    country = parsed.get("country")
    if country and isinstance(country, str) and len(country) == 2:
        result["country"] = country.upper()

    region = parsed.get("region")
    if region and isinstance(region, str):
        result["region"] = region

    min_dist = parsed.get("min_distance")
    if min_dist is not None:
        try:
            result["min_distance"] = float(min_dist)
        except (TypeError, ValueError):
            pass

    max_dist = parsed.get("max_distance")
    if max_dist is not None:
        try:
            result["max_distance"] = float(max_dist)
        except (TypeError, ValueError):
            pass

    keywords = parsed.get("keywords", [])
    if isinstance(keywords, list):
        result["keywords"] = [str(k) for k in keywords if k]

    return result


def _fallback_result(query: str) -> dict:
    """Return raw query as keyword search when AI parsing fails."""
    words = query.strip().split()
    return {
        "difficulty": None,
        "trail_type": None,
        "min_distance": None,
        "max_distance": None,
        "country": None,
        "region": None,
        "season": None,
        "keywords": words,
    }


def build_search_queryset(intent: dict):
    """Build a Django ORM queryset from parsed search intent."""
    from django.db.models import Q

    from .models import Trail

    qs = (
        Trail.objects.filter(status="approved", is_hidden=False)
        .select_related("author")
        .prefetch_related("tags")
    )

    if intent.get("difficulty"):
        qs = qs.filter(difficulty=intent["difficulty"])

    if intent.get("trail_type"):
        qs = qs.filter(trail_type=intent["trail_type"])

    if intent.get("season"):
        qs = qs.filter(Q(best_season=intent["season"]) | Q(best_season="all"))

    if intent.get("country"):
        qs = qs.filter(country=intent["country"])

    if intent.get("region"):
        qs = qs.filter(region__icontains=intent["region"])

    if intent.get("min_distance") is not None:
        qs = qs.filter(distance_km__gte=intent["min_distance"])

    if intent.get("max_distance") is not None:
        qs = qs.filter(distance_km__lte=intent["max_distance"])

    # Keyword search on title, description, tags, region
    keywords = intent.get("keywords", [])
    if keywords:
        keyword_q = Q()
        for kw in keywords:
            keyword_q |= (
                Q(title__icontains=kw)
                | Q(description__icontains=kw)
                | Q(region__icontains=kw)
                | Q(tags__name__icontains=kw)
                | Q(tags__name_en__icontains=kw)
                | Q(title_en__icontains=kw)
                | Q(title_ja__icontains=kw)
            )
        qs = qs.filter(keyword_q)

    return qs.distinct().order_by("-like_count", "-created_at")[:20]


def generate_search_summary(
    intent: dict, result_count: int, language: str = "ko"
) -> str:
    """
    Generate a human-friendly search summary using Claude.
    Falls back to a simple template if AI is unavailable.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _template_summary(intent, result_count, language)

    try:
        import anthropic
    except ImportError:
        return _template_summary(intent, result_count, language)

    # Build a compact description of the filters applied
    filter_parts = []
    if intent.get("difficulty"):
        filter_parts.append(f"difficulty={intent['difficulty']}")
    if intent.get("trail_type"):
        filter_parts.append(f"type={intent['trail_type']}")
    if intent.get("season"):
        filter_parts.append(f"season={intent['season']}")
    if intent.get("country"):
        filter_parts.append(f"country={intent['country']}")
    if intent.get("region"):
        filter_parts.append(f"region={intent['region']}")
    if intent.get("max_distance"):
        filter_parts.append(f"max {intent['max_distance']}km")
    if intent.get("min_distance"):
        filter_parts.append(f"min {intent['min_distance']}km")
    if intent.get("keywords"):
        filter_parts.append(f"keywords={','.join(intent['keywords'])}")

    lang_map = {"ko": "Korean", "en": "English", "ja": "Japanese", "zh": "Chinese"}
    target_lang = lang_map.get(language, "Korean")

    prompt = (
        f"Write a 1-sentence friendly search summary in {target_lang}. "
        f"Found {result_count} trail(s). Filters: {', '.join(filter_parts) or 'none'}. "
        f"Be concise and warm. Include the count and key filters. "
        f"Example (Korean): '3개의 해안 코스를 찾았어요 (쉬운 난이도, 3km 이하)'"
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            timeout=5.0,
            messages=[{"role": "user", "content": prompt}],
        )

        for block in message.content:
            if block.type == "text":
                return block.text.strip().strip('"')

        return _template_summary(intent, result_count, language)

    except Exception as e:
        logger.error("AI search summary generation failed: %s", e)
        return _template_summary(intent, result_count, language)


def _template_summary(intent: dict, result_count: int, language: str = "ko") -> str:
    """Simple template-based summary as fallback."""
    if language == "ko":
        parts = []
        if intent.get("trail_type"):
            type_map = {
                "urban": "도심산책",
                "coastal": "해안",
                "village": "마을",
                "cultural": "문화탐방",
                "nature": "자연",
                "mixed": "복합",
            }
            parts.append(type_map.get(intent["trail_type"], intent["trail_type"]))
        if intent.get("difficulty"):
            diff_map = {"easy": "쉬운", "moderate": "보통", "hard": "도전적인"}
            parts.append(diff_map.get(intent["difficulty"], ""))
        detail = " ".join(parts)
        if detail:
            return f"{result_count}개의 {detail} 코스를 찾았어요"
        return f"{result_count}개의 코스를 찾았어요"
    elif language == "en":
        return f"Found {result_count} trail(s) matching your search"
    elif language == "ja":
        return f"{result_count}件のコースが見つかりました"
    else:
        return f"找到了{result_count}条路线"


def is_ai_search_available() -> bool:
    """Check if AI search is available (API key is configured)."""
    return bool(os.environ.get("ANTHROPIC_API_KEY"))
