from django.contrib import admin

from .models import Spot, SpotImage


class SpotImageInline(admin.TabularInline):
    model = SpotImage
    extra = 1


@admin.register(Spot)
class SpotAdmin(admin.ModelAdmin):
    list_display = ["name", "trail", "spot_type", "order", "status"]
    list_filter = ["spot_type", "status"]
    inlines = [SpotImageInline]
