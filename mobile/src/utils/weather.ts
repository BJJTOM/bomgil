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
    // 8s cap — weather is best-effort; don't make the walk startup wait.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
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

/** Map an OpenWeatherMap "main" condition to a localized label. */
const WEATHER_LABELS: Record<string, Record<string, string>> = {
  clear:   { ko: '맑음', en: 'Clear', ja: '晴れ', zh: '晴' },
  clouds:  { ko: '흐림', en: 'Cloudy', ja: '曇り', zh: '多云' },
  rain:    { ko: '비', en: 'Rain', ja: '雨', zh: '雨' },
  drizzle: { ko: '이슬비', en: 'Drizzle', ja: '霧雨', zh: '毛毛雨' },
  snow:    { ko: '눈', en: 'Snow', ja: '雪', zh: '雪' },
  thunderstorm: { ko: '뇌우', en: 'Storm', ja: '雷雨', zh: '雷暴' },
  mist:    { ko: '안개', en: 'Mist', ja: '霧', zh: '雾' },
  fog:     { ko: '안개', en: 'Fog', ja: '霧', zh: '雾' },
  haze:    { ko: '연무', en: 'Haze', ja: '靄', zh: '霾' },
};

export function weatherLabel(condition: string, lang: string = 'ko'): string {
  const c = condition.toLowerCase();
  for (const [key, labels] of Object.entries(WEATHER_LABELS)) {
    if (c.includes(key)) return labels[lang] || labels.ko;
  }
  return condition;
}

/** Map an OpenWeatherMap "main" condition to a Feather icon name. */
export function weatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('clear')) return 'sun';
  if (c.includes('cloud')) return 'cloud';
  if (c.includes('rain') || c.includes('drizzle')) return 'cloud-rain';
  if (c.includes('snow')) return 'cloud-snow';
  if (c.includes('thunder')) return 'cloud-lightning';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return 'cloud';
  return 'sun';
}

/** @deprecated Use weatherLabel + weatherIcon instead */
export function weatherEmoji(condition: string): string {
  return weatherLabel(condition, 'ko');
}
