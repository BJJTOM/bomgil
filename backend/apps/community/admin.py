"""
Community admin — full moderation panel.

Every content model gets:
  - rich list_display (id, author, key fields, hidden state, created_at)
  - search across content + author
  - filter by category, status, hidden
  - date_hierarchy by created_at
  - "Hide selected" / "Unhide selected" bulk actions
  - clickable author links to the user admin
"""
from django import forms
from django.contrib import admin
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from django.utils.html import format_html, format_html_join
from django.urls import reverse

from apps.moderation.models import AIModerationLog

from .models import (
    Post, PostImage, PostComment, PostBookmark,
    Report, UserBlock,
    Group, GroupMember, GroupMessage,
    Challenge, ChallengeParticipant,
    Notice, SiteConfig,
    LegalDocument,
)


# ── 커뮤니티 앱 사이드바 순서 고정 ──────────────────────────────
_COMMUNITY_ORDER = [
    "Post",                  # 게시글
    "PostComment",           # 댓글
    "PostImage",             # 게시글 이미지
    "PostBookmark",          # 게시글 북마크
    "Group",                 # 모임
    "GroupMember",           # 모임 멤버
    "GroupMessage",          # 모임 메시지
    "Challenge",             # 챌린지
    "ChallengeParticipant",  # 챌린지 참가자
    "Report",                # 신고
    "UserBlock",             # 유저 차단
    "SiteConfig",            # 사이트 설정
    "LegalDocument",         # 약관·방침 문서
    "Notice",                # 공지사항 (항상 맨 아래)
]

_prev_get_app_list = admin.AdminSite.get_app_list


def _community_ordered_get_app_list(self, request, app_label=None):
    app_list = _prev_get_app_list(self, request, app_label)
    for app in app_list:
        if app.get("app_label") != "community":
            continue
        def _key(model):
            name = model.get("object_name", "")
            try:
                return (0, _COMMUNITY_ORDER.index(name))
            except ValueError:
                return (1, name)
        app["models"].sort(key=_key)
    return app_list


admin.AdminSite.get_app_list = _community_ordered_get_app_list


class AIFlaggedFilter(admin.SimpleListFilter):
    """Filter content by AI moderation result."""
    title = "AI 모더레이션"
    parameter_name = "ai_flag"

    def lookups(self, request, model_admin):
        return [
            ("flagged", "AI 차단/검토"),
            ("rejected", "AI 차단"),
            ("review", "AI 검토 필요"),
            ("approved", "AI 승인"),
        ]

    def queryset(self, request, queryset):
        if not self.value():
            return queryset
        ct = ContentType.objects.get_for_model(queryset.model)
        logs = AIModerationLog.objects.filter(content_type=ct)
        if self.value() == "flagged":
            ids = logs.filter(action__in=["reject", "review"]).values_list("object_id", flat=True)
        elif self.value() == "rejected":
            ids = logs.filter(action="reject").values_list("object_id", flat=True)
        elif self.value() == "review":
            ids = logs.filter(action="review").values_list("object_id", flat=True)
        elif self.value() == "approved":
            ids = logs.filter(action="approve").values_list("object_id", flat=True)
        else:
            return queryset
        return queryset.filter(pk__in=ids)


# ── Reusable hide/unhide actions ────────────────────────────────────
@admin.action(description="🚫 선택한 항목 숨김 (소프트 삭제)")
def hide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=False).update(
        is_hidden=True,
        hidden_at=timezone.now(),
    )
    modeladmin.message_user(request, f"{updated}개 항목을 숨겼습니다.")


@admin.action(description="✅ 선택한 항목 다시 보이기")
def unhide_selected(modeladmin, request, queryset):
    updated = queryset.filter(is_hidden=True).update(
        is_hidden=False,
        hidden_at=None,
    )
    modeladmin.message_user(request, f"{updated}개 항목을 복원했습니다.")


def author_link(obj, attr="author"):
    user = getattr(obj, attr, None)
    if not user:
        return "-"
    url = reverse("admin:accounts_customuser_change", args=[user.pk])
    return format_html('<a href="{}">{}</a>', url, user.nickname or user.username)


def hidden_badge(obj):
    if getattr(obj, 'is_hidden', False):
        return format_html(
            '<span style="color:#fff;background:#EF4444;padding:2px 8px;'
            'border-radius:8px;font-size:11px;font-weight:600;">숨김</span>'
        )
    return format_html('<span style="color:#22C55E;font-size:11px;font-weight:600;">공개</span>')


