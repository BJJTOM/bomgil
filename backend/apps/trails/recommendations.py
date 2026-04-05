from django.db.models import Q
from .models import Trail, TrailLike


def get_recommendations(user, limit=10):
    """Recommend trails based on user's liked trails and walking history."""
    liked_trails = TrailLike.objects.filter(user=user).values_list('trail_id', flat=True)
    if not liked_trails:
        # No likes -- return popular trails
        return Trail.objects.filter(status='approved').order_by('-like_count')[:limit]

    liked = Trail.objects.filter(id__in=liked_trails)
    preferred_types = list(liked.values_list('trail_type', flat=True).distinct())
    preferred_countries = list(liked.values_list('country', flat=True).distinct())

    # Find similar trails not yet liked
    recommendations = Trail.objects.filter(
        status='approved'
    ).exclude(
        id__in=liked_trails
    ).filter(
        Q(trail_type__in=preferred_types) | Q(country__in=preferred_countries)
    ).order_by('-like_count')[:limit]

    return recommendations
