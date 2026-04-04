from django.utils import translation


class AcceptLanguageMiddleware:
    """Set Django language based on Accept-Language header for API responses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        lang = request.META.get("HTTP_ACCEPT_LANGUAGE", "ko")
        # Extract primary language code
        lang = lang.split(",")[0].split("-")[0].strip().lower()
        if lang not in ("ko", "en", "ja"):
            lang = "ko"
        translation.activate(lang)
        request.LANGUAGE_CODE = lang
        response = self.get_response(request)
        return response
