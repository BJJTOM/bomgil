import { ImageResponse } from "next/og";
import { loadKoreanFonts } from "../../_lib/ogFont";

export const runtime = "edge";
export const alt = "Moru — 도보여행 코스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.moruwalk.com/api/v1";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Try to fetch trail metadata for richer cards. If anything fails we
  // fall through to the brand-only fallback so OG scrapers always get
  // something usable.
  let title = "Moru 코스";
  let region = "";
  let distance = "";
  let duration = "";
  try {
    const res = await fetch(`${API_BASE}/trails/${id}/`, {
      next: { revalidate: 1800 },
    });
    if (res.ok) {
      const t = await res.json();
      title = t.title || title;
      region = t.region || "";
      if (t.distance_km != null) distance = `${Number(t.distance_km).toFixed(1)} km`;
      if (t.estimated_minutes != null) {
        const m = Number(t.estimated_minutes);
        duration = m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
      }
    }
  } catch {
    /* fall through to brand fallback */
  }

  const fonts = await loadKoreanFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 80px",
          background:
            "linear-gradient(135deg, #2D4A2E 0%, #3D6B4A 55%, #A8E6CF 100%)",
          color: "#FFFFFF",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
        }}
      >
        {/* Top brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 54, lineHeight: 1 }}>🌿</div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: -0.5,
            }}
          >
            Moru
          </div>
          <div
            style={{
              fontSize: 18,
              opacity: 0.75,
              marginLeft: 6,
            }}
          >
            걸으면 보이는 것들
          </div>
        </div>

        {/* Region tag */}
        {region && (
          <div
            style={{
              marginTop: 60,
              alignSelf: "flex-start",
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            📍 {region}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            display: "flex",
            marginTop: region ? 24 : 84,
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1.1,
            maxWidth: "100%",
          }}
        >
          {title}
        </div>

        {/* Bottom stats row */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            gap: 36,
            alignItems: "flex-end",
          }}
        >
          {distance && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 16, opacity: 0.7, letterSpacing: 3 }}>
                DISTANCE
              </div>
              <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>
                {distance}
              </div>
            </div>
          )}
          {duration && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 16, opacity: 0.7, letterSpacing: 3 }}>
                TIME
              </div>
              <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>
                {duration}
              </div>
            </div>
          )}
          <div
            style={{
              marginLeft: "auto",
              fontSize: 18,
              opacity: 0.75,
              letterSpacing: 4,
            }}
          >
            MORUWALK.COM
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
