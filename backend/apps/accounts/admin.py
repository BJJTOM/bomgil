from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AgreementAcceptance, CustomUser, Notification, PhoneAuthLog, PhoneOTP, XPLog


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    ordering = ["-date_joined"]
    list_display = [
        "id", "nickname", "phone_number", "phone_verified", "email",
        "level", "xp", "is_active", "date_joined",
    ]
    list_filter = [
        "phone_verified", "is_verified", "is_active", "is_staff",
        "is_guide", "level", "date_joined",
    ]
    search_fields = ["nickname", "email", "username", "phone_number", "firebase_uid"]
    readonly_fields = ["firebase_uid", "date_joined", "last_login", "created_at", "updated_at"]
    fieldsets = UserAdmin.fieldsets + (
        ("프로필", {
            "fields": ("nickname", "profile_image", "bio", "one_liner",
                       "preferred_language", "is_guide", "age_range", "walking_style"),
        }),
        ("전화번호 인증", {
            "fields": ("phone_number", "phone_verified", "firebase_uid"),
        }),
        ("XP & 레벨", {
            "fields": ("xp", "level"),
        }),
        ("인증 상태", {
            "fields": ("is_verified", "verification_level"),
        }),
        ("타임스탬프", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).order_by('-date_joined')


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
