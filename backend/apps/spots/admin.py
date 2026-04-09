"""Spots admin."""
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse

from .models import Spot, SpotImage


@admin.action(description="🚫 선택한 스팟 숨김")
def hide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=False).update(
        is_hidden=True, hidden_at=timezone.now()
    )
    modeladmin.message_user(request, f"{updated}개 스팟을 숨겼습니다.")


@admin.action(description="✅ 선택한 스팟 다시 보이기")
def unhide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=True).update(
        is_hidden=False, hidden_at=None
    )
    modeladmin.message_user(request, f"{updated}개 스팟을 복원했습니다.")


def author_link(obj):
    user = obj.author
    if not user:
        return "-"
    url = reverse("admin:accounts_customuser_change", args=[user.pk])
    return format_html('<a href="{}">{}</a>', url, user.nickname or user.username)


class SpotImageInline(admin.TabularInline):
    model = SpotImage
    extra = 0


@admin.register(Spot)
class SpotAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "trail", "author_display", "spot_type", "order", "status", "status_badge", "created_at"]
    list_filter = ["spot_type", "status", "is_hidden", "is_must_visit"]
    search_fields = ["name", "name_en", "description", "trail__title", "author__nickname"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    readonly_fields = ["hidden_at", "created_at", "updated_at"]
    actions = [hide_selected, unhide_selected]
    inlines = [SpotImageInline]

    @admin.display(description="작성자")
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description="공개", ordering="is_hidden")
    def status_badge(self, obj):
        if obj.is_hidden:
            return format_html('<span style="color:#fff;background:#EF4444;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">숨김</span>')
        return format_html('<span style="color:#22C55E;font-size:11px;font-weight:600;">공개</span>')
