/**
 * Trail series detail -- server-rendered landing page for a single
 * series. Shows a hero with aggregate stats, ordered trail list with
 * per-trail completion status, and a progress summary.
 *
 * ISR (`revalidate`) + static param generation means Google sees
 * fully rendered HTML for every series slug without a rebuild
 * trigger every time an admin tweaks the description.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.moruwalk.com/api/v1";

export const revalidate = 120;

type Segment = {
  id: number;
  order: number;
  segment_label: string;
  is_completed?: boolean;
  trail: {
    id: number;
    title: string;
    region: string;
    distance_km: string;
    estimated_minutes: number;
    difficulty: string;
    cover_image: string | null;
    thumbnail_url: string | null;
  };
};

type SeriesDetail = {
  id: number;
  slug: string;
  title: string;
  title_en?: string;
  subtitle?: string;
  description?: string;
  region?: string;
  accent_emoji?: string;
  is_featured?: boolean;
  progress_completed: number;
  progress_total: number;
  progress_pct: number;
  total_distance_km: number;
  total_minutes: number;
  total_completers: number;
  segments?: Segment[];
};

type PageProps = { params: Promise<{ slug: string }> };

async function fetchSeries(slug: string): Promise<SeriesDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/trails/series/${slug}/`, {
      next: { revalidate: 120, tags: [`trail-series-${slug}`] },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchAllSeriesSlugs(): Promise<{ slug: string }[]> {
  try {
    const res = await fetch(`${API_BASE}/trails/series/`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list: SeriesDetail[] = Array.isArray(data)
      ? data
      : (data?.results ?? []);
    return list.map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  return fetchAllSeriesSlugs();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const series = await fetchSeries(slug);
  if (!series) return { title: "Moru 시리즈" };

  const title = `${series.title} · 시리즈 · Moru`;
  const description =
    series.description?.slice(0, 160) ||
    series.subtitle ||
    `${series.title} -- ${series.progress_total}개 구간의 걷기 챌린지`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      locale: "ko_KR",
    },
    alternates: {
      canonical: `https://moruwalk.com/series/${slug}`,
    },
  };
}

function formatDistance(km: string | number): string {
  const n = typeof km === "string" ? parseFloat(km) : km;
  if (isNaN(n) || n === 0) return "-";
  return n >= 1 ? `${n.toFixed(1)}km` : `${Math.round(n * 1000)}m`;
}

function formatDuration(minutes: number): string {
  if (!minutes) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

function difficultyLabel(d: string): { text: string; color: string } {
  switch (d) {
    case "easy":
      return { text: "여유", color: "text-emerald-600" };
    case "hard":
      return { text: "도전", color: "text-red-500" };
    default:
      return { text: "보통", color: "text-amber-600" };
  }
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const series = await fetchSeries(slug);
  if (!series) notFound();

  const segments = series.segments || [];
  const completedCount = segments.filter((s) => s.is_completed).length;
  const hasProg = series.progress_pct > 0 || completedCount > 0;

  return (
    <div
      className="min-h-screen pb-24"
      style={{ backgroundColor: "var(--c-warm)" }}>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0f2b10] via-[#1a3a1b] to-[#1e442f] pt-20 md:pt-28 pb-16 md:pb-20 px-5 text-white">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/[0.03]" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/[0.03]" />

        <div className="max-w-4xl mx-auto relative">
          <Link
            href="/series"
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
            시리즈 목록
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <span className="text-[36px] md:text-[40px]">
                {series.accent_emoji || "🚶"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight leading-tight">
                  {series.title}
                </h1>
                {series.is_featured && (
                  <span className="inline-flex items-center bg-amber-400/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0">
                    추천
                  </span>
                )}
              </div>
              {series.subtitle && (
                <p className="text-[15px] text-white/75 leading-relaxed mt-1">
                  {series.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8">
            <div className="flex items-center gap-1.5">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-white/50">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-[13px] text-white/70">
                {series.region || "전국"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-white/50">
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span className="text-[13px] text-white/70">
                {series.progress_total}개 코스
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-white/50">
                <path d="M18 8h1a4 4 0 010 8h-1" />
                <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
              <span className="text-[13px] text-white/70">
                총 {formatDistance(series.total_distance_km)}
              </span>
            </div>
            {series.total_minutes > 0 && (
              <div className="flex items-center gap-1.5">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-white/50">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-[13px] text-white/70">
                  {formatDuration(series.total_minutes)}
                </span>
              </div>
            )}
            {series.total_completers > 0 && (
              <div className="flex items-center gap-1.5">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-white/50">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span className="text-[13px] text-white/70">
                  {series.total_completers}명 완주
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-5 pt-8">
        {/* Progress card (only when user has progress) */}
        {hasProg && (
          <div className="bg-[var(--c-surface)] rounded-2xl p-5 md:p-6 border border-[var(--c-border-default)] mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-[var(--c-text-primary)]">
                나의 진행률
              </h2>
              <span className="text-[20px] font-bold text-[#2D4A2E]">
                {series.progress_pct}%
              </span>
            </div>
            <div className="h-2 bg-[#E8F0E8] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-[#2D4A2E] to-[#4A7C4B] rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(series.progress_pct, 100)}%`,
                }}
              />
            </div>
            <p className="text-[12px] text-[var(--c-text-secondary)]">
              {series.progress_total}개 구간 중{" "}
              <span className="font-semibold text-[#2D4A2E]">
                {series.progress_completed}개
              </span>{" "}
              완주
            </p>
          </div>
        )}

        {/* Description */}
        {series.description && (
          <div className="bg-[var(--c-surface)] rounded-2xl p-5 md:p-6 border border-[var(--c-border-default)] mb-5">
            <h2 className="text-[14px] font-bold text-[var(--c-text-primary)] mb-2.5">
              소개
            </h2>
            <p className="text-[13px] text-[var(--c-text-secondary)] leading-[1.75] whitespace-pre-line">
              {series.description}
            </p>
          </div>
        )}

        {/* ── Trail list ── */}
        <div className="bg-[var(--c-surface)] rounded-2xl border border-[var(--c-border-default)] overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-[var(--c-border-light)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-[var(--c-text-primary)]">
                코스 목록
              </h2>
              <span className="text-[12px] text-[var(--c-text-tertiary)]">
                {segments.length}개 구간
              </span>
            </div>
          </div>

          {segments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[13px] text-[var(--c-text-tertiary)]">
                구간 정보를 불러오지 못했어요
              </p>
            </div>
          ) : (
            <div>
              {segments.map((seg, idx) => {
                const diff = difficultyLabel(seg.trail.difficulty);
                return (
                  <Link
                    key={seg.id}
                    href={`/trails/${seg.trail.id}`}
                    className={`flex items-center gap-3.5 px-5 md:px-6 py-4 hover:bg-[var(--c-bg-secondary)] transition-colors ${
                      idx < segments.length - 1
                        ? "border-b border-[var(--c-border-light)]"
                        : ""
                    }`}>
                    {/* Number badge with completion indicator */}
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                        seg.is_completed
                          ? "bg-[#2D4A2E] text-white"
                          : "bg-[#EEF1F4]"
                      }`}>
                      {seg.is_completed ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="text-[13px] font-bold text-[var(--c-text-secondary)]">
                          {idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Trail info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {seg.segment_label && (
                          <span className="inline-block bg-[#EEF1F4] text-[var(--c-text-secondary)] text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0">
                            {seg.segment_label}
                          </span>
                        )}
                        <h3 className="text-[14px] font-semibold text-[var(--c-text-primary)] truncate">
                          {seg.trail.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--c-text-secondary)]">
                        <span>
                          {formatDistance(seg.trail.distance_km)}
                        </span>
                        <span className="text-[var(--c-text-tertiary)]">
                          ·
                        </span>
                        <span>
                          {formatDuration(seg.trail.estimated_minutes)}
                        </span>
                        {seg.trail.difficulty && (
                          <>
                            <span className="text-[var(--c-text-tertiary)]">
                              ·
                            </span>
                            <span className={diff.color}>{diff.text}</span>
                          </>
                        )}
                        {seg.trail.region && (
                          <>
                            <span className="text-[var(--c-text-tertiary)]">
                              ·
                            </span>
                            <span>{seg.trail.region}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--c-text-tertiary)"
                      strokeWidth="2.5"
                      className="flex-shrink-0">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* App CTA */}
        <div className="mt-8 bg-[#F0F7F0] border border-[#2D4A2E]/10 rounded-2xl p-6 text-center">
          <p className="text-[15px] font-bold text-[#2D4A2E] mb-1.5">
            모바일 앱에서 진행률을 기록하세요
          </p>
          <p className="text-[12px] text-[#6B7F6C] leading-relaxed">
            코스를 걸으면 자동으로 완주 인정이 되고 시리즈 진행률이
            업데이트됩니다
          </p>
        </div>
      </div>
    </div>
  );
}
