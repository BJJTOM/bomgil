"""Push notification helpers using Firebase Admin SDK (FCM v1 API).

Initialises the Firebase app lazily on first use. If credentials are
missing (no GOOGLE_APPLICATION_CREDENTIALS env var and no explicit
service-account JSON), all send_push() calls gracefully return False
and log a warning once.

All push sends run in daemon threads so they never block the Django
request/response cycle.
"""

import logging
import os
import threading

from django.conf import settings

from .models import Notification

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Firebase initialisation (lazy, thread-safe)
# ---------------------------------------------------------------------------
_firebase_app = None
_firebase_init_lock = threading.Lock()
_firebase_unavailable = False  # set True after first failed init attempt


def _get_firebase_app():
    """Return the default Firebase app, initialising it if needed."""
    global _firebase_app, _firebase_unavailable

    if _firebase_unavailable:
        return None
    if _firebase_app is not None:
        return _firebase_app

    with _firebase_init_lock:
        # Double-check after acquiring the lock
        if _firebase_app is not None:
            return _firebase_app
        if _firebase_unavailable:
            return None

        try:
            import firebase_admin
            from firebase_admin import credentials as fb_credentials

            cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
            fcm_cred_path = getattr(settings, "FCM_CREDENTIALS_PATH", "")
            path = cred_path or fcm_cred_path

            if path and os.path.isfile(path):
                cred = fb_credentials.Certificate(path)
                _firebase_app = firebase_admin.initialize_app(cred)
            else:
                # Try Application Default Credentials (e.g. on GCP)
                _firebase_app = firebase_admin.initialize_app()

            logger.info("Firebase Admin SDK initialised successfully")
            return _firebase_app

        except Exception as exc:
            _firebase_unavailable = True
            logger.warning(
                "Firebase Admin SDK not available — push notifications disabled: %s", exc
            )
            return None


# ---------------------------------------------------------------------------
# Core push sender
# ---------------------------------------------------------------------------

def _do_send_push(user_pk, title, body, data):
    """Actually send the push in a background thread.

    Handles invalid/expired tokens by clearing the user's fcm_token.
    """
    try:
        from firebase_admin import messaging
        from firebase_admin.exceptions import (
            InvalidArgumentError,
            NotFoundError,
        )
    except ImportError:
        logger.warning("firebase-admin not installed, skipping push")
        return

    app = _get_firebase_app()
    if app is None:
        return

    # Re-fetch user to get current fcm_token (avoids stale references)
    from .models import CustomUser
    try:
        user = CustomUser.objects.get(pk=user_pk)
    except CustomUser.DoesNotExist:
        return

    if not user.fcm_token:
        return

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data or {},
        token=user.fcm_token,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(sound="default"),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound="default", badge=1),
            ),
        ),
    )

    try:
        response = messaging.send(message, app=app)
        logger.info("FCM push sent to user=%s message_id=%s", user_pk, response)
    except (InvalidArgumentError, NotFoundError, messaging.UnregisteredError):
        # Token is invalid/expired/unregistered -- clear it
        logger.info("Clearing invalid FCM token for user=%s", user_pk)
        CustomUser.objects.filter(pk=user_pk).update(fcm_token="")
    except Exception as exc:
        logger.warning("FCM push failed for user=%s: %s", user_pk, exc)


def send_push(user, title, body, data=None):
    """Send an FCM push notification to a user (non-blocking).

    Args:
        user: CustomUser instance (must have .pk and .fcm_token)
        title: Notification title (Korean)
        body: Notification body (Korean)
        data: Optional dict of string key-value pairs for the data payload

    Returns:
        True if push was dispatched to the background thread,
        False if skipped (no token / firebase unavailable).
    """
    if not user.fcm_token:
        return False

    if _firebase_unavailable:
        return False

    # Ensure data values are strings (FCM requirement)
    clean_data = {}
    if data:
        clean_data = {str(k): str(v) for k, v in data.items()}

    thread = threading.Thread(
        target=_do_send_push,
        args=(user.pk, title, body, clean_data),
        daemon=True,
    )
    thread.start()
    return True


# ---------------------------------------------------------------------------
# Notification record + push (public API used by signal handlers)
# ---------------------------------------------------------------------------

def create_notification(user, actor, title, body, notification_type,
                        target_type=None, target_id=None):
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
