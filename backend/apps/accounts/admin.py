from datetime import timedelta

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.db import models as django_models
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    AdminMemo,
    AdminMemoImage,
    AgreementAcceptance,
    CustomUser,
    LoginHistory,
    Notification,
    PhoneAuthLog,
    PhoneOTP,
    UserSuspension,
    XPLog,
)


# ── 감사 로그 헬퍼 ──────────────────────────────────────────
def _log_moderation(moderator, target_user, action, reason=""):
    """moderation.ModerationLog에 감사 기록. 실패해도 업무 흐름을 막지 않음."""
    try:
        from django.contrib.contenttypes.models import ContentType
        from apps.moderation.models import ModerationLog
        ct = ContentType.objects.get_for_model(type(target_user))
        ModerationLog.objects.create(
            moderator=moderator,
            content_type=ct,
            object_id=target_user.pk,
            action=action,
            reason=(reason or "")[:500],
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("moderation log failed")


# ── 유저 리스트 bulk 정지 액션 ──────────────────────────────
def _bulk_suspend(modeladmin, request, queryset, days, reason, duration_key):
    now = timezone.now()
    created = 0
    for user in queryset:
        UserSuspension.objects.create(
            user=user,
            reason=reason,
            duration=duration_key,
            scopes=["account"],
            suspended_by=request.user,
            expires_at=None if days is None else now + timedelta(days=days),
        )
        _log_moderation(request.user, user, "suspend", f"{duration_key} / bulk")
        created += 1
    modeladmin.message_user(request, f"{created}명 유저를 {reason}로 정지했습니다.")


@admin.action(description="⛔️ 선택 유저 1일 정지 (account)")
def action_suspend_1d(modeladmin, request, queryset):
    _bulk_suspend(modeladmin, request, queryset, 1, "관리자 일괄 정지 1일", "1d")


@admin.action(description="⛔️ 선택 유저 3일 정지 (account)")
def action_suspend_3d(modeladmin, request, queryset):
    _bulk_suspend(modeladmin, request, queryset, 3, "관리자 일괄 정지 3일", "3d")


@admin.action(description="⛔️ 선택 유저 7일 정지 (account)")
def action_suspend_7d(modeladmin, request, queryset):
    _bulk_suspend(modeladmin, request, queryset, 7, "관리자 일괄 정지 7일", "7d")


@admin.action(description="♻️ 선택 유저의 활성 정지 모두 해제")
def action_lift_all(modeladmin, request, queryset):
    now = timezone.now()
    lifted = 0
    for user in queryset:
        qs = user.suspensions.filter(lifted_at__isnull=True)
        for s in qs:
            s.lifted_at = now
            s.lifted_by = request.user
            s.lifted_reason = "관리자 일괄 해제"
            s.save(update_fields=["lifted_at", "lifted_by", "lifted_reason"])
            _log_moderation(request.user, user, "lift", "bulk")
            lifted += 1
    modeladmin.message_user(request, f"{lifted}건의 정지를 해제했습니다.")


# "유저 관리" 앱 안에서 모델 순서 고정: 유저 먼저, 이후 이름이 짧은 순.
_original_get_app_list = admin.AdminSite.get_app_list


def _patched_get_app_list(self, request, app_label=None):
    app_list = _original_get_app_list(self, request, app_label)
    for app in app_list:
        if app.get("app_label") == "accounts":
            def _sort_key(model):
                name = model.get("name", "") or ""
                if name == "유저":
                    return (0, 0, name)
                return (1, len(name), name)
            app["models"].sort(key=_sort_key)
    return app_list


admin.AdminSite.get_app_list = _patched_get_app_list


# ── 대시보드 통계 주입 ──────────────────────────────────────
_original_index = admin.AdminSite.index


def _patched_index(self, request, extra_context=None):
    from datetime import timedelta
    from django.db.models import Q
    from django.utils import timezone

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_24h = now - timedelta(hours=24)

    stats = {}
    try:
        stats["users_total"] = CustomUser.objects.count()
        stats["users_today"] = CustomUser.objects.filter(date_joined__gte=today_start).count()
        stats["users_deleted"] = CustomUser.objects.filter(is_deleted=True).count()
        stats["suspensions_active"] = (
            UserSuspension.objects.filter(lifted_at__isnull=True)
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .count()
        )
        stats["logins_24h"] = LoginHistory.objects.filter(created_at__gte=last_24h).count()
        stats["signups_24h"] = CustomUser.objects.filter(date_joined__gte=last_24h).count()
    except Exception:
        pass

    try:
        from apps.community.models import Post, PostComment, Report
        stats["posts_total"] = Post.objects.count()
        stats["posts_today"] = Post.objects.filter(created_at__gte=today_start).count()
        stats["comments_total"] = PostComment.objects.count()
        stats["comments_today"] = PostComment.objects.filter(created_at__gte=today_start).count()
        stats["reports_total"] = Report.objects.count()
        stats["reports_pending"] = Report.objects.filter(status="pending").count()
    except Exception:
        stats.setdefault("posts_total", 0)
        stats.setdefault("posts_today", 0)
        stats.setdefault("comments_total", 0)
        stats.setdefault("comments_today", 0)
        stats.setdefault("reports_total", 0)
        stats.setdefault("reports_pending", 0)

    try:
        from apps.moderation.models import AIModerationLog
        stats["ai_review"] = AIModerationLog.objects.filter(action="review").count()
        stats["ai_rejected"] = AIModerationLog.objects.filter(action="reject").count()
    except Exception:
        stats.setdefault("ai_review", 0)
        stats.setdefault("ai_rejected", 0)

    extra_context = dict(extra_context or {})
    extra_context["moru_stats"] = stats
    return _original_index(self, request, extra_context=extra_context)


admin.AdminSite.index = _patched_index


class SuspensionAdminForm(forms.ModelForm):
    """정지 생성/수정용 공통 폼. 사유는 짧은 한 줄, 범위는 체크박스 다중선택."""
    reason = forms.CharField(
        label="사유", max_length=100, required=True,
        widget=forms.TextInput(attrs={
            "size": 28, "maxlength": 100,
            "placeholder": "예: 욕설, 도배 (최대 100자)",
            "style": "width: 320px;",
        }),
    )
    scopes = forms.MultipleChoiceField(
        label="정지 범위", required=False,
        choices=UserSuspension.SCOPE_CHOICES,
        widget=forms.CheckboxSelectMultiple(attrs={"class": "moru-checkboxes-inline"}),
    )
    lifted_reason = forms.CharField(
        label="해제 사유", required=False,
        widget=forms.TextInput(attrs={
            "size": 28, "maxlength": 200,
            "placeholder": "해제 사유 (선택)",
            "style": "width: 320px;",
        }),
    )

    class Meta:
        model = UserSuspension
        fields = "__all__"


class NewSuspensionInline(admin.StackedInline):
    """신규 정지를 추가하는 전용 인라인. 기존 기록은 보이지 않음."""
    model = UserSuspension
    fk_name = "user"
    form = SuspensionAdminForm
    verbose_name = "새 정지 처리"
    verbose_name_plural = "새 정지 처리"
    extra = 1
    max_num = 1
    can_delete = False
    fields = ("reason", ("duration", "scopes"))

    def get_queryset(self, request):
        return super().get_queryset(request).none()

    def has_change_permission(self, request, obj=None):
        return False


class SuspensionHistoryInline(admin.TabularInline):
    """기존 정지 기록 — 이곳에서만 '해제' 가능."""
    model = UserSuspension
    fk_name = "user"
    verbose_name = "정지 기록"
    verbose_name_plural = "정지 기록"
    extra = 0
    can_delete = False
    fields = (
        "status_display", "reason", "duration", "scopes_display",
        "suspended_at_card", "expires_at_card",
        "lifted_at", "lifted_reason",
    )
    readonly_fields = (
        "status_display", "reason", "duration", "scopes_display",
        "suspended_at_card", "expires_at_card",
    )
    formfield_overrides = {
        django_models.TextField: {
            "widget": forms.Textarea(attrs={"rows": 1, "style": "width: 220px; max-width: 100%;"}),
        },
    }

    @staticmethod
    def _dt_card(dt):
        if not dt:
            return format_html('<span style="color:#9CA3AF;font-size:11px;">-</span>')
        return format_html(
            '<div class="moru-dt-stack">'
            '<span class="moru-dt-row moru-dt-readonly">'
            '<span class="moru-dt-label">날짜 :</span>'
            '<span class="moru-dt-value">{}</span></span>'
            '<span class="moru-dt-row moru-dt-readonly">'
            '<span class="moru-dt-label">시각 :</span>'
            '<span class="moru-dt-value">{}</span></span>'
            '</div>',
            dt.strftime("%Y-%m-%d"),
            dt.strftime("%H:%M:%S"),
        )

    @admin.display(description="정지 시작")
    def suspended_at_card(self, obj):
        return self._dt_card(obj.suspended_at if obj else None)

    @admin.display(description="자동 해제 예정")
    def expires_at_card(self, obj):
        return self._dt_card(obj.expires_at if obj else None)

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description="상태")
    def status_display(self, obj):
        if not obj or not obj.pk:
            return "-"
        label = obj.status_label
        variant = "warn" if label == "정지중" else "ok"
        return format_html(
            '<span class="moru-badge moru-badge--{}">{}</span>',
            variant, label,
        )

    @admin.display(description="범위")
    def scopes_display(self, obj):
        if not obj or not obj.scopes:
            return "-"
        label_map = dict(UserSuspension.SCOPE_CHOICES)
        return ", ".join(label_map.get(s, s) for s in obj.scopes)


