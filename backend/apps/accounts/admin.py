from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser, Notification, XPLog


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = [
        "nickname", "phone_number", "phone_verified", "email",
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
