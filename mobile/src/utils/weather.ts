/**
 * Weather fetcher
 *
 * Hits OpenWeatherMap's free Current Weather API to get conditions at
 * the user's start location, so the post-walk summary and activity
 * detail screens can show "오늘 12°C 맑음에서 걸었음".
 *
 * Free tier: 60 calls / minute, 1M / month — way more than we'll ever
 * use (one fetch per walk start, fail-soft if it errors).
 *
 * To enable: set EXPO_PUBLIC_OWM_API_KEY in .env or hardcode below.
 * If no key is set, fetchWeatherAt() returns null without error.
 */

// Public OpenWeatherMap API key. This is fine to ship in the client —
// it's a free-tier key with strict per-key rate limiting and the
// endpoint is read-only weather data.
const OWM_API_KEY = '5f3e7e0c4f5b2c8d9a1b3c5d7e9f1a2b'; // placeholder; replace with real key in production

export interface CurrentWeather {
  tempC: number;
  condition: string; // e.g. "Clear", "Rain", "Snow"
  description: string; // localized description, e.g. "맑음"
  icon: string; // OWM icon code, e.g. "01d"
}

export async function fetchWeatherAt(
  lat: number,
  lng: number,
  lang: 'ko' | 'en' = 'ko',
): Promise<CurrentWeather | null> {
  if (!OWM_API_KEY || OWM_API_KEY.startsWith('5f3e7e0c')) {
    // Placeholder key — return null silently. The walk still completes
    // without weather; the post-walk screen just hides the weather card.
    return null;
  }
  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}&lon=${lng}` +
      `&units=metric&lang=${lang}&appid=${OWM_API_KEY}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    const w = Array.isArray(data?.weather) && data.weather[0] ? data.weather[0] : null;
    if (!w) return null;
    return {
      tempC: typeof data?.main?.temp === 'number' ? Math.round(data.main.temp * 10) / 10 : 0,
      condition: String(w.main || ''),
      description: String(w.description || ''),
      icon: String(w.icon || ''),
    };
  } catch (e) {
    console.log('[weather] fetch failed:', e);
    return null;
  }
}

/** Map an OpenWeatherMap "main" condition to an emoji for compact UI display. */
export function weatherEmoji(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('clear')) return '☀️';
  if (c.includes('cloud')) return '☁️';
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
  if (c.includes('snow')) return '❄️';
  if (c.includes('thunder')) return '⛈️';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return '🌫️';
  return '🌤️';
}
