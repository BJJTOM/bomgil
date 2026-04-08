"""
Firebase Phone Auth verification.

Verifies Firebase ID tokens issued via client-side phone number authentication.
The client (mobile app) handles SMS sending and OTP verification using
Firebase SDK; the backend only verifies the resulting ID token.
"""
import json
import logging
import os

logger = logging.getLogger(__name__)

_firebase_initialized = False


def _init_firebase():
    """Lazy-init firebase-admin once."""
    global _firebase_initialized
    if _firebase_initialized:
        return True
    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            _firebase_initialized = True
            return True

        # Try service account JSON from env var
        sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
        if sa_json:
            try:
                cred_dict = json.loads(sa_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                _firebase_initialized = True
                logger.info("Firebase Admin initialized from env JSON")
                return True
            except Exception as e:
                logger.exception("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: %s", e)

        # Try project ID only (uses Application Default Credentials)
        project_id = os.environ.get("FIREBASE_PROJECT_ID", "moru-media")
        try:
            firebase_admin.initialize_app(options={"projectId": project_id})
            _firebase_initialized = True
            logger.info("Firebase Admin initialized with project ID only: %s", project_id)
            return True
        except Exception as e:
            logger.exception("Firebase Admin init failed: %s", e)
            return False
    except ImportError:
        logger.warning("firebase-admin not installed — phone auth disabled")
        return False


def verify_id_token(id_token: str) -> dict | None:
    """Verify a Firebase ID token. Returns decoded claims or None.

    Expected claims:
        - uid: Firebase user UID
        - phone_number: E.164 format (e.g. +821012345678)
        - firebase.sign_in_provider: 'phone'
    """
    if not id_token:
        return None
    if not _init_firebase():
        return None
    try:
        from firebase_admin import auth as firebase_auth
        decoded = firebase_auth.verify_id_token(id_token)
        return decoded
    except Exception as e:
        logger.warning("Firebase token verification failed: %s", e)
        return None
