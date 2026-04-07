import logging

import requests
from django.conf import settings

from .models import Notification

logger = logging.getLogger(__name__)


def send_push(user, title, body, data=None):
    """Send FCM push notification to a user.

    Uses the FCM legacy HTTP API. Requires FCM_SERVER_KEY in Django settings.
    If the key is missing or the user has no FCM token, silently skips.
    """
    server_key = getattr(settings, 'FCM_SERVER_KEY', '')
    if not server_key or not user.fcm_token:
        return None

    headers = {
        'Authorization': f'key={server_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'to': user.fcm_token,
        'notification': {
            'title': title,
            'body': body,
            'sound': 'default',
        },
    }
    if data:
        payload['data'] = data

    try:
        resp = requests.post(
            'https://fcm.googleapis.com/fcm/send',
            json=payload,
            headers=headers,
            timeout=5,
        )
        if resp.status_code != 200:
            logger.warning('FCM push failed: status=%s body=%s', resp.status_code, resp.text[:200])
        return resp
    except requests.RequestException as e:
        logger.warning('FCM push error: %s', e)
        return None


def create_notification(user, actor, title, body, notification_type, target_type=None, target_id=None):
    """Create a Notification record and send a push notification.

    Does not create a notification if actor == user (no self-notifications).
    """
    if actor and actor.pk == user.pk:
        return None

    notif = Notification.objects.create(
        user=user,
        actor=actor,
        title=title,
        body=body,
        notification_type=notification_type,
        target_type=target_type,
        target_id=target_id,
    )

    # Fire-and-forget push
    data = {}
    if target_type:
        data['target_type'] = target_type
    if target_id:
        data['target_id'] = str(target_id)
    send_push(user, title, body, data=data or None)

    return notif
