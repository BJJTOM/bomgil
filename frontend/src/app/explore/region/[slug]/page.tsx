/**
 * Region hub page — server-rendered, SEO-friendly landing page for
 * a single region. Example URLs:
 *
 *   /explore/region/seoul
 *   /explore/region/jeju
 *   /explore/region/busan
 *
 * Each slug maps to a list of region keywords used to filter the
 * trails API. Keeping the slug → keyword mapping static here means
 * we don't need server-side keyword negotiation on every request
 * and we can freeze canonical URLs for SEO.
 *
 * The page uses ISR (`revalidate`) so trail edits propagate without
 * a redeploy, but search engines still see fully rendered HTML.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.moruwalk.com/api/v1";

// Revalidate each region page at most every 30 minutes.
// Short revalidate window for freshly-seeded content
export const revalidate = 120;

// slug → { label, region filter keywords, lede, hero emoji }
// `keywords` is a list of Korean region strings we search the API with
// (the `region` field is a CharField, not a FK, so we do an OR of
// starts-with matches on the client side after fetching).
const REGIONS: Record<
  string,
  {
    label: string;
    label_en: string;
    keywords: string[];
    lede: string;
    emoji: string;
  }
> = {
  seoul: {
    label: "서울",
    label_en: "Seoul",
    keywords: ["서울"],
    lede: "한강, 남산, 청계천… 도심 속에서 만나는 걷기 좋은 코스",
    emoji: "🏙",
  },
  gyeonggi: {
    label: "경기",
    label_en: "Gyeonggi",
    keywords: ["경기"],
    lede: "수도권 근교의 호수, 숲, 역사길 산책 코스 모음",
    emoji: "🌳",
  },
  incheon: {
    label: "인천",
    label_en: "Incheon",
    keywords: ["인천"],
    lede: "섬과 항구, 차이나타운을 잇는 인천의 걷기 코스",
    emoji: "⚓",
  },
  gangwon: {
    label: "강원",
    label_en: "Gangwon",
    keywords: ["강원"],
    lede: "동해 해안과 산, 호수를 아우르는 강원도 걷기 코스",
    emoji: "⛰",
  },
  chungcheong: {
    label: "충청",
    label_en: "Chungcheong",
    keywords: ["대전", "충북", "충남", "세종"],
    lede: "내륙의 조용한 길과 황톳길, 옛 마을을 잇는 코스",
    emoji: "🍃",
  },
  gyeongsang: {
    label: "경상",
    label_en: "Gyeongsang",
    keywords: ["경북", "경남", "부산", "대구", "울산"],
    lede: "해안, 고궁, 벽화마을을 아우르는 영남의 걷기 코스",
    emoji: "🌊",
  },
  jeolla: {
    label: "전라",
    label_en: "Jeolla",
    keywords: ["전북", "전남", "광주"],
    lede: "메타세쿼이아길, 갯벌, 한옥마을이 있는 전라권 코스",
    emoji: "🌾",
  },
  jeju: {
    label: "제주",
    label_en: "Jeju",
    keywords: ["제주"],
    lede: "올레와 오름, 해안을 따라 이어지는 제주의 걷기 코스",
    emoji: "🏝",
  },
};

type Trail = {
  id: number;
  title: string;
  region: string;
  distance_km: string;
  estimated_minutes: number;
  difficulty: "easy" | "moderate" | "hard";
  cover_image: string | null;
  thumbnail_url: string | null;
  is_official?: boolean;
  trail_type?: string;
};

async function fetchRegionTrails(keywords: string[]): Promise<Trail[]> {
  try {
    // The API's region filter is exact match, so we do one fetch per
    // keyword and merge results client-side. For the small seed
    // catalog this is fine; we can move this to a server-side endpoint
    // once the catalog grows past a few hundred rows.
    const results: Trail[] = [];
    const seen = new Set<number>();
    for (const kw of keywords) {
      const url = new URL(`${API_BASE}/trails/`);
      url.searchParams.set("search", kw);
      url.searchParams.set("ordering", "-like_count");
      url.searchParams.set("page_size", "30");
      const res = await fetch(url.toString(), {
        next: { revalidate: 120 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const list: Trail[] = data?.results ?? data ?? [];
      for (const t of list) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          results.push(t);
        }
      }
    }
    // Prefer official trails at the top
    results.sort((a, b) => {
      const ao = a.is_official ? 1 : 0;
      const bo = b.is_official ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return 0;
    });
    return results;
  } catch {
    return [];
  }
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const region = REGIONS[slug];
  if (!region) return { title: "Moru" };
  const title = `${region.label}의 걷기 코스 모음 · Moru`;
  return {
    title,
    description: region.lede,
    openGraph: {
      title,
      description: region.lede,
      type: "website",
      locale: "ko_KR",
    },
    alternates: {
      canonical: `https://moruwalk.com/explore/region/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(REGIONS).map((slug) => ({ slug }));
}

function formatDistance(km: string | number): string {
  const n = typeof km === "string" ? parseFloat(km) : km;
  if (isNaN(n)) return "-";
  return n >= 1 ? `${n.toFixed(1)}km` : `${Math.round(n * 1000)}m`;
}

function formatDuration(minutes: number): string {
  if (!minutes) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default async function RegionHubPage({ params }: PageProps) {
  const { slug } = await params;
  const region = REGIONS[slug];
  if (!region) notFound();

  const trails = await fetchRegionTrails(region.keywords);

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1a3a1b] via-[#2D4A2E] to-[#1e442f] pt-20 md:pt-24 pb-12 px-5 text-white">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/explore"
            className="text-[13px] text-white/70 hover:text-white inline-flex items-center gap-1 mb-4">
            ← 전체 탐색
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[44px] leading-none">{region.emoji}</span>
            <h1 className="text-[32px] font-bold tracking-tight">
              {region.label}의 걷기 코스
            </h1>
          </div>
          <p className="text-[15px] text-white/80 leading-relaxed max-w-2xl">
            {region.lede}
          </p>
          <p className="text-[12px] text-white/60 mt-3">
            {trails.length}개 코스 · Moru 큐레이션
          </p>
        </div>
      </div>

      {/* Trails grid */}
      <div className="max-w-4xl mx-auto px-5 pt-8">
        {trails.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-3xl mb-3">🚶</div>
            <p className="text-[15px] font-semibold text-gray-900 mb-1">
              등록된 코스가 아직 없어요
            </p>
            <p className="text-[13px] text-gray-400">
              곧 {region.label} 코스를 추가할 예정이에요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {trails.map((trail) => {
              const img = trail.cover_image || trail.thumbnail_url;
              return (
                <Link
                  key={trail.id}
                  href={`/trails/${trail.id}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-[#E5E8EB] hover:shadow-lg transition-shadow">
                  <div className="relative aspect-[16/10] bg-[#F0F7F0]">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={trail.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {region.emoji}
                      </div>
                    )}
                    {trail.is_official && (
                      <span className="absolute top-3 left-3 bg-[#2D4A2E] text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                        ✓ 공식
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-[16px] font-bold text-[#191F28] mb-1 truncate">
                      {trail.title}
                    </h3>
                    <p className="text-[12px] text-[#8B95A1] mb-2 truncate">
                      {trail.region}
                    </p>
                    <div className="flex items-center gap-3 text-[12px] text-[#6B7F6C] font-medium">
                      <span>{formatDistance(trail.distance_km)}</span>
                      <span className="text-[#E5E8EB]">·</span>
                      <span>{formatDuration(trail.estimated_minutes)}</span>
                      <span className="text-[#E5E8EB]">·</span>
                      <span className="capitalize">{trail.difficulty}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Other regions */}
      <div className="max-w-4xl mx-auto px-5 mt-12">
        <h2 className="text-[15px] font-bold text-[#191F28] mb-3">다른 지역 보기</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(REGIONS)
            .filter(([s]) => s !== slug)
            .map(([s, r]) => (
              <Link
                key={s}
                href={`/explore/region/${s}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E5E8EB] rounded-full text-[13px] font-medium text-[#191F28] hover:border-[#2D4A2E] transition-colors">
                <span>{r.emoji}</span>
                <span>{r.label}</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
