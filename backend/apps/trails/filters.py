import django_filters

from .models import Trail


class TrailFilter(django_filters.FilterSet):
    # Use icontains for region so "서울" matches "서울", "서울특별시", etc.
    region = django_filters.CharFilter(field_name="region", lookup_expr="icontains")

    class Meta:
        model = Trail
        fields = [
            "region", "country", "difficulty", "best_season", "status", "tags",
            "is_official", "trail_type",
        ]