class LoginHistoryInline(admin.TabularInline):
    model = LoginHistory
    extra = 0
    can_delete = False
    max_num = 0
    fields = ("created_at", "ip_address", "user_agent", "login_method")
    readonly_fields = fields
    verbose_name = "로그인 기록"
    verbose_name_plural = "최근 로그인 기록"
    ordering = ["-created_at"]


class AdminMemoImageInline(admin.TabularInline):
    model = AdminMemoImage
    extra = 1
    fields = ("image", "uploaded_at", "preview")
    readonly_fields = ("uploaded_at", "preview")

    @admin.display(description="미리보기")
    def preview(self, obj):
        if obj.pk and obj.image:
            return format_html(
                '<img src="{}" style="max-height:80px;border-radius:6px;" />',
                obj.image.url,
            )
        return "-"


class AdminMemoInline(admin.StackedInline):
    model = AdminMemo
    fk_name = "user"
    extra = 0
    fields = ("author", "content", "created_at", "updated_at")
    readonly_fields = ("author", "created_at", "updated_at")
    verbose_name = "유저 메모"
    verbose_name_plural = "유저 메모"

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for obj in instances:
            if isinstance(obj, AdminMemo) and obj.author_id is None:
                obj.author = request.user
            obj.save()
        formset.save_m2m()


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    ordering = ["-date_joined"]
    list_display = [
        "id", "email", "nickname", "phone_number",
        "level_display", "active_display", "country_display",
        "date_joined",
    ]
    list_display_links = ["id", "email", "nickname"]
    list_filter = [
        "is_active", "is_deleted", "level", "preferred_language",
        "phone_verified", "is_verified", "is_staff", "is_guide",
        "date_joined",
    ]
    search_fields = ["nickname", "email", "username", "phone_number", "firebase_uid"]
    readonly_fields = [
        "firebase_uid", "date_joined", "last_login", "created_at", "updated_at",
        "last_login_date", "last_login_time",
        "last_login_ip", "last_login_user_agent",
    ]
    list_per_page = 50

    inlines = [NewSuspensionInline, SuspensionHistoryInline, AdminMemoInline, LoginHistoryInline]

    actions = [action_suspend_1d, action_suspend_3d, action_suspend_7d, action_lift_all]

    formfield_overrides = {
        django_models.TextField: {
            "widget": forms.Textarea(attrs={"rows": 2, "style": "width: 360px; max-width: 100%;"}),
        },
    }

    def get_queryset(self, request):
        # 활성 정지 수를 미리 annotate — is_suspended 컬럼/필터 N+1 방지
        qs = super().get_queryset(request).order_by("-date_joined")
        return qs.prefetch_related("suspensions")

    fieldsets = (
        ("계정", {
            "fields": (
                "email",
                "nickname",
                "phone_number",
                "phone_verified",
                "phone_verified_at",
                ("last_login_date", "last_login_time"),
                "date_joined",
                "password",
            ),
        }),
        ("프로필", {
            "fields": (
                ("profile_image", "one_liner"),
                "bio",
                ("preferred_language", "is_guide"),
                ("age_range", "walking_style"),
                "weekly_goal_km",
            ),
        }),
        ("최근 로그인", {
            "fields": (("last_login_ip", "last_login_user_agent"),),
        }),
        ("탈퇴", {
            "description": "탈퇴 여부를 체크하고 저장하면 탈퇴 일시가 자동 기록됩니다.",
            "fields": (
                "is_deleted",
                "deleted_at",
                "deletion_reason",
            ),
        }),
        ("레벨 / XP", {
            "fields": (("xp", "level"),),
        }),
        ("인증", {
            "fields": (
                ("is_verified", "verification_level"),
                "firebase_uid",
            ),
        }),
        ("권한", {
            "classes": ("collapse",),
            "fields": (
                ("is_active", "is_staff", "is_superuser"),
                "groups",
                "user_permissions",
            ),
        }),
        ("타임스탬프", {
            "classes": ("collapse",),
            "fields": (("created_at", "updated_at"),),
        }),
    )

    class Media:
        css = {"all": ("admin/css/moru.css",)}

    @admin.display(description="레벨", ordering="level")
    def level_display(self, obj):
        return f"Lv.{obj.level}"

    @admin.display(description="국가", ordering="preferred_language")
    def country_display(self, obj):
        names = {"ko": "한국", "en": "US", "ja": "일본", "zh": "중국"}
        return names.get(obj.preferred_language, obj.preferred_language or "-")

    @admin.display(description="활성", boolean=True, ordering="is_active")
    def active_display(self, obj):
        return obj.is_active and not obj.is_deleted

    @admin.display(description="마지막 로그인 날짜")
    def last_login_date(self, obj):
        return obj.last_login.strftime("%Y-%m-%d") if obj.last_login else "-"

    @admin.display(description="마지막 로그인 시각")
    def last_login_time(self, obj):
        return obj.last_login.strftime("%H:%M:%S") if obj.last_login else "-"

    def save_model(self, request, obj, form, change):
        from django.utils import timezone
        was_deleted = False
        if change and obj.pk:
            prev = type(obj).objects.filter(pk=obj.pk).values("is_deleted").first()
            was_deleted = bool(prev and prev.get("is_deleted"))
        # 탈퇴 체크박스를 켤 때 타임스탬프 자동 기록
        if obj.is_deleted and not obj.deleted_at:
            obj.deleted_at = timezone.now()
        if not obj.is_deleted:
            obj.deleted_at = None
        # 전화번호 인증 체크가 처음 켜지면 인증 일시 자동 기록
        if obj.phone_verified and not obj.phone_verified_at:
            obj.phone_verified_at = timezone.now()
        if not obj.phone_verified:
            obj.phone_verified_at = None
        super().save_model(request, obj, form, change)
        # is_deleted 전환 시 감사 로그
        if obj.is_deleted and not was_deleted:
            _log_moderation(request.user, obj, "user_delete", obj.deletion_reason or "탈퇴 처리")

    def save_formset(self, request, form, formset, change):
        # 인라인 저장 시 자동 필드 채움 + 감사 로그
        instances = formset.save(commit=False)
        for inst in instances:
            if isinstance(inst, AdminMemo):
                was_new = inst.pk is None
                if inst.author_id is None:
                    inst.author = request.user
                inst.save()
                if was_new:
                    _log_moderation(request.user, inst.user, "memo", inst.content[:100])
                continue
            if isinstance(inst, UserSuspension):
                is_new = inst.pk is None
                # 직전 lifted_at 값 비교용
                prev_lifted = None
                if not is_new:
                    prev = UserSuspension.objects.filter(pk=inst.pk).values("lifted_at").first()
                    prev_lifted = prev and prev.get("lifted_at")
                if is_new:
                    if inst.suspended_by_id is None:
                        inst.suspended_by = request.user
                    inst.save()
                    new_expiry = inst.compute_expires_at()
                    if new_expiry != inst.expires_at:
                        inst.expires_at = new_expiry
                        inst.save(update_fields=["expires_at"])
                    _log_moderation(
                        request.user, inst.user, "suspend",
                        f"{inst.duration} / {','.join(inst.scopes or [])} / {inst.reason[:50]}",
                    )
                    continue
                # 해제 처리자 자동 기록
                if inst.lifted_at and inst.lifted_by_id is None:
                    inst.lifted_by = request.user
                inst.save()
                if inst.lifted_at and not prev_lifted:
                    _log_moderation(
                        request.user, inst.user, "lift",
                        inst.lifted_reason or "정지 해제",
                    )
                continue
            inst.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()


