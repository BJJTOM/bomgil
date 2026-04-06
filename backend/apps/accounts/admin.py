from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ["nickname", "email", "date_joined", "is_guide", "is_staff"]
    list_filter = ["is_guide", "is_staff", "is_active", "date_joined"]
    search_fields = ["nickname", "email", "username"]
    fieldsets = UserAdmin.fieldsets + (
        ("프로필", {"fields": ("nickname", "profile_image", "bio", "preferred_language", "is_guide")}),
    )
