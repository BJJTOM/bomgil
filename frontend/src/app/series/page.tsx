/**
 * Series listing page — server-rendered catalog of all trail series
 * with per-series progress summary (anonymous, since SSR has no
 * auth). Users see "이만큼을 걸어봐요" style marketing; once logged
 * in on mobile they see real per-user progress.
 */
import type { Metadata } from "next";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.moruwalk.com/api/v1";

export const revalidate = 900;

type Series = {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  region?: string;
  accent_emoji?: string;
  is_featured?: boolean;
  progress_total: number;
};

export const metadata: Metadata = {
  title: "시리즈 도전 · Moru",
  description: "장거리 걷기 코스를 구간별로 완주하는 Moru 시리즈 챌린지 모음",
  openGraph: {
    title: "시리즈 도전 · Moru",
    description: "장거리 걷기 코스 챌린지",
    type: "website",
    locale: "ko_KR",
  },
  alternates: {
    canonical: "https://moruwalk.com/series",
  },
};

async function fetchSeries(): Promise<Series[]> {
  try {
    const res = await fetch(`${API_BASE}/trails/series/`, {
      next: { revalidate: 900, tags: ["trail-series"] },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.results ?? []);
  } catch {
    return [];
  }
}

export default async function SeriesListPage() {
  const series = await fetchSeries();

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1a3a1b] via-[#2D4A2E] to-[#1e442f] pt-20 md:pt-24 pb-12 px-5 text-white">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/explore"
            className="text-[13px] text-white/70 hover:text-white inline-flex items-center gap-1 mb-4">
            ← 탐색
          </Link>
          <h1 className="text-[32px] font-bold tracking-tight mb-2">
            시리즈 도전
          </h1>
          <p className="text-[15px] text-white/80 leading-relaxed max-w-2xl">
            여러 코스를 하나의 여정으로 묶어 구간별로 걸어보세요. 모바일 앱에
            로그인하면 진행률이 자동으로 기록됩니다.
          </p>
        </div>
      </div>

      {/* Series grid */}
      <div className="max-w-4xl mx-auto px-5 pt-8">
        {series.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-3xl mb-3">🚶</div>
            <p className="text-[15px] font-semibold text-gray-900 mb-1">
              시리즈가 아직 없어요
            </p>
            <p className="text-[13px] text-gray-400">
              곧 새로운 챌린지를 추가할 예정이에요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {series.map((s) => (
              <Link
                key={s.id}
                href={`/series/${s.slug}`}
                className="group bg-white rounded-2xl p-6 border border-[#E5E8EB] hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#F0F7F0] flex items-center justify-center flex-shrink-0">
                    <span className="text-[28px]">{s.accent_emoji || "🚶"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[17px] font-bold text-[#191F28] truncate">
                        {s.title}
                      </h3>
                      {s.is_featured && (
                        <span className="bg-[#F59E0B] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          추천
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#8B95A1] mb-3 line-clamp-2">
                      {s.subtitle || s.region || ""}
                    </p>
                    <p className="text-[12px] text-[#6B7F6C] font-semibold">
                      총 {s.progress_total}개 구간
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
