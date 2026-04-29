/**
 * Edge-runtime helper that fetches a Korean font binary and returns it
 * shaped for next/og's `fonts` option. Without this, ImageResponse on
 * the Edge runtime renders Korean glyphs as boxes — system-ui has no
 * CJK fallback in the V8 isolates Vercel uses.
 *
 * We use Google Fonts' CSS endpoint to find the latest Noto Sans KR
 * binary URL, then cache the bytes for ~1 day.
 */

let _cache: { bold: ArrayBuffer; regular: ArrayBuffer; expiresAt: number } | null = null;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function fetchGoogleFontUrl(family: string, weight: number): Promise<string | null> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&subset=korean&display=swap`,
    {
      headers: {
        // Force the woff2 → ttf fallback so we get a binary font/og
        // can read. The default user-agent gives woff2 (zopfli'd) and
        // satori in next/og has trouble with that.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
      },
    },
  );
  if (!css.ok) return null;
  const text = await css.text();
  // Pull the first src url(...) we see — Google groups by unicode-range
  // and Korean (U+AC00–D7A3) is the largest block listed first.
  const match = text.match(/url\((https:\/\/[^)]+\.(?:ttf|woff2?))\)/);
  return match ? match[1] : null;
}

export async function loadKoreanFonts(): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: 400 | 800; style: "normal" }>
> {
  if (_cache && _cache.expiresAt > Date.now()) {
    return [
      { name: "Noto Sans KR", data: _cache.regular, weight: 400, style: "normal" },
      { name: "Noto Sans KR", data: _cache.bold, weight: 800, style: "normal" },
    ];
  }
  const family = "Noto Sans KR";
  const [boldUrl, regularUrl] = await Promise.all([
    fetchGoogleFontUrl(family, 800),
    fetchGoogleFontUrl(family, 400),
  ]);
  if (!boldUrl || !regularUrl) return [];
  const [boldRes, regRes] = await Promise.all([fetch(boldUrl), fetch(regularUrl)]);
  if (!boldRes.ok || !regRes.ok) return [];
  const [bold, regular] = await Promise.all([
    boldRes.arrayBuffer(),
    regRes.arrayBuffer(),
  ]);
  _cache = { bold, regular, expiresAt: Date.now() + ONE_DAY_MS };
  return [
    { name: "Noto Sans KR", data: regular, weight: 400, style: "normal" },
    { name: "Noto Sans KR", data: bold, weight: 800, style: "normal" },
  ];
}
