# Roami — 전 세계 도보여행 코스 공유 & 동행 매칭 플랫폼

> Roami — Walk. Discover. Connect.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, Django 4.2, DRF 3.15 |
| Frontend | Next.js 14 (App Router), TypeScript 5, Tailwind CSS 3 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | dj-rest-auth + django-allauth (Google/Kakao) |
| Maps | Kakao Maps SDK (Korea), Mapbox GL JS (Global) |
| i18n | next-intl (frontend), django-modeltranslation (backend) |

## Quick Start

```bash
# 1. Clone & setup
cp .env.example .env

# 2. Start all services
docker compose up --build

# 3. Access
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/api/v1/
# Django Admin: http://localhost:8000/admin/
```

## Project Structure

```
roami/
├── backend/          # Django 4.2 + DRF
│   ├── config/       # settings, urls, wsgi, asgi
│   └── apps/
│       ├── accounts/    # User, social auth
│       ├── trails/      # Trail CRUD
│       ├── spots/       # Spots (restaurants, photos, etc.)
│       ├── reviews/     # Reviews & ratings
│       ├── moderation/  # Admin moderation
│       └── media/       # Image upload & resize
├── frontend/         # Next.js 14 (App Router)
│   └── src/
│       ├── app/         # Routes
│       ├── components/  # Shared components
│       ├── lib/         # API client, utils
│       ├── hooks/       # Custom hooks
│       ├── stores/      # Zustand state
│       └── i18n/        # ko, en, ja translations
└── docker-compose.yml
```