def _ai_badge(obj):
    """Show the latest AI moderation result as a colored badge."""
    ct = ContentType.objects.get_for_model(obj)
    log = AIModerationLog.objects.filter(content_type=ct, object_id=obj.pk).order_by("-created_at").first()
    if not log:
        return format_html('<span style="color:#9CA3AF;font-size:11px;">-</span>')
    colors = {
        "approve": "#22C55E",
        "review": "#F59E0B",
        "reject": "#EF4444",
        "error": "#9CA3AF",
    }
    labels = {
        "approve": "OK",
        "review": "검토",
        "reject": "차단",
        "error": "오류",
    }
    bg = colors.get(log.action, "#9CA3AF")
    label = labels.get(log.action, log.action)
    return format_html(
        '<span style="color:#fff;background:{};padding:2px 6px;'
        'border-radius:8px;font-size:10px;font-weight:600;">{}</span>',
        bg, label,
    )


# ── Post ────────────────────────────────────────────────────────────
class PostImageInline(admin.TabularInline):
    model = PostImage
    extra = 0
    fields = ('preview', 'image', 'order')
    readonly_fields = ('preview',)
    verbose_name = '업로드 이미지'
    verbose_name_plural = '업로드 이미지'

    @admin.display(description='미리보기')
    def preview(self, obj):
        if obj and obj.pk and obj.image:
            return format_html(
                '<a href="{0}" target="_blank"><img src="{0}" '
                'style="max-height:100px;border-radius:6px;'
                'border:1px solid #E5E8EB;" /></a>',
                obj.image.url,
            )
        return '-'


class PostAdminForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = '__all__'
        labels = {
            'author': '작성자',
            'category': '카테고리',
            'title': '제목',
            'content': '내용',
            'images': '이미지 URL 목록',
            'trail': '연관 코스',
            'like_count': '좋아요 수',
            'comment_count': '댓글 수',
            'view_count': '조회 수',
            'bookmark_count': '북마크 수',
            'is_pinned': '상단 고정',
            'is_hidden': '숨김 여부',
            'hidden_at': '숨김 일시',
            'hidden_reason': '숨김 사유',
            'created_at': '작성일',
            'updated_at': '수정일',
        }


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    form = PostAdminForm
    list_display = [
        'id', 'title', 'author_display', 'category', 'like_count',
        'comment_count', 'view_count', 'report_count_badge',
        'status_badge', 'ai_status', 'created_at',
    ]
    list_filter = ['category', 'is_hidden', 'is_pinned', AIFlaggedFilter, 'created_at']
    search_fields = ['title', 'content', 'author__nickname', 'author__username']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = [
        'author_admin_link', 'image_gallery', 'report_count_detail',
        'like_count', 'comment_count', 'view_count', 'bookmark_count',
        'hidden_at', 'created_at', 'updated_at',
    ]
    actions = [hide_selected, unhide_selected]
    inlines = [PostImageInline]
    list_per_page = 50

    fieldsets = (
        ('게시글 정보', {
            'fields': (
                'author_admin_link',
                ('category', 'title'),
                'content',
                'trail',
            ),
        }),
        ('첨부 이미지', {
            'fields': ('image_gallery',),
            'description': 'JSONField(images) + 업로드된 PostImage 인라인을 한 번에 미리보기',
        }),
        ('통계', {
            'fields': (
                ('like_count', 'comment_count'),
                ('view_count', 'bookmark_count'),
                'report_count_detail',
            ),
        }),
        ('모더레이션', {
            'fields': (
                ('is_pinned', 'is_hidden'),
                'hidden_at',
                'hidden_reason',
            ),
        }),
        ('타임스탬프', {
            'classes': ('collapse',),
            'fields': (('created_at', 'updated_at'),),
        }),
    )

    # ── 리스트용 컬럼 ───────────────────────────────────────────
    @admin.display(description='작성자')
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description='상태', ordering='is_hidden')
    def status_badge(self, obj):
        return hidden_badge(obj)

    @admin.display(description='AI')
    def ai_status(self, obj):
        return _ai_badge(obj)

    @admin.display(description='신고')
    def report_count_badge(self, obj):
        cnt = Report.objects.filter(target_type='post', target_id=obj.pk).count()
        if cnt == 0:
            return format_html('<span style="color:#9CA3AF;font-size:11px;">0</span>')
        color = '#EF4444' if cnt >= 3 else '#F59E0B'
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;border-radius:8px;'
            'font-size:11px;font-weight:600;">🚩 {}건</span>',
            color, cnt,
        )

    # ── 상세용 필드 ─────────────────────────────────────────────
    @admin.display(description='작성자 (바로가기)')
    def author_admin_link(self, obj):
        if not obj or not obj.author_id:
            return '-'
        url = reverse('admin:accounts_customuser_change', args=[obj.author_id])
        name = obj.author.nickname or obj.author.username
        return format_html(
            '<a href="{}" style="display:inline-flex;align-items:center;gap:8px;'
            'padding:6px 12px;background:#F0F7F0;border:1px solid #c7e3c9;'
            'border-radius:8px;color:#2D4A2E;font-weight:600;text-decoration:none;">'
            '👤 {} <span style="color:#6b7280;font-weight:400;font-size:11px;">ID: {}</span>'
            '</a>',
            url, name, obj.author_id,
        )

    @admin.display(description='첨부 이미지 갤러리')
    def image_gallery(self, obj):
        if not obj or not obj.pk:
            return '저장 후 표시됩니다.'
        urls = []
        for pi in obj.post_images.all().order_by('order'):
            if pi.image:
                urls.append(pi.image.url)
        for url in (obj.images or []):
            if url and url not in urls:
                urls.append(url)
        if not urls:
            return format_html('<span style="color:#9CA3AF;">첨부 이미지 없음</span>')
        items = format_html_join(
            '', (
                '<a href="{0}" target="_blank" style="display:inline-block;">'
                '<img src="{0}" style="max-height:160px;max-width:200px;'
                'border-radius:8px;border:1px solid #E5E8EB;'
                'box-shadow:0 1px 3px rgba(0,0,0,0.05);" />'
                '</a>'
            ),
            ((u,) for u in urls),
        )
        return format_html(
            '<div style="display:flex;flex-wrap:wrap;gap:10px;padding:6px 0;">{}</div>'
            '<div style="color:#6b7280;font-size:11px;margin-top:6px;">총 {}장</div>',
            items, len(urls),
        )

    @admin.display(description='신고 현황')
    def report_count_detail(self, obj):
        if not obj or not obj.pk:
            return '-'
        qs = Report.objects.filter(target_type='post', target_id=obj.pk)
        total = qs.count()
        if total == 0:
            return format_html('<span style="color:#22C55E;font-weight:600;">✓ 신고 없음</span>')
        by_reason = qs.values_list('reason', flat=True)
        reason_map = dict(Report.REASON_CHOICES)
        from collections import Counter
        counter = Counter(by_reason)
        rows = ''.join(
            f'<li>{reason_map.get(r, r)}: <b>{c}건</b></li>'
            for r, c in counter.most_common()
        )
        list_url = reverse('admin:community_report_changelist') + f'?target_type__exact=post'
        return format_html(
            '<div style="display:flex;align-items:center;gap:12px;">'
            '<span style="background:#EF4444;color:#fff;padding:4px 12px;'
            'border-radius:10px;font-weight:700;">🚩 총 {}건</span>'
            '<ul style="margin:0;padding-left:18px;color:#4b5563;font-size:12px;">{}</ul>'
            '<a href="{}" style="color:#2D4A2E;font-weight:600;font-size:12px;">전체 신고 보기 →</a>'
            '</div>',
            total, format_html(rows), list_url,
        )


@admin.register(PostComment)
class PostCommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'short_content', 'author_display', 'post', 'parent', 'like_count', 'status_badge', 'ai_status', 'created_at']
    list_filter = ['is_hidden', 'is_deleted', AIFlaggedFilter, 'created_at']
    search_fields = ['content', 'author__nickname']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['like_count', 'hidden_at']
    actions = [hide_selected, unhide_selected]
    list_per_page = 100

    @admin.display(description='댓글 내용')
    def short_content(self, obj):
        return obj.content[:60] + "..." if len(obj.content) > 60 else obj.content

    @admin.display(description='작성자')
    def author_display(self, obj):
        return author_link(obj)

    @admin.display(description='상태', ordering='is_hidden')
    def status_badge(self, obj):
        if obj.is_hidden:
            return format_html('<span style="color:#fff;background:#EF4444;padding:2px 8px;border-radius:8px;font-size:11px;">숨김</span>')
        if obj.is_deleted:
            return format_html('<span style="color:#fff;background:#9CA3AF;padding:2px 8px;border-radius:8px;font-size:11px;">유저삭제</span>')
        return format_html('<span style="color:#22C55E;font-size:11px;">공개</span>')

    @admin.display(description='AI')
    def ai_status(self, obj):
        return _ai_badge(obj)