@admin.register(UserSuspension)
class UserSuspensionAdmin(admin.ModelAdmin):
    form = SuspensionAdminForm
    list_display = ["user", "status_label_col", "duration", "scopes_short", "reason_short",
                    "suspended_at", "expires_at", "lifted_at", "suspended_by"]
    list_filter = ["duration", "suspended_at", "lifted_at"]
    search_fields = ["user__nickname", "user__email", "reason"]
    autocomplete_fields = ["user", "suspended_by", "lifted_by"]
    readonly_fields = ["suspended_at", "expires_at", "status_label_col"]
    date_hierarchy = "suspended_at"
    fieldsets = (
        ("정지 정보", {"fields": (
            "user", "reason",
            ("duration", "scopes"),
            ("suspended_at", "expires_at"),
            "suspended_by", "status_label_col",
        )}),
        ("해제", {"fields": (
            ("lifted_at", "lifted_by"), "lifted_reason",
        )}),
    )

    @admin.display(description="범위")
    def scopes_short(self, obj):
        if not obj.scopes:
            return "-"
        label_map = dict(UserSuspension.SCOPE_CHOICES)
        return ", ".join(label_map.get(s, s) for s in obj.scopes)

    @admin.display(description="상태")
    def status_label_col(self, obj):
        return obj.status_label if obj.pk else "-"

    @admin.display(description="사유")
    def reason_short(self, obj):
        return (obj.reason or "")[:40]

    def save_model(self, request, obj, form, change):
        creating = obj.pk is None
        if creating and not obj.suspended_by_id:
            obj.suspended_by = request.user
        super().save_model(request, obj, form, change)
        if creating:
            new_expiry = obj.compute_expires_at()
            if new_expiry != obj.expires_at:
                obj.expires_at = new_expiry
                obj.save(update_fields=["expires_at"])
        else:
            if obj.lifted_at and not obj.lifted_by_id:
                obj.lifted_by = request.user
                obj.save(update_fields=["lifted_by"])


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = ["user", "ip_address", "user_agent_short", "login_method", "created_at"]
    list_filter = ["login_method", "created_at"]
    search_fields = ["user__nickname", "user__email", "ip_address", "user_agent"]
    readonly_fields = ["user", "ip_address", "user_agent", "login_method", "created_at"]
    date_hierarchy = "created_at"

    @admin.display(description="디바이스")
    def user_agent_short(self, obj):
        return (obj.user_agent or "")[:60]


