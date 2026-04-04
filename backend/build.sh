#!/usr/bin/env bash
# Render build script
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate

# Seed data on first deploy (safe to re-run)
python manage.py seed_data || true
python manage.py seed_community || true
python manage.py seed_activities || true
