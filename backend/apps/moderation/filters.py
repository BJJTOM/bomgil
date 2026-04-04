import re

from django.conf import settings

# Default banned words (extend as needed)
BANNED_WORDS = [
    "광고", "홍보", "판매", "클릭", "무료상담",
    "대출", "카지노", "도박",
]

# Spam patterns
SPAM_PATTERNS = [
    r"https?://\S+",  # URLs (flag for review)
    r"(\d{3}[-.]?\d{4}[-.]?\d{4})",  # Phone numbers
]


def check_banned_words(text: str) -> list[str]:
    """Check text against banned word list. Returns list of found words."""
    text_lower = text.lower()
    found = []
    for word in BANNED_WORDS:
        if word in text_lower:
            found.append(word)
    return found


def check_spam_patterns(text: str) -> list[str]:
    """Check text for spam patterns. Returns list of matched patterns."""
    matches = []
    for pattern in SPAM_PATTERNS:
        if re.search(pattern, text):
            matches.append(pattern)
    return matches


def auto_moderate_text(text: str) -> tuple[bool, str]:
    """
    Auto-moderate text content.
    Returns (should_flag, reason).
    """
    banned = check_banned_words(text)
    if banned:
        return True, f"금칙어 감지: {', '.join(banned)}"

    spam = check_spam_patterns(text)
    if spam:
        return True, "스팸 패턴 감지 (URL 또는 전화번호 포함)"

    return False, ""


def check_user_spam(user, model_class, minutes=10, max_count=5) -> bool:
    """
    Check if a user is creating content too fast (spam detection).
    Returns True if spam suspected.
    """
    from django.utils import timezone
    from datetime import timedelta

    recent_count = model_class.objects.filter(
        author=user,
        created_at__gte=timezone.now() - timedelta(minutes=minutes),
    ).count()
    return recent_count >= max_count
