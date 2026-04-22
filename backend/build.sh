#!/usr/bin/env bash
# Render build script
set -o errexit

echo "=== Installing dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Collecting static files ==="
python manage.py collectstatic --no-input

echo "=== Running migrations ==="
python manage.py migrate --run-syncdb

echo "=== Creating cache table (idempotent) ==="
python manage.py createcachetable

echo "=== Sanitizing legacy phone-encoded usernames (idempotent) ==="
python manage.py sanitize_phone_usernames

# The two commands below populate the official trails catalog and
# the curated trail series. Both are idempotent (update_or_create
# based) so running on every deploy is safe. Failures here MUST NOT
# break the build, because the app is still fully functional without
# the curated content — so we wrap each in `|| true` and just log.
echo "=== Importing public trails from Korea Tourism API (idempotent) ==="
MORU_DISABLE_REVALIDATE=1 python manage.py import_public_trails || echo "import_public_trails failed — continuing"

echo "=== Cleaning up non-walking public trails (idempotent) ==="
MORU_DISABLE_REVALIDATE=1 python manage.py cleanup_public_trails || echo "cleanup_public_trails failed — continuing"

echo "=== Seeding trail series (idempotent) ==="
MORU_DISABLE_REVALIDATE=1 python manage.py seed_trail_series || echo "seed_trail_series failed — continuing"

echo "=== Build complete ==="
