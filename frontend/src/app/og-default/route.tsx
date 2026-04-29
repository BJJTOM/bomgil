import { ImageResponse } from "next/og";
import { loadKoreanFonts } from "../_lib/ogFont";

export const runtime = "edge";

export async function GET() {
  const fonts = await loadKoreanFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #2D4A2E 0%, #3D6B4A 60%, #A8E6CF 100%)",
          color: "#ffffff",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 150, marginBottom: 24, lineHeight: 1 }}>🌿</div>
        <div
          style={{
            fontSize: 100,
            fontWeight: 800,
            letterSpacing: -3,
            marginBottom: 12,
          }}
        >
          Moru
        </div>
        <div style={{ fontSize: 36, opacity: 0.9, fontWeight: 500 }}>
          함께 걷고, 함께 기록하는 도보여행
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 22,
            opacity: 0.7,
            letterSpacing: 6,
          }}
        >
          MORUWALK.COM
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
