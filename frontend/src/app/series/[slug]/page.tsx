/**
 * Trail series detail — server-rendered landing page for a single
 * series. Lists segments with links to each trail's detail page.
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

// Short revalidate window so freshly-seeded content appears quickly
export const revalidate = 120;

type Segment = {
  id: number;
  order: number;
  segment_label: string;
  trail: {
    id: number;
    title: string;
    region: string;
    distance_km: string;
    estimated_minutes: number;
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
  progress_total: number;
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
    const list: SeriesDetail[] = Array.isArray(data) ? data : (data?.results ?? []);
    return list.map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  return fetchAllSeriesSlugs();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const series = await fetchSeries(slug);
  if (!series) return { title: "Moru 시리즈" };

  const title = `${series.title} · 시리즈 · Moru`;
  const description =
    (series.description?.slice(0, 160)) ||
    series.subtitle ||
    `${series.title} — ${series.progress_total}개 구간의 걷기 챌린지`;

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

function formatDistance(km: string): string {
  const n = parseFloat(km);
  if (isNaN(n)) return "-";
  return n >= 1 ? `${n.toFixed(1)}km` : `${Math.round(n * 1000)}m`;
}

function formatDuration(minutes: number): string {
  if (!minutes) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const series = await fetchSeries(slug);
  if (!series) notFound();

  const segments = series.segments || [];

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1a3a1b] via-[#2D4A2E] to-[#1e442f] pt-20 md:pt-24 pb-14 px-5 text-white">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/series"
            className="text-[13px] text-white/70 hover:text-white inline-flex items-center gap-1 mb-5">
            ← 시리즈 목록
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[36px]">{series.accent_emoji || "🚶"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[30px] font-bold tracking-tight leading-tight mb-1">
                {series.title}
              </h1>
              {series.subtitle && (
                <p className="text-[15px] text-white/80 leading-relaxed">
                  {series.subtitle}
                </p>
              )}
              <p className="text-[12px] text-white/60 mt-3">
                {series.region || "전국"} · {series.progress_total}개 구간
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="max-w-4xl mx-auto px-5 pt-8">
        {series.description && (
          <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#E5E8EB] mb-6">
            <h2 className="text-[14px] font-bold text-[#191F28] mb-2">소개</h2>
            <p className="text-[13px] text-[#5F6B7A] leading-relaxed whitespace-pre-line">
              {series.description}
            </p>
          </div>
        )}

        {/* Segment list */}
        <div className="bg-white rounded-2xl border border-[#E5E8EB]">
          <div className="px-5 md:px-6 py-4 border-b border-[#F2F4F6]">
            <h2 className="text-[14px] font-bold text-[#191F28]">
              구간 {segments.length}개
            </h2>
          </div>
          {segments.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-gray-400">
              구간 정보를 불러오지 못했어요
            </div>
          ) : (
            segments.map((seg, idx) => {
              const img = seg.trail.cover_image || seg.trail.thumbnail_url;
              return (
                <Link
                  key={seg.id}
                  href={`/trails/${seg.trail.id}`}
                  className={`flex items-center gap-4 px-5 md:px-6 py-4 hover:bg-[#FAFAFA] transition-colors ${
                    idx < segments.length - 1 ? "border-b border-[#F2F4F6]" : ""
                  }`}>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#EEF1F4] flex items-center justify-center">
                    <span className="text-[13px] font-bold text-[#8B95A1]">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {seg.segment_label && (
                        <span className="inline-block bg-[#EEF1F4] text-[#8B95A1] text-[10px] font-bold px-2 py-0.5 rounded">
                          {seg.segment_label}
                        </span>
                      )}
                      <h3 className="text-[14px] font-semibold text-[#191F28] truncate">
                        {seg.trail.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-[#8B95A1]">
                      {seg.trail.region} · {formatDistance(seg.trail.distance_km)}{" "}
                      · {formatDuration(seg.trail.estimated_minutes)}
                    </p>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#B0B8C1"
                    strokeWidth="2.5"
                    className="flex-shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              );
            })
          )}
        </div>

        {/* App CTA */}
        <div className="mt-8 bg-[#F0F7F0] border border-[#2D4A2E]/20 rounded-2xl p-5 text-center">
          <p className="text-[14px] font-bold text-[#2D4A2E] mb-1">
            📱 모바일 앱에서 진행률을 기록하세요
          </p>
          <p className="text-[12px] text-[#6B7F6C]">
            코스를 걸으면 자동으로 완주 인정이 되고 시리즈 진행률이 업데이트됩니다
          </p>
        </div>
      </div>
    </div>
  );
}
