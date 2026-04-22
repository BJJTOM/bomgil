#!/usr/bin/env bash
# Render build script.
#
# Optimisation goal: keep the critical path FAST. Every deploy must run
# migrations + static collection + legal seed (tiny, always idempotent).
# Slow data-seed tasks (external API crawls, bulk upserts) are gated
# behind environment flags so routine code-only deploys don't waste 10+
# minutes re-hitting the Korea Tourism API.
#
# Flags (set in Render → Environment when you want them on, then unset
# after the deploy finishes):
#   MORU_SEED_TRAILS=1   → runs import_public_trails + cleanup
#   MORU_SEED_SERIES=1   → runs seed_trail_series
#   MORU_SANITIZE_USERS=1 → runs sanitize_phone_usernames
#
# Alternative: `python manage.py seed_all` triggers every seed on demand.
set -o errexit

echo "=== Installing dependencies ==="
pip install --upgrade pip --quiet
pip install -r requirements.txt --prefer-binary --quiet

echo "=== Collecting static files ==="
python manage.py collectstatic --no-input --clear=no

echo "=== Running migrations ==="
python manage.py migrate --run-syncdb

echo "=== Creating cache table (idempotent) ==="
python manage.py createcachetable

echo "=== Seeding legal documents (idempotent, fast) ==="
python manage.py seed_legal_documents || echo "seed_legal_documents failed — continuing"

if [ "${MORU_SANITIZE_USERS:-0}" = "1" ]; then
  echo "=== Sanitizing legacy phone-encoded usernames ==="
  python manage.py sanitize_phone_usernames || echo "sanitize_phone_usernames failed — continuing"
else
  echo "=== Skipping sanitize_phone_usernames (set MORU_SANITIZE_USERS=1 to enable) ==="
fi

if [ "${MORU_SEED_TRAILS:-0}" = "1" ]; then
  echo "=== Importing public trails from Korea Tourism API ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py import_public_trails \
    || echo "import_public_trails failed — continuing"
  echo "=== Cleaning up non-walking public trails ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py cleanup_public_trails \
    || echo "cleanup_public_trails failed — continuing"
else
  echo "=== Skipping public trail import/cleanup (set MORU_SEED_TRAILS=1 to enable) ==="
fi

if [ "${MORU_SEED_SERIES:-0}" = "1" ]; then
  echo "=== Seeding trail series ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py seed_trail_series \
    || echo "seed_trail_series failed — continuing"
else
  echo "=== Skipping trail series seed (set MORU_SEED_SERIES=1 to enable) ==="
fi

echo "=== Build complete ==="
