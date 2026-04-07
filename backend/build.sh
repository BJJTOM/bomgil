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

echo "=== Seeding demo data ==="
python manage.py seed_demo

echo "=== Build complete ==="
