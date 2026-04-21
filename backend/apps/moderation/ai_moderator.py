"""
AI-powered content moderation using Claude.

Screens user-generated content for policy violations at publish time.
Designed to be non-blocking: on any failure, defaults to 'approve' so
users are never blocked by AI downtime.
"""

import logging
import os

logger = logging.getLogger(__name__)

# System prompt kept concise to minimize token usage.
MODERATION_SYSTEM_PROMPT = (
    "You are a content moderation system for Moru, a Korean walking/hiking community app. "
    "Evaluate the following user-generated content for policy violations.\n\n"
    "Check for:\n"
    "1. spam - Advertising, commercial promotion, unsolicited links\n"
    "2. harassment - Personal attacks, bullying, threats\n"
    "3. hate_speech - Discrimination, slurs, dehumanization\n"
    "4. sexual - Sexually explicit or suggestive content\n"
    "5. personal_info - Phone numbers, addresses, ID numbers exposed\n"
    "6. scam - Phishing, fraud, financial manipulation\n"
    "7. misinformation - Dangerous false claims (e.g., trail safety lies)\n"
    "8. violence - Graphic violence, self-harm promotion\n\n"
    "The content may be in Korean, English, Japanese, or Chinese.\n\n"
    "Respond ONLY with valid JSON (no markdown, no explanation):\n"
    '{"is_safe": bool, "confidence": float 0.0-1.0, '
    '"flags": ["category1", ...], "reason": "brief explanation"}\n\n'
    "If the content is clearly safe, return:\n"
    '{"is_safe": true, "confidence": 0.0, "flags": [], "reason": ""}'
)


def moderate_content(text: str, content_type: str = "post") -> dict:
    """
    Screen text content using Claude for policy violations.

    Args:
        text: The user-generated text to moderate.
        content_type: One of 'post', 'comment', 'story', 'review', 'message'.

    Returns:
        {
            'is_safe': bool,
            'confidence': float,   # 0.0-1.0 (violation confidence)
            'flags': list[str],    # ['spam', 'harassment', ...]
            'reason': str,         # Human-readable explanation
            'action': str,         # 'approve', 'review', 'reject'
        }

    Actions:
        - confidence >= 0.95 violation -> 'reject' (auto-hide)
        - confidence 0.7-0.95 -> 'review' (queue for admin)
        - confidence < 0.7 -> 'approve' (pass through)
    """
    default_result = {
        "is_safe": True,
        "confidence": 0.0,
        "flags": [],
        "reason": "",
        "action": "approve",
    }

    # Guard: empty text
    if not text or not text.strip():
        return default_result

    # Guard: missing API key
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — skipping AI moderation")
        return default_result

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic SDK not installed — skipping AI moderation")
        return default_result

    # Truncate very long text to control costs (first 2000 chars is sufficient)
    truncated = text[:2000]

    user_message = (
        f"Content type: {content_type}\n"
        f"Text:\n---\n{truncated}\n---"
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=MODERATION_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            timeout=10.0,
        )

        # Parse the response
        raw_text = response.content[0].text.strip()
        result = _parse_response(raw_text)
        return result

    except anthropic.APITimeoutError:
        logger.warning("AI moderation timed out for %s — defaulting to approve", content_type)
        return default_result
    except anthropic.APIError as e:
        logger.warning("AI moderation API error for %s: %s — defaulting to approve", content_type, e)
        return default_result
    except Exception as e:
        logger.exception("Unexpected error in AI moderation for %s: %s", content_type, e)
        return default_result


def _parse_response(raw_text: str) -> dict:
    """Parse Claude's JSON response into a moderation result dict."""
    import json

    default_result = {
        "is_safe": True,
        "confidence": 0.0,
        "flags": [],
        "reason": "",
        "action": "approve",
    }

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning("AI moderation returned invalid JSON: %s", raw_text[:200])
        return default_result

    is_safe = data.get("is_safe", True)
    confidence = float(data.get("confidence", 0.0))
    flags = data.get("flags", [])
    reason = data.get("reason", "")

    # Clamp confidence
    confidence = max(0.0, min(1.0, confidence))

    # Determine action based on confidence thresholds
    if is_safe or confidence < 0.7:
        action = "approve"
    elif confidence >= 0.95:
        action = "reject"
    else:
        action = "review"

    return {
        "is_safe": is_safe,
        "confidence": confidence,
        "flags": flags if isinstance(flags, list) else [],
        "reason": str(reason)[:500],
        "action": action,
    }
