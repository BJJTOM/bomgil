#!/usr/bin/env bash
# Render build script — kept lean.
#
# Critical path on every deploy: pip install + collectstatic + migrate.
# Anything else is gated behind an env flag so routine code-only
# deploys don't pay extra seconds re-running idempotent maintenance.
#
# Flags (set in Render → Environment when needed, then unset):
#   MORU_SEED_LEGAL=1          → re-runs seed_legal_documents --force-update
#                                 (only needed when the legal doc seed
#                                  itself changed; admin edits aren't
#                                  affected)
#   MORU_CREATE_CACHE_TABLE=1  → runs createcachetable (one-off, on first
#                                 ever deploy or DB reset)
#   MORU_FIX_THUMBS=1          → wipes legacy 404 Unsplash thumbnails
#                                 (one-off cleanup; idempotent but
#                                  redundant after first run)
#   MORU_SEED_TRAILS=1         → import_durunubi_trails + enrich images
#   MORU_SEED_SERIES=1         → seed_trail_series
#   MORU_SANITIZE_USERS=1      → sanitize_phone_usernames
#   MORU_SEED_SHOWCASE=1       → seed_showcase_trail --force
#   MORU_SEED_SHOWCASE_PACK=1  → seed_showcase_trails_pack --force
#   MORU_BACKFILL_PATHS=1      → backfill_paths (Kakao Local snap)
#
# Alternative: `python manage.py seed_all` runs every seed on demand.
set -o errexit

echo "=== Installing dependencies ==="
# Drop the pip self-upgrade — Render's pip is current enough and the
# upgrade alone added 5–10s to every deploy.
pip install -r requirements.txt --prefer-binary --quiet

echo "=== Collecting static files ==="
python manage.py collectstatic --no-input

echo "=== Running migrations ==="
# --run-syncdb forces a scan for unmanaged apps (slow). All Moru apps
# have migrations, so plain migrate is enough.
python manage.py migrate

if [ "${MORU_CREATE_CACHE_TABLE:-0}" = "1" ]; then
  echo "=== Creating cache table ==="
  python manage.py createcachetable
fi

if [ "${MORU_SEED_LEGAL:-0}" = "1" ]; then
  echo "=== Re-seeding legal documents (force update) ==="
  python manage.py seed_legal_documents --force-update \
    || echo "seed_legal_documents failed — continuing"
else
  # On first-ever deploy the table is empty, so still seed (idempotent
  # — no --force-update means it's a fast NOOP after that).
  python manage.py seed_legal_documents \
    || echo "seed_legal_documents failed — continuing"
fi

if [ "${MORU_SANITIZE_USERS:-0}" = "1" ]; then
  echo "=== Sanitizing legacy phone-encoded usernames ==="
  python manage.py sanitize_phone_usernames || echo "sanitize_phone_usernames failed — continuing"
fi

if [ "${MORU_SEED_TRAILS:-0}" = "1" ]; then
  echo "=== Importing Durunubi trails with GPS routes ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py import_durunubi_trails \
    || echo "import_durunubi_trails failed — continuing"

  echo "=== Enriching trail images from KorService2 ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py enrich_trail_images \
    || echo "enrich_trail_images failed — continuing"
fi

if [ "${MORU_SEED_SERIES:-0}" = "1" ]; then
  echo "=== Seeding trail series ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py seed_trail_series \
    || echo "seed_trail_series failed — continuing"
fi

if [ "${MORU_SEED_SHOWCASE:-0}" = "1" ]; then
  echo "=== Seeding showcase trail (서울숲 공원 루프) ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py seed_showcase_trail --force \
    || echo "seed_showcase_trail failed — continuing"
fi

if [ "${MORU_SEED_SHOWCASE_PACK:-0}" = "1" ]; then
  echo "=== Seeding showcase trail pack ==="
  MORU_DISABLE_REVALIDATE=1 python manage.py seed_showcase_trails_pack --force \
    || echo "seed_showcase_trails_pack failed — continuing"
fi

if [ "${MORU_BACKFILL_PATHS:-0}" = "1" ]; then
  echo "=== Backfilling missing path_data via Kakao Local snap ==="
  python manage.py backfill_paths || echo "backfill_paths failed — continuing"
fi

if [ "${MORU_FIX_THUMBS:-0}" = "1" ]; then
  echo "=== Clearing broken showcase thumbnails ==="
  python manage.py fix_showcase_thumbnails || echo "fix_showcase_thumbnails failed — continuing"
fi

echo "=== Build complete ==="
