/**
 * Series listing page -- server-rendered catalog of all trail series.
 *
 * Redesigned with a motivating hero section, rich series cards showing
 * trail count + total distance, featured badges, and progress bars
 * (populated when the API returns per-user data via mobile auth).
 */
import type { Metadata } from "next";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.moruwalk.com/api/v1";

export const revalidate = 60;

type Series = {
  id: number;
  slug: string;
  title: string;
  title_en?: string;
  subtitle?: string;
  region?: string;
  accent_emoji?: string;
  is_featured?: boolean;
  progress_completed: number;
  progress_total: number;
  progress_pct: number;
  total_distance_km: number;
  total_minutes: number;
  total_completers: number;
};

export const metadata: Metadata = {
  title: "시리즈 도전 · Moru",
  description:
    "여러 코스를 연결해 완주에 도전하는 Moru 시리즈 챌린지. 해파랑길, 남파랑길, 서해랑길 등 대한민국 대표 장거리 트레일을 구간별로 걸어보세요.",
  openGraph: {
    title: "시리즈 도전 · Moru",
    description: "여러 코스를 연결해 완주에 도전해보세요",
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
      next: { revalidate: 60, tags: ["trail-series"] },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.results ?? []);
  } catch {
    return [];
  }
}

function formatDistance(km: number): string {
  if (!km) return "- km";
  return km >= 1 ? `${km.toFixed(1)}km` : `${Math.round(km * 1000)}m`;
}

function formatDuration(minutes: number): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `약 ${h}시간 ${m}분`;
  if (h > 0) return `약 ${h}시간`;
  return `${m}분`;
}

