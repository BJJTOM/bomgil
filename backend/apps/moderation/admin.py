from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import AIModerationLog, ModerationLog
from .reports import Notification, Report


@admin.register(ModerationLog)
class ModerationLogAdmin(admin.ModelAdmin):
    list_display = ["moderator", "content_type", "object_id", "action", "created_at"]
    list_filter = ["action", "content_type"]


@admin.register(AIModerationLog)
class AIModerationLogAdmin(admin.ModelAdmin):
    list_display = [
        "id", "content_type_label", "object_id", "action_badge",
        "confidence_display", "flags_display", "is_overridden",
        "created_at",
    ]
    list_filter = ["action", "content_type_label", "is_overridden", "is_safe", "created_at"]
    search_fields = ["reason", "input_text", "flags"]
    readonly_fields = [
        "content_type", "object_id", "action", "is_safe", "confidence",
        "flags", "reason", "input_text", "content_type_label",
        "is_overridden", "overridden_by", "overridden_at", "created_at",
    ]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    list_per_page = 50
    actions = ["override_approve", "override_reject"]

    @admin.display(description="판정")
    def action_badge(self, obj):
        colors = {
            "approve": ("#22C55E", "승인"),
            "review": ("#F59E0B", "검토"),
            "reject": ("#EF4444", "차단"),
            "error": ("#9CA3AF", "오류"),
        }
        bg, label = colors.get(obj.action, ("#9CA3AF", obj.action))
        return format_html(
            '<span style="color:#fff;background:{};padding:2px 8px;'
            'border-radius:8px;font-size:11px;font-weight:600;">{}</span>',
            bg, label,
        )

    @admin.display(description="확신도")
    def confidence_display(self, obj):
        pct = obj.confidence * 100
        if pct >= 95:
            color = "#EF4444"
        elif pct >= 70:
            color = "#F59E0B"
        else:
            color = "#22C55E"
        return format_html(
            '<span style="color:{};font-weight:600;">{:.0f}%</span>', color, pct
        )

    @admin.display(description="위반 유형")
    def flags_display(self, obj):
        if not obj.flags:
            return "-"
        return ", ".join(obj.flags)

    @admin.action(description="Override: 승인으로 변경 (콘텐츠 복원)")
    def override_approve(self, request, queryset):
        for log in queryset.exclude(action="approve"):
            log.is_overridden = True
            log.overridden_by = request.user
            log.overridden_at = timezone.now()
            log.save(update_fields=["is_overridden", "overridden_by", "overridden_at"])
            # Unhide the content if it was hidden
            if log.content_object and hasattr(log.content_object, "is_hidden"):
                type(log.content_object).objects.filter(pk=log.object_id).update(
                    is_hidden=False, hidden_at=None, hidden_reason=""
                )
        self.message_user(request, f"{queryset.count()}개 AI 판정을 승인으로 재정의했습니다.")

    @admin.action(description="Override: 차단으로 변경 (콘텐츠 숨김)")
    def override_reject(self, request, queryset):
        for log in queryset.exclude(action="reject"):
            log.is_overridden = True
            log.overridden_by = request.user
            log.overridden_at = timezone.now()
            log.save(update_fields=["is_overridden", "overridden_by", "overridden_at"])
            # Hide the content
            if log.content_object and hasattr(log.content_object, "is_hidden"):
                type(log.content_object).objects.filter(pk=log.object_id).update(
                    is_hidden=True, hidden_at=timezone.now(), hidden_reason="관리자 수동 차단 (AI 재정의)"
                )
        self.message_user(request, f"{queryset.count()}개 AI 판정을 차단으로 재정의했습니다.")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["reporter", "content_type", "object_id", "reason", "is_resolved", "created_at"]
    list_filter = ["reason", "is_resolved", "content_type"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "message", "is_read", "created_at"]
    list_filter = ["is_read"]
