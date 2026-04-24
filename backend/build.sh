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
#   MORU_SEED_TRAILS=1    → runs import_durunubi_trails + enrich_trail_images
#   MORU_SEED_SERIES=1    → runs seed_trail_series
#   MORU_SANITIZE_USERS=1 → runs sanitize_phone_usernames
#   MORU_SEED_SHOWCASE=1       → runs seed_showcase_trail --force (one-off, unset after)
#   MORU_SEED_SHOWCASE_PACK=1  → runs seed_showcase_trails_pack --force (북촌+반포, one-off)
#
# Alternative: `python manage.py seed_all` triggers every seed on demand.
set -o errexit

echo "=== Installing dependencies ==="
pip install --upgrade pip --quiet
pip install -r requirements.txt --prefer-binary --quiet

echo "=== Collecting static files ==="
python manage.py collectstatic --no-input

echo "=== Running migrations ==="
python manage.py migrate --run-syncdb

echo "=== Creating cache table (idempotent) ==="
python manage.py createcachetable

echo "=== Seeding legal documents (idempotent, fast) ==="
# --force-update rewrites existing v1.0 rows so the fix for wording
# issues we noticed post-seed (e.g. phantom AWS attribution) lands
# automatically on the next deploy. Operator edits made through the
# admin UI won't be overwritten because the admin should save a new
# version string (v1.1, v2.0…) — only v1.0 is touched here.
python manage.py seed_legal_documents --force-update \
  || echo "seed_legal_documents failed — continuing"

if [ "${MORU_SANITIZE_USERS:-0}" = "1" ]; then
  echo "=== Sanitizing legacy phone-encoded usernames ==="
  python manage.py sanitize_phone_usernames || echo "sanitize_phone_usernames failed — continuing"
else
  echo "=== Skipping sanitize_phone_usernames (set MORU_SANITIZE_USERS=1 to enable) ==="
fi

if [ "${MORU_SEED_TRAILS:-0}" = "1" ]; then
  echo "=== Importing Durunubi trails with GPS routes ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py import_durunubi_trails \
    || echo "import_durunubi_trails failed — continuing"

  echo "=== Enriching trail images from KorService2 ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py enrich_trail_images \
    || echo "enrich_trail_images failed — continuing"
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

if [ "${MORU_SEED_SHOWCASE:-0}" = "1" ]; then
  echo "=== Seeding showcase trail (서울숲 공원 루프) ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py seed_showcase_trail --force \
    || echo "seed_showcase_trail failed — continuing"
else
  echo "=== Skipping showcase trail seed (set MORU_SEED_SHOWCASE=1 to enable) ==="
fi

if [ "${MORU_SEED_SHOWCASE_PACK:-0}" = "1" ]; then
  echo "=== Seeding showcase trail pack (북촌 + 반포→뚝섬) ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py seed_showcase_trails_pack --force \
    || echo "seed_showcase_trails_pack failed — continuing"
else
  echo "=== Skipping showcase pack seed (set MORU_SEED_SHOWCASE_PACK=1 to enable) ==="
fi

echo "=== Build complete ==="
