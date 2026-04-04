from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ["username", "nickname", "email", "is_guide", "is_staff"]
    fieldsets = UserAdmin.fieldsets + (
        ("Profile", {"fields": ("nickname", "profile_image", "bio", "preferred_language", "is_guide")}),
    )
