from django.core.cache import cache

POPULAR_TRAILS_KEY = "popular_trails"
POPULAR_TRAILS_TTL = 600  # 10 minutes

TRAIL_DETAIL_KEY = "trail_detail_{pk}"
TRAIL_DETAIL_TTL = 300  # 5 minutes

RANKINGS_KEY = "rankings_{type}"
RANKINGS_TTL = 3600  # 1 hour


def get_or_set_cache(key, queryset_fn, ttl):
    """Generic cache helper."""
    data = cache.get(key)
    if data is None:
        data = queryset_fn()
        cache.set(key, data, ttl)
    return data


def invalidate_trail_cache(trail_pk):
    """Invalidate caches related to a specific trail."""
    cache.delete(TRAIL_DETAIL_KEY.format(pk=trail_pk))
    cache.delete(POPULAR_TRAILS_KEY)
    cache.delete(RANKINGS_KEY.format(type="weekly"))
    cache.delete(RANKINGS_KEY.format(type="monthly"))