@admin.register(AdminMemo)
class AdminMemoAdmin(admin.ModelAdmin):
    list_display = ["user", "content_short", "author", "created_at"]
    search_fields = ["user__nickname", "user__email", "content"]
    autocomplete_fields = ["user", "author"]
    inlines = [AdminMemoImageInline]
    readonly_fields = ["created_at", "updated_at"]

    @admin.display(description="내용")
    def content_short(self, obj):
        return (obj.content or "")[:50]

    def save_model(self, request, obj, form, change):
        if obj.author_id is None:
            obj.author = request.user
        super().save_model(request, obj, form, change)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "notification_type", "title", "is_read", "created_at"]
    list_filter = ["notification_type", "is_read", "created_at"]
    search_fields = ["user__nickname", "title", "body"]


@admin.register(XPLog)
class XPLogAdmin(admin.ModelAdmin):
    list_display = ["user", "amount", "reason", "created_at"]
    list_filter = ["reason", "created_at"]
    search_fields = ["user__nickname", "reason"]


@admin.register(PhoneOTP)
class PhoneOTPAdmin(admin.ModelAdmin):
    list_display = ["phone_number", "code", "verified", "attempts", "expires_at", "created_at"]
    list_filter = ["verified", "created_at"]
    search_fields = ["phone_number"]
    readonly_fields = ["created_at"]


@admin.register(PhoneAuthLog)
class PhoneAuthLogAdmin(admin.ModelAdmin):
    list_display = [
        "phone_number", "event_type", "nickname", "email",
        "ip_address", "created_at",
    ]
    list_filter = ["event_type", "created_at"]
    search_fields = ["phone_number", "nickname", "email", "firebase_uid", "ip_address"]
    readonly_fields = [
        "phone_number", "event_type", "user", "firebase_uid",
        "nickname", "email", "ip_address", "user_agent", "error_message", "created_at",
    ]
    date_hierarchy = "created_at"


@admin.register(AgreementAcceptance)
class AgreementAcceptanceAdmin(admin.ModelAdmin):
    list_display = ["user", "slug", "version", "accepted_at", "ip_address"]
    list_filter = ["slug", "version"]
    search_fields = ["user__nickname", "user__email", "ip_address"]
    readonly_fields = ["user", "slug", "version", "accepted_at", "ip_address", "user_agent"]
    date_hierarchy = "accepted_at"
