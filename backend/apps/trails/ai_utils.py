import json
import logging
import os

logger = logging.getLogger(__name__)


def generate_trail_description(trail_data: dict) -> dict:
    """Generate trail descriptions in Korean, English, and Japanese using Claude.

    Given trail metadata (title, distance, difficulty, elevation, trail_type,
    region, country, path_data coordinates), generate descriptions in 3 languages.

    Returns:
        {
            'description_ko': str,
            'description_en': str,
            'description_ja': str,
            'suggested_tags': list[str],
            'best_season_reason': str,
        }
    Returns empty dict on failure.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning(
            "ANTHROPIC_API_KEY is not set. Skipping AI description generation."
        )
        return {}

    try:
        import anthropic
    except ImportError:
        logger.warning(
            "anthropic package is not installed. Skipping AI description generation."
        )
        return {}

    # ----- Build context from trail data -----
    title = trail_data.get("title", "")
    distance_km = trail_data.get("distance_km", 0)
    difficulty = trail_data.get("difficulty", "moderate")
    elevation_gain = trail_data.get("elevation_gain")
    trail_type = trail_data.get("trail_type", "mixed")
    region = trail_data.get("region", "")
    country = trail_data.get("country", "KR")
    path_data = trail_data.get("path_data", {})

    # Extract coordinate features
    coords_info = _extract_coordinate_features(path_data, elevation_gain)

    # Map difficulty to Korean label for prompt context
    difficulty_labels = {
        "easy": "easy/beginner-friendly",
        "moderate": "moderate",
        "hard": "challenging/advanced",
    }
    difficulty_desc = difficulty_labels.get(difficulty, difficulty)

    # Map trail_type to descriptive label
    trail_type_labels = {
        "urban": "urban city walk",
        "coastal": "coastal trail",
        "village": "village path",
        "cultural": "cultural heritage trail",
        "nature": "nature trail",
        "mixed": "mixed terrain",
    }
    trail_type_desc = trail_type_labels.get(trail_type, trail_type)

    # Map country code to name
    country_names = {
        "KR": "South Korea",
        "JP": "Japan",
        "TW": "Taiwan",
        "TH": "Thailand",
        "US": "United States",
        "GB": "United Kingdom",
        "FR": "France",
        "ES": "Spain",
    }
    country_name = country_names.get(country, country)

    prompt = f"""You are a travel writer for a walking/hiking trail app called Moru.
Generate trail descriptions based on the following trail information.

Trail Information:
- Title: {title}
- Distance: {distance_km} km
- Difficulty: {difficulty_desc}
- Elevation gain: {elevation_gain if elevation_gain else 'not specified'} meters
- Trail type: {trail_type_desc}
- Region: {region if region else 'not specified'}
- Country: {country_name}
{coords_info}

Requirements:
1. Write a 2-3 sentence description in Korean (description_ko) that feels natural and inviting. Use a warm, conversational tone as if recommending the trail to a friend. Do NOT start with the trail name.
2. Write a 2-3 sentence description in English (description_en) with a similar warm tone. Do NOT start with the trail name.
3. Write a 2-3 sentence description in Japanese (description_ja) with a similar warm tone. Do NOT start with the trail name.
4. Suggest 3-5 relevant Korean tags (suggested_tags) as short keywords without # symbol. Examples: "도심산책", "바다뷰", "벚꽃길", "야경", "맛집골목"
5. Write a brief reason for the best season to walk this trail (best_season_reason) in Korean, 1 sentence.

Respond ONLY with valid JSON in this exact format:
{{
  "description_ko": "...",
  "description_en": "...",
  "description_ja": "...",
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "best_season_reason": "..."
}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-5-20250514",
            max_tokens=1024,
            timeout=30.0,
            messages=[
                {"role": "user", "content": prompt},
            ],
        )

        # Extract text content from response
        response_text = ""
        for block in message.content:
            if block.type == "text":
                response_text += block.text

        # Parse JSON from response
        # Handle cases where Claude wraps response in markdown code blocks
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            # Strip markdown code fence
            lines = cleaned.split("\n")
            # Remove first line (```json) and last line (```)
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)

        result = json.loads(cleaned)

        # Validate expected keys
        expected_keys = {
            "description_ko",
            "description_en",
            "description_ja",
            "suggested_tags",
            "best_season_reason",
        }
        if not expected_keys.issubset(result.keys()):
            logger.warning(
                "AI response missing expected keys. Got: %s", list(result.keys())
            )
            return {}

        # Ensure suggested_tags is a list of strings
        if not isinstance(result["suggested_tags"], list):
            result["suggested_tags"] = []

        return result

    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI response as JSON: %s", e)
        return {}
    except Exception as e:
        logger.error("AI description generation failed: %s", e)
        return {}


def _extract_coordinate_features(path_data: dict, elevation_gain) -> str:
    """Analyze path_data coordinates and extract notable geographic features."""
    if not path_data or not isinstance(path_data, dict):
        return ""

    coordinates = path_data.get("coordinates", [])
    if not coordinates or len(coordinates) < 2:
        return ""

    info_parts = []

    # Start / end coordinates
    start = coordinates[0]
    end = coordinates[-1]
    info_parts.append(
        f"- Start coordinates: ({start[1]:.4f}, {start[0]:.4f})"
    )
    info_parts.append(
        f"- End coordinates: ({end[1]:.4f}, {end[0]:.4f})"
    )

    # Infer terrain characteristics
    features = []

    # Check elevation characteristics
    elev = int(elevation_gain) if elevation_gain else 0
    if elev > 300:
        features.append("significant elevation change (mountainous terrain)")
    elif elev > 100:
        features.append("moderate elevation change (hilly terrain)")
    elif elev < 30:
        features.append("mostly flat terrain")

    # Check latitude patterns for coastal hints
    # Coastal areas in Korea are typically at certain latitude/longitude ranges
    if len(coordinates) > 0:
        lats = [c[1] for c in coordinates if len(c) >= 2]
        lngs = [c[0] for c in coordinates if len(c) >= 2]

        if lats and lngs:
            avg_lat = sum(lats) / len(lats)
            avg_lng = sum(lngs) / len(lngs)

            # Korean coastal detection (rough heuristic)
            # East coast: lng > 129
            # South coast: lat < 35 and lng between 126-129
            # West coast: lng < 126.5
            if avg_lng > 129.0 and 35.0 < avg_lat < 38.5:
                features.append("likely near the East Coast of Korea")
            elif avg_lat < 35.0 and 126.0 < avg_lng < 129.0:
                features.append("likely near the South Coast of Korea")
            elif avg_lng < 126.5 and 34.0 < avg_lat < 38.0:
                features.append("likely near the West Coast of Korea")

            # Jeju detection
            if 33.0 < avg_lat < 33.7 and 126.0 < avg_lng < 127.0:
                features.append("located on Jeju Island")

            # Urban Seoul detection
            if 37.4 < avg_lat < 37.7 and 126.8 < avg_lng < 127.2:
                features.append("within Seoul metropolitan area")

            info_parts.append(f"- Number of path points: {len(coordinates)}")

    if features:
        info_parts.append(f"- Terrain features: {', '.join(features)}")

    return "\n".join(info_parts) if info_parts else ""
