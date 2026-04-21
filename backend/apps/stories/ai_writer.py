"""
AI-powered story generation for walk stories.

Expands brief user notes into natural, personal-feeling walking stories
using Claude. Designed to be non-blocking: on any failure, returns an
empty result so the user can still write manually.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

# Mood-specific guidance for the AI to generate sensory, tonal details.
MOOD_GUIDES = {
    "happy": "밝고 경쾌한 톤. 햇살, 미소, 설렘 같은 긍정적 감각 표현을 넣어주세요.",
    "peaceful": "차분하고 고요한 톤. 바람 소리, 나뭇잎, 물소리 같은 자연의 평화로운 감각을 담아주세요.",
    "exciting": "에너지 넘치고 생동감 있는 톤. 심장 뛰는 느낌, 빠른 호흡, 새로운 발견의 흥분을 표현해주세요.",
    "touching": "따뜻하고 감성적인 톤. 그리움, 감사함, 소중한 순간의 여운을 담아주세요.",
    "funny": "유쾌하고 위트 있는 톤. 웃긴 에피소드나 귀여운 장면을 자연스럽게 녹여주세요.",
}

MOOD_LABELS = {
    "happy": "즐거움",
    "peaceful": "평화로움",
    "exciting": "신남",
    "touching": "감동",
    "funny": "재미",
}

SYSTEM_PROMPT = (
    "당신은 걷기 앱 '모루'의 사용자를 대신해 걷기 이야기를 작성하는 작가입니다.\n"
    "사용자가 남긴 짧은 메모를 바탕으로, 마치 본인이 직접 쓴 것처럼 자연스러운 "
    "1인칭 이야기를 만들어주세요.\n\n"
    "규칙:\n"
    "- 절대 AI가 쓴 느낌이 나면 안 됩니다. 친구에게 카톡하듯 편하게 쓰세요.\n"
    "- 기업 블로그나 광고 문구 같은 딱딱한 표현은 피하세요.\n"
    "- 사용자의 원래 메모에 담긴 표현과 어투를 최대한 살려주세요.\n"
    "- 감각적 묘사(보이는 것, 들리는 것, 느끼는 것)를 자연스럽게 넣어주세요.\n"
    "- 응답은 반드시 유효한 JSON으로만 하세요. 마크다운이나 설명 없이 JSON만 출력하세요.\n"
)


def generate_story(
    trail_title: str,
    distance_km: float,
    mood: str,
    user_notes: str,
    language: str = "ko",
    photo_count: int = 0,
) -> dict:
    """
    Generate a walking story from minimal user input.

    Args:
        trail_title: Name of the trail walked
        distance_km: Distance covered
        mood: One of 'happy', 'peaceful', 'exciting', 'touching', 'funny'
        user_notes: Brief user input (1-2 sentences)
        language: Target language ('ko', 'en', 'ja', 'zh')
        photo_count: Number of photos attached

    Returns:
        {
            'content': str,           # 300-500 char story in target language
            'title_suggestion': str,   # Optional catchy title
        }
        Returns empty dict on failure.
    """
    default_result = {}

    # Guard: missing API key
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — skipping AI story generation")
        return default_result

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic SDK not installed — skipping AI story generation")
        return default_result

    # Build the mood guidance
    mood_guide = MOOD_GUIDES.get(mood, MOOD_GUIDES["happy"])
    mood_label = MOOD_LABELS.get(mood, "즐거움")

    # Language instructions
    lang_instructions = {
        "ko": "한국어로 작성하세요. 300~500자 (한국어 글자 기준).",
        "en": "Write in English. 150-250 words.",
        "ja": "日本語で書いてください。300〜500文字。",
        "zh": "用中文写。300-500个字。",
    }
    lang_instruction = lang_instructions.get(language, lang_instructions["ko"])

    # Build context about the walk
    walk_context_parts = []
    if trail_title:
        walk_context_parts.append(f"코스 이름: {trail_title}")
    if distance_km and distance_km > 0:
        walk_context_parts.append(f"거리: {distance_km}km")
    walk_context_parts.append(f"기분: {mood_label}")
    if photo_count > 0:
        walk_context_parts.append(f"사진 {photo_count}장을 찍었음")

    walk_context = "\n".join(walk_context_parts)

    # Build user notes section
    notes_section = ""
    if user_notes and user_notes.strip():
        notes_section = f"\n사용자 메모:\n\"{user_notes.strip()}\""
    else:
        notes_section = "\n사용자 메모: (없음 — 걷기 정보만으로 이야기를 만들어주세요)"

    user_message = f"""아래 정보를 바탕으로 걷기 이야기를 작성해주세요.

걷기 정보:
{walk_context}
{notes_section}

분위기 가이드: {mood_guide}

{lang_instruction}

응답 형식 (JSON만):
{{"content": "이야기 본문", "title_suggestion": "짧은 제목 제안"}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            timeout=15.0,
        )

        # Extract text content
        raw_text = ""
        for block in response.content:
            if block.type == "text":
                raw_text += block.text

        # Parse JSON — handle possible markdown wrapping
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [line for line in lines if not line.strip().startswith("```")]
            cleaned = "\n".join(lines)

        result = json.loads(cleaned)

        # Validate result
        content = result.get("content", "")
        title_suggestion = result.get("title_suggestion", "")

        if not content:
            logger.warning("AI story generation returned empty content")
            return default_result

        return {
            "content": str(content).strip(),
            "title_suggestion": str(title_suggestion).strip(),
        }

    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI story response as JSON: %s", e)
        return default_result
    except Exception as e:
        logger.error("AI story generation failed: %s", e)
        return default_result
