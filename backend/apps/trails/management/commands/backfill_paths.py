"""Backfill empty `path_data` for imported public-API trails.

Many trails imported from public sources (visitkorea, gilttara, etc.)
landed in the DB with only `start_lat`/`start_lng` and an empty
`path_data` blob — the source feed didn't include a polyline.
Without `path_data` the trail map renders as a single pin and the
completion detector falls back to two-point endpoint hit-testing
(see apps/trails/completion_detector.py:_sample_trail_points).

This command finds those trails and snaps a walking polyline using
the Kakao Mobility Directions API when both endpoints are present.

Usage:
    python manage.py backfill_paths --dry-run
    python manage.py backfill_paths --limit 50
    python manage.py backfill_paths            # process all eligible trails

Environment:
    KAKAO_REST_API_KEY    Kakao REST API key. If unset, the command
                          runs in stub mode (filtering + reporting
                          only) so it remains safe to run on staging
                          / CI without credentials.

Notes:
    * Trails with only `start_lat`/`start_lng` (no end) are skipped —
      a single point isn't enough to ask Kakao for a route.
    * Trails whose `path_data` already has a non-empty `coordinates`
      list are skipped, including legacy `{"points": [...]}` blobs.
    * `path_data` is written as a GeoJSON LineString
      (`{"type": "LineString", "coordinates": [[lng, lat], ...]}`)
      to match what the rest of the codebase expects (gpx_export,
      completion_detector, frontend renderer).
"""

from __future__ import annotations

import os
import time
from typing import Optional

import requests
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.trails.models import Trail


# Kakao Mobility Directions endpoint (driving-by-default; for now we
# accept driving polylines because Kakao does NOT yet offer a public
# pedestrian-routing API. The shape of an urban driving route is
# usually close enough to a walking route to make the trail usable
# for map rendering. TODO below tracks the proper fix.
KAKAO_DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/v1/directions"

# Be polite to upstream — small per-call delay so a backfill run of
# thousands of trails doesn't trigger Kakao's daily quota in a burst.
PER_CALL_SLEEP_SECONDS = 0.2


def _get_api_key() -> Optional[str]:
    """Return the Kakao REST API key, or None if unset.

    Unlike `import_durunubi_trails` we DON'T raise on a missing key —
    `backfill_paths` is meant to be safe to run anywhere, and the
    --dry-run / stub mode is useful even without credentials.
    """
    key = os.environ.get("KAKAO_REST_API_KEY", "").strip()
    return key or None


def _has_meaningful_path_data(pd) -> bool:
    """True if `pd` already encodes a routable polyline.

    Empty dict, missing coordinates, or a single-point coordinate list
    all count as "needs backfill". We also recognise the legacy
    `{"points": [...]}` shape used by older GPX imports.
    """
    if not isinstance(pd, dict) or not pd:
        return False
    coords = pd.get("coordinates")
    if isinstance(coords, list) and len(coords) >= 2:
        return True
    legacy_points = pd.get("points")
    if isinstance(legacy_points, list) and len(legacy_points) >= 2:
        return True
    return False


def _kakao_directions(
    start: tuple[float, float],  # (lat, lng)
    end: tuple[float, float],
    api_key: str,
    timeout: float = 10.0,
) -> Optional[list[list[float]]]:
    """Call Kakao Directions and return [[lng, lat], ...] or None.

    Returns None on any non-2xx, parse error, or empty route — the
    caller treats None as "skip this trail" and moves on.
    """
    headers = {"Authorization": f"KakaoAK {api_key}"}
    params = {
        "origin": f"{start[1]},{start[0]}",   # Kakao expects lng,lat
        "destination": f"{end[1]},{end[0]}",
        "priority": "RECOMMEND",
    }
    try:
        resp = requests.get(
            KAKAO_DIRECTIONS_URL,
            headers=headers,
            params=params,
            timeout=timeout,
        )
    except requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    try:
        body = resp.json()
    except ValueError:
        return None

    routes = body.get("routes") or []
    if not routes:
        return None
    sections = routes[0].get("sections") or []
    coords: list[list[float]] = []
    for sec in sections:
        for road in sec.get("roads") or []:
            verts = road.get("vertexes") or []
            # Kakao returns flat [lng0, lat0, lng1, lat1, ...]
            for i in range(0, len(verts) - 1, 2):
                coords.append([verts[i], verts[i + 1]])
    if len(coords) < 2:
        return None
    return coords


