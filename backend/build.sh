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

echo "=== Build complete ==="
