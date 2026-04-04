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

echo "=== Seeding data ==="
python manage.py seed_data || echo "seed_data skipped"
python manage.py seed_community || echo "seed_community skipped"
python manage.py seed_activities || echo "seed_activities skipped"

echo "=== Build complete ==="
