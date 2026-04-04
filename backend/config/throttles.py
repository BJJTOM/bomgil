from rest_framework.throttling import UserRateThrottle


class TrailCreateThrottle(UserRateThrottle):
    """코스 생성: 하루 20건 제한."""
    scope = "trail_create"
    rate = "20/day"
