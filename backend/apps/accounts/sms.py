"""
SMS sending utility — supports multiple providers.

Providers:
1. Aligo (알리고) — Free 30 SMS for trial, then paid
2. Console mode — prints SMS to log (for testing)

Configure via environment variables:
- ALIGO_API_KEY
- ALIGO_USER_ID
- ALIGO_SENDER (sender phone number)
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)


def send_sms(phone_number: str, message: str) -> tuple[bool, str]:
    """Send SMS via configured provider.

    Returns (success: bool, error_message: str)
    """
    # Try Aligo first if configured
    if os.environ.get('ALIGO_API_KEY') and os.environ.get('ALIGO_USER_ID'):
        return _send_aligo(phone_number, message)

    # Fallback: console mode (for testing without SMS provider)
    logger.info("=" * 60)
    logger.info("[SMS TEST MODE] No provider configured")
    logger.info(f"To: {phone_number}")
    logger.info(f"Message: {message}")
    logger.info("=" * 60)
    return True, ""


def _send_aligo(phone_number: str, message: str) -> tuple[bool, str]:
    """Send SMS via Aligo (Korean SMS provider).

    https://smartsms.aligo.in/admin/api/spec.html
    """
    api_key = os.environ.get('ALIGO_API_KEY', '')
    user_id = os.environ.get('ALIGO_USER_ID', '')
    sender = os.environ.get('ALIGO_SENDER', '')

    # Strip non-digits from phone number for Aligo (Korean format)
    receiver = phone_number.replace('+82', '0').replace('-', '').replace(' ', '')

    try:
        resp = requests.post(
            'https://apis.aligo.in/send/',
            data={
                'key': api_key,
                'user_id': user_id,
                'sender': sender,
                'receiver': receiver,
                'msg': message,
                'msg_type': 'SMS',
            },
            timeout=10,
        )
        data = resp.json()
        if data.get('result_code') == '1':
            logger.info(f"Aligo SMS sent successfully to {receiver}")
            return True, ""
        else:
            error = data.get('message', 'Unknown error')
            logger.warning(f"Aligo SMS failed: {error}")
            return False, error
    except Exception as e:
        logger.exception("Aligo SMS exception")
        return False, str(e)