export default async function SeriesListPage() {
  const series = await fetchSeries();

  const featured = series.filter((s) => s.is_featured);
  const regular = series.filter((s) => !s.is_featured);

  return (
    <div
      className="min-h-screen pb-24"
      style={{ backgroundColor: "var(--c-warm)" }}>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0f2b10] via-[#1a3a1b] to-[#1e442f] pt-20 md:pt-28 pb-16 md:pb-20 px-5 text-white">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/[0.03]" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/[0.03]" />

        <div className="max-w-4xl mx-auto relative">
          <Link
            href="/explore"
            className="text-[13px] text-white/60 hover:text-white/90 inline-flex items-center gap-1 mb-6 transition-colors">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            탐색
          </Link>

          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-[36px] md:text-[42px] font-bold tracking-tight">
              시리즈 도전
            </h1>
          </div>
          <p className="text-[16px] md:text-[17px] text-white/80 leading-relaxed max-w-xl">
            여러 코스를 연결해 완주에 도전해보세요.
            <br className="hidden md:block" />
            한 걸음씩 걸으면 어느새 수십 킬로미터를 완주하게 됩니다.
          </p>

          {/* Quick stats */}
          {series.length > 0 && (
            <div className="flex gap-6 mt-8">
              <div>
                <p className="text-[24px] font-bold">{series.length}</p>
                <p className="text-[12px] text-white/50 mt-0.5">시리즈</p>
              </div>
              <div className="w-px bg-white/15" />
              <div>
                <p className="text-[24px] font-bold">
                  {series.reduce((s, c) => s + (c.progress_total || 0), 0)}
                </p>
                <p className="text-[12px] text-white/50 mt-0.5">전체 코스</p>
              </div>
              <div className="w-px bg-white/15" />
              <div>
                <p className="text-[24px] font-bold">
                  {Math.round(
                    series.reduce(
                      (s, c) => s + (c.total_distance_km || 0),
                      0
                    )
                  )}
                  <span className="text-[14px] font-normal text-white/60">
                    km
                  </span>
                </p>
                <p className="text-[12px] text-white/50 mt-0.5">총 거리</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-5 pt-8">
        {series.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-4xl mb-4">🥾</div>
            <p className="text-[16px] font-semibold text-[var(--c-text-primary)] mb-2">
              시리즈가 아직 없어요
            </p>
            <p className="text-[13px] text-[var(--c-text-secondary)]">
              곧 새로운 걷기 챌린지가 추가될 예정이에요
            </p>
          </div>
        ) : (
          <>
            {/* Featured section */}
            {featured.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block w-1 h-5 bg-[#2D4A2E] rounded-full" />
                  <h2 className="text-[15px] font-bold text-[var(--c-text-primary)]">
                    추천 시리즈
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {featured.map((s) => (
                    <SeriesCard key={s.id} series={s} />
                  ))}
                </div>
              </section>
            )}

            {/* Other series */}
            {regular.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block w-1 h-5 bg-[var(--c-text-tertiary)] rounded-full" />
                  <h2 className="text-[15px] font-bold text-[var(--c-text-primary)]">
                    전체 시리즈
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {regular.map((s) => (
                    <SeriesCard key={s.id} series={s} />
                  ))}
                </div>
              </section>
            )}

            {/* If no featured, show all in one grid */}
            {featured.length === 0 && regular.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {series.map((s) => (
                  <SeriesCard key={s.id} series={s} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Bottom CTA */}
        {series.length > 0 && (
          <div className="mt-12 bg-[#F0F7F0] border border-[#2D4A2E]/10 rounded-2xl p-6 text-center">
            <p className="text-[15px] font-bold text-[#2D4A2E] mb-1.5">
              모바일 앱에서 걷기 기록을 시작하세요
            </p>
            <p className="text-[13px] text-[#6B7F6C] leading-relaxed">
              코스를 걸으면 자동으로 완주가 인정되고, 시리즈 진행률이
              업데이트됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Series Card                                    */
/* ────────────────────────────────────────────── */

function SeriesCard({ series: s }: { series: Series }) {
  const hasProg = s.progress_pct > 0;

  return (
    <Link
      href={`/series/${s.slug}`}
      className="group bg-[var(--c-surface)] rounded-2xl p-5 md:p-6 border border-[var(--c-border-default)] hover:shadow-lg hover:border-[#2D4A2E]/20 transition-all duration-200">
      {/* Top row: emoji + title */}
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-[#F0F7F0] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <span className="text-[24px]">{s.accent_emoji || "🚶"}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-[17px] font-bold text-[var(--c-text-primary)] truncate group-hover:text-[#2D4A2E] transition-colors">
              {s.title}
            </h3>
            {s.is_featured && (
              <span className="inline-flex items-center bg-amber-400/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                추천
              </span>
            )}
          </div>
          {s.region && (
            <p className="text-[12px] text-[var(--c-text-tertiary)] mb-1">
              {s.region}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      {s.subtitle && (
        <p className="text-[13px] text-[var(--c-text-secondary)] mt-3 leading-relaxed line-clamp-2">
          {s.subtitle}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-4 text-[12px] font-medium text-[#6B7F6C]">
        <span className="inline-flex items-center gap-1">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
          {s.progress_total}개 코스
        </span>
        <span className="text-[var(--c-text-tertiary)]">·</span>
        <span>총 {formatDistance(s.total_distance_km)}</span>
        {s.total_minutes > 0 && (
          <>
            <span className="text-[var(--c-text-tertiary)]">·</span>
            <span>{formatDuration(s.total_minutes)}</span>
          </>
        )}
      </div>

      {/* Progress bar (shown if user has any progress) */}
      {hasProg && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-semibold text-[#2D4A2E]">
              {s.progress_completed}/{s.progress_total} 완주
            </span>
            <span className="text-[11px] font-bold text-[#2D4A2E]">
              {s.progress_pct}%
            </span>
          </div>
          <div className="h-1.5 bg-[#E8F0E8] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2D4A2E] to-[#4A7C4B] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(s.progress_pct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Completers badge */}
      {s.total_completers > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--c-text-tertiary)]">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          {s.total_completers}명 완주
        </div>
      )}
    </Link>
  );
}
