from .models import CustomUser, UserBadge


def check_and_award_badges(user):
    """Check user's achievements and award badges automatically."""
    from apps.trails.models import Trail
    from apps.stories.models import WalkStory
    from apps.activities.models import ActivityTrack
    from django.db.models import Sum

    badges_to_check = []

    # Trail creator: created 1+ approved trail
    if Trail.objects.filter(author=user, status='approved').exists():
        badges_to_check.append('trail_creator')

    # Storyteller: wrote 3+ stories
    if WalkStory.objects.filter(author=user).count() >= 3:
        badges_to_check.append('storyteller')

    # Walker badges based on total distance
    total_km = ActivityTrack.objects.filter(user=user).aggregate(
        total=Sum('distance_km')
    )['total'] or 0
    if total_km >= 10:
        badges_to_check.append('walker_10km')
    if total_km >= 50:
        badges_to_check.append('walker_50km')
    if total_km >= 100:
        badges_to_check.append('walker_100km')

    # First walk
    if ActivityTrack.objects.filter(user=user).exists():
        badges_to_check.append('first_walk')

    # Global walker: walked in 2+ countries
    countries = Trail.objects.filter(
        author=user
    ).values_list('country', flat=True).distinct().count()
    if countries >= 2:
        badges_to_check.append('global_walker')

    # Popular: 10+ total likes on stories
    total_likes = WalkStory.objects.filter(author=user).aggregate(
        total=Sum('like_count')
    )['total'] or 0
    if total_likes >= 10:
        badges_to_check.append('popular')

    # Award badges
    for badge_type in badges_to_check:
        UserBadge.objects.get_or_create(user=user, badge_type=badge_type)