class Command(BaseCommand):
    help = (
        "Backfill empty path_data on trails with known start+end coords "
        "by calling Kakao Mobility Directions. Use --dry-run to preview."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Only process the first N eligible trails.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change; do not call Kakao or save.",
        )

    # ── Trail filter ───────────────────────────────────────────────
    def _eligible_trails_qs(self):
        """Trails whose `path_data` is null / empty AND that have
        start AND end coordinates. We need both endpoints to ask
        Kakao for a route — start-only trails are skipped.
        """
        # JSONField default is `{}` (truthy in Django ORM terms but
        # empty in Python), so we filter on the JSON value `{}` plus
        # explicit nulls. Trails with malformed `path_data` (e.g. an
        # old `{"points": [...]}` blob) are surfaced too and filtered
        # in Python via _has_meaningful_path_data — that's safer than
        # encoding the recognition logic in SQL.
        return (
            Trail.objects
            .filter(
                Q(path_data__isnull=True)
                | Q(path_data={})
                | Q(path_data__coordinates__isnull=True),
            )
            .exclude(start_lat__isnull=True)
            .exclude(start_lng__isnull=True)
            .exclude(end_lat__isnull=True)
            .exclude(end_lng__isnull=True)
            .order_by("id")
        )

    # ── Entry point ────────────────────────────────────────────────
    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        limit: Optional[int] = options["limit"]

        api_key = _get_api_key()
        if api_key is None:
            self.stdout.write(self.style.WARNING(
                "KAKAO_REST_API_KEY not set — running in STUB mode. "
                "Will report eligible trails but cannot fetch routes. "
                "TODO: set KAKAO_REST_API_KEY in the service environment "
                "to actually backfill path_data."
            ))

        qs = self._eligible_trails_qs()
        # `limit` is applied after the secondary in-Python filter so
        # we don't burn it on rows that turn out to have legacy data.
        candidates = list(qs[: (limit * 4) if limit else 5000])
        eligible = [
            t for t in candidates
            if not _has_meaningful_path_data(t.path_data)
        ]
        if limit:
            eligible = eligible[:limit]

        self.stdout.write(
            f"Eligible trails (empty path_data + start/end): {len(eligible)}"
        )

        if not eligible:
            self.stdout.write(self.style.SUCCESS("Nothing to do."))
            return

        if dry_run or api_key is None:
            mode = "DRY RUN" if dry_run else "STUB MODE"
            self.stdout.write(self.style.WARNING(f"{mode} — no DB writes"))
            for t in eligible[:20]:
                self.stdout.write(
                    f"  would backfill #{t.id} {t.title!r} "
                    f"({t.start_lat},{t.start_lng}) → "
                    f"({t.end_lat},{t.end_lng})"
                )
            if len(eligible) > 20:
                self.stdout.write(f"  ... and {len(eligible) - 20} more")
            self.stdout.write(self.style.SUCCESS(
                f"Would backfill {len(eligible)} trail(s)."
            ))
            return

        # ── Live mode ─────────────────────────────────────────────
        backfilled = 0
        skipped = 0
        for t in eligible:
            try:
                start = (float(t.start_lat), float(t.start_lng))
                end = (float(t.end_lat), float(t.end_lng))
            except (TypeError, ValueError):
                skipped += 1
                continue

            coords = _kakao_directions(start, end, api_key)
            if not coords:
                self.stdout.write(
                    f"  skip #{t.id} {t.title!r} — Kakao returned no route"
                )
                skipped += 1
                time.sleep(PER_CALL_SLEEP_SECONDS)
                continue

            t.path_data = {"type": "LineString", "coordinates": coords}
            t.save(update_fields=["path_data"])
            backfilled += 1
            if backfilled % 25 == 0:
                self.stdout.write(f"  ... {backfilled} backfilled so far")
            time.sleep(PER_CALL_SLEEP_SECONDS)

        self.stdout.write(self.style.SUCCESS(
            f"Backfill complete: backfilled={backfilled}, skipped={skipped}"
        ))
