from rest_framework.pagination import CursorPagination, LimitOffsetPagination, PageNumberPagination


class DefaultCursorPagination(CursorPagination):
    page_size = 20
    ordering = "-created_at"


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class TrailPagination(LimitOffsetPagination):
    default_limit = 21
    max_limit = 100