# PostLike / CommentLike 는 어드민 사이드바에서 제외 (불필요한 데이터 양 축소)


@admin.register(PostBookmark)
class PostBookmarkAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_at']
    search_fields = ['user__nickname', 'post__title']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


# ── Reports & Blocks ────────────────────────────────────────────────
@admin.register(Report)
class CommunityReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'reporter', 'target_type', 'target_id', 'reason', 'status', 'created_at']
    list_filter = ['target_type', 'reason', 'status', 'created_at']
    search_fields = ['reporter__nickname', 'detail']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    list_editable = ['status']


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ['blocker', 'blocked', 'created_at']
    search_fields = ['blocker__nickname', 'blocked__nickname']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


# ── Groups & messages ───────────────────────────────────────────────
@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'owner_display', 'category', 'member_count', 'is_public', 'status_badge', 'created_at']
    list_filter = ['category', 'is_public', 'is_hidden', 'created_at']
    search_fields = ['name', 'description', 'owner__nickname']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['member_count', 'hidden_at']
    actions = [hide_selected, unhide_selected]

    @admin.display(description='소유자')
    def owner_display(self, obj):
        return author_link(obj, 'owner')

    @admin.display(description='상태', ordering='is_hidden')
    def status_badge(self, obj):
        return hidden_badge(obj)


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ['group', 'user', 'role', 'joined_at']
    list_filter = ['role']
    search_fields = ['group__name', 'user__nickname']
    date_hierarchy = 'joined_at'
    ordering = ['-joined_at']


@admin.register(GroupMessage)
class GroupMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'short_content', 'sender_display', 'group', 'status_badge', 'ai_status', 'created_at']
    list_filter = ['is_hidden', AIFlaggedFilter, 'created_at']
    search_fields = ['content', 'sender__nickname', 'group__name']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['hidden_at']
    actions = [hide_selected, unhide_selected]
    list_per_page = 100

    @admin.display(description='내용')
    def short_content(self, obj):
        return obj.content[:50] + '…' if len(obj.content) > 50 else obj.content

    @admin.display(description='보낸 사람')
    def sender_display(self, obj):
        return author_link(obj, 'sender')

    @admin.display(description='상태', ordering='is_hidden')
    def status_badge(self, obj):
        return hidden_badge(obj)

    @admin.display(description='AI')
    def ai_status(self, obj):
        return _ai_badge(obj)


# ── Challenge ───────────────────────────────────────────────────────
@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ['title', 'challenge_type', 'status', 'goal_value', 'participant_count', 'start_date', 'end_date']
    list_filter = ['status', 'challenge_type']
    search_fields = ['title', 'description']
    date_hierarchy = 'start_date'
    ordering = ['-start_date']


@admin.register(ChallengeParticipant)
class ChallengeParticipantAdmin(admin.ModelAdmin):
    list_display = ['challenge', 'user', 'current_value', 'completed', 'joined_at']
    list_filter = ['completed']
    search_fields = ['user__nickname', 'challenge__title']
    date_hierarchy = 'joined_at'
    ordering = ['-joined_at']


# ── Site Config ─────────────────────────────────────────────────────
@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'instagram_url', 'threads_url', 'youtube_url', 'updated_at']
    readonly_fields = ['updated_at']
    fieldsets = [
        ('소셜 링크', {'fields': ['instagram_url', 'threads_url', 'youtube_url']}),
        ('사업자 정보', {'fields': [
            'business_name', 'representative', 'business_number',
            'location_service_number', 'telecom_number', 'contact_email',
        ]}),
        ('기타', {'fields': ['updated_at']}),
    ]

    def has_add_permission(self, request):
        return not SiteConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


# ── Notice ──────────────────────────────────────────────────────────
@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_pinned', 'is_published', 'created_at', 'updated_at']
    list_filter = ['is_pinned', 'is_published']
    search_fields = ['title', 'content']
    list_editable = ['is_pinned', 'is_published']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


# ── LegalDocument ───────────────────────────────────────────────────
@admin.register(LegalDocument)
class LegalDocumentAdmin(admin.ModelAdmin):
    list_display = ['slug', 'version', 'title', 'effective_from', 'is_published', 'updated_at']
    list_filter = ['slug', 'is_published']
    search_fields = ['slug', 'title', 'body_markdown']
    list_editable = ['is_published']
    ordering = ['slug', '-effective_from']
    fieldsets = [
        ('기본', {'fields': ['slug', 'title', 'version', 'effective_from', 'is_published']}),
        ('본문 (Markdown)', {'fields': ['body_markdown']}),
    ]
