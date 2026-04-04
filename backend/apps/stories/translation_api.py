from rest_framework.views import APIView
from rest_framework.response import Response


class TranslateView(APIView):
    """Simple mock translation API. In production, integrate Google Translate or DeepL."""

    def post(self, request):
        text = request.data.get("text", "")
        target = request.data.get("target", "en")  # ko, en, ja, zh

        # Mock: In production, call actual translation API
        # For now, return a placeholder that indicates translation was requested
        translations = {
            "en": f"[EN] {text[:200]}",
            "ja": f"[JA] {text[:200]}",
            "ko": f"[KO] {text[:200]}",
            "zh": f"[ZH] {text[:200]}",
        }

        return Response({
            "original": text,
            "translated": translations.get(target, text),
            "target": target,
            "is_mock": True,  # Flag to show "powered by AI translation" in UI
        })
