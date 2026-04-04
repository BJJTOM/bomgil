"use client";

import Link from "next/link";
import Image from "next/image";
import { usePopularTrails } from "@/hooks/useTrails";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { TrailCard } from "@/components/TrailCard";
import { TrailCardSkeleton } from "@/components/ui/Skeleton";
import type { WalkStory } from "@/types";

const DISCOVER_COUNTRIES = [
  { code: "KR", name: "Korea", nameKo: "한국", emoji: "🇰🇷", desc: "서울, 제주, 부산..." },
  { code: "JP", name: "Japan", nameKo: "일본", emoji: "🇯🇵", desc: "도쿄, 교토, 오사카..." },
  { code: "TW", name: "Taiwan", nameKo: "대만", emoji: "🇹🇼", desc: "타이베이, 지우펀..." },
  { code: "TH", name: "Thailand", nameKo: "태국", emoji: "🇹🇭", desc: "방콕, 치앙마이..." },
  { code: "US", name: "USA", nameKo: "미국", emoji: "🇺🇸", desc: "NYC, LA, 포틀랜드..." },
  { code: "GB", name: "UK", nameKo: "영국", emoji: "🇬🇧", desc: "런던, 에든버러..." },
  { code: "FR", name: "France", nameKo: "프랑스", emoji: "🇫🇷", desc: "파리, 프로방스..." },
  { code: "ES", name: "Spain", nameKo: "스페인", emoji: "🇪🇸", desc: "바르셀로나, 산티아고..." },
];

const KR_REGIONS = [
  { name: "서울", emoji: "🏙️" },
  { name: "부산", emoji: "🌊" },
  { name: "제주", emoji: "🍊" },
  { name: "전주", emoji: "🏛️" },
  { name: "강릉", emoji: "☕" },
  { name: "경주", emoji: "🏛️" },
];

export default function Home() {
  const { data: popularTrails, isLoading: trailsLoading } = usePopularTrails();
  const { data: stories = [] } = useQuery<WalkStory[]>({
    queryKey: ["stories-home"],
    queryFn: async () => {
      const { data } = await api.get("/stories/");
      return (data.results ?? data).slice(0, 4);
    },
  });

  return (
    <div className="bg-warm" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Hero — compact, global */}
      <section className="relative overflow-hidden">
        <div className="bg-gradient-to-br from-[#1a3a1b] via-[#2D4A2E] to-[#1e442f] pt-20 md:pt-28 pb-20 md:pb-28">
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
            backgroundSize: "40px 40px, 60px 60px",
          }} />
          <div className="relative max-w-5xl mx-auto px-5 text-center z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-pill px-4 py-2 mb-5">
              <span className="flex gap-0.5 text-[13px]">🇰🇷🇯🇵🇺🇸🇬🇧🇫🇷</span>
              <span className="text-white/70 text-[13px] font-medium">전 세계 도보여행자들의 커뮤니티</span>
            </div>
            <h1 className="text-[36px] md:text-[48px] font-bold text-white mb-3 tracking-tight leading-[1.2]">
              걸으면 보이는 것들
            </h1>
            <p className="text-[15px] md:text-[17px] text-white/50 mb-8 max-w-xl mx-auto leading-relaxed">
              전 세계 도보여행 코스를 발견하고, 나만의 길을 공유하세요.<br className="hidden md:block" />
              당신의 발걸음이 누군가의 여행이 됩니다.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/explore" className="bg-white text-primary px-7 py-3.5 rounded-button text-[15px] font-semibold hover:shadow-float transition-all active:scale-[0.98]">
                코스 둘러보기
              </Link>
              <Link href="/trails/new" className="bg-white/15 backdrop-blur-sm text-white px-7 py-3.5 rounded-button text-[15px] font-medium hover:bg-white/25 transition-all active:scale-[0.98]">
                내 코스 공유하기
              </Link>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-4xl mx-auto -mt-8 px-5 relative z-10">
          <div className="card shadow-card grid grid-cols-4 divide-x divide-border-light">
            {[
              { value: "8개국", label: "등록 국가" },
              { value: "120+", label: "코스" },
              { value: "850+", label: "걸은 이야기" },
              { value: "2.4K", label: "여행자" },
            ].map((stat) => (
              <div key={stat.label} className="py-4 text-center">
                <div className="text-[18px] md:text-[22px] font-bold font-en text-primary">{stat.value}</div>
                <p className="text-[11px] md:text-[12px] text-text-tertiary mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discover by Country — 글로벌 핵심 */}
      <section className="max-w-7xl mx-auto px-5 pt-16 pb-10 bg-[#FAFAFA]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">어디를 걸어볼까요?</h2>
            <p className="text-[13px] text-text-tertiary mt-0.5">전 세계 도보여행 코스를 탐색하세요</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DISCOVER_COUNTRIES.map((country) => (
            <Link
              key={country.code}
              href={`/explore?country=${country.code}`}
              className="card-hover p-4 flex items-center gap-3.5 group"
            >
              <span className="text-3xl">{country.emoji}</span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold group-hover:text-primary transition-colors">{country.nameKo}</p>
                <p className="text-[11px] text-text-tertiary truncate">{country.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Korea Regions — 한국 상세 */}
      <section className="max-w-7xl mx-auto px-5 pb-10 bg-[#FAFAFA]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🇰🇷</span>
          <h3 className="text-[16px] font-bold">한국 지역별</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {KR_REGIONS.map((r) => (
            <Link
              key={r.name}
              href={`/explore?region=${r.name}`}
              className="chip hover:bg-primary hover:text-white transition-colors flex-shrink-0"
            >
              {r.emoji} {r.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Popular Trails */}
      <section className="bg-surface py-14">
        <div className="max-w-7xl mx-auto px-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[20px] font-bold tracking-tight">인기 코스</h2>
              <p className="text-[13px] text-text-tertiary mt-0.5">여행자들이 가장 사랑한 도보 코스</p>
            </div>
            <Link href="/explore?ordering=-like_count" className="text-[13px] text-primary font-medium">전체 보기</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {trailsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="min-w-[280px]"><TrailCardSkeleton /></div>
                ))
              : popularTrails?.slice(0, 6).map((trail: any) => (
                  <div key={trail.id} className="min-w-[280px]">
                    <TrailCard trail={trail} variant="compact" />
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* Community Stories */}
      <section className="max-w-7xl mx-auto px-5 py-14 bg-[#FAFAFA]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">걸은 이야기</h2>
            <p className="text-[13px] text-text-tertiary mt-0.5">전 세계 도보여행자들의 생생한 후기</p>
          </div>
          <Link href="/community" className="text-[13px] text-primary font-medium">전체 보기</Link>
        </div>
        {stories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stories.map((story: WalkStory) => (
              <Link key={story.id} href="/community" className="card-hover p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-primary-200 p-[2px]">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-sm">👤</div>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">{story.author.nickname}</p>
                    <p className="text-[11px] text-text-tertiary">{story.trail_region ?? ""}{story.trail_region && story.trail_title ? " · " : ""}{story.trail_title ?? ""}</p>
                  </div>
                </div>
                {story.title && <p className="font-semibold text-[15px] leading-snug mb-1">{story.title}</p>}
                <p className="text-[13px] text-text-secondary line-clamp-2 leading-relaxed">{story.content}</p>
                <div className="flex items-center gap-3 mt-3 text-[12px] text-text-tertiary">
                  <span>❤️ {story.like_count}</span>
                  <span>💬 {story.comment_count || 0}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-[15px] font-medium">아직 이야기가 없어요</p>
            <p className="text-[13px] text-text-tertiary mt-1">도보여행 후 첫 번째 이야기를 남겨보세요</p>
          </div>
        )}
      </section>

      {/* UGC CTA — 거지맵 스타일 */}
      <section className="bg-surface py-14">
        <div className="max-w-3xl mx-auto px-5">
          <div className="bg-gradient-to-br from-primary-50 to-accent-light/30 rounded-card p-8 md:p-10">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white rounded-pill px-4 py-2 shadow-soft mb-5">
                <span className="text-lg">🗺️</span>
                <span className="text-[13px] font-semibold text-primary">누구나 코스를 등록할 수 있어요</span>
              </div>
              <h2 className="text-[22px] font-bold tracking-tight mb-2">나만 아는 그 길,<br />봄길에 공유해주세요</h2>
              <p className="text-[14px] text-text-secondary leading-relaxed mb-7 max-w-md mx-auto">
                동네 산책로, 여행지 골목길, 해외 숨은 명소까지.<br />
                당신이 걸었던 길이 다른 여행자의 지도가 됩니다.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/trails/new" className="btn-primary">코스 등록하기</Link>
                <Link href="/community" className="btn-secondary">커뮤니티 둘러보기</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating action button */}
      <Link
        href="/trails/new"
        className="md:hidden fixed bottom-24 right-5 z-40 w-14 h-14 bg-primary text-white rounded-full shadow-float flex items-center justify-center text-2xl font-light active:scale-90 transition-transform"
      >
        +
      </Link>

      {/* Global footer info */}
      <section className="py-10 border-t border-border-light bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-5 text-center">
          <p className="text-[13px] text-text-tertiary">
            🌏 봄길은 전 세계 도보여행자들이 함께 만들어가는 오픈 플랫폼입니다
          </p>
          <p className="text-[12px] text-text-tertiary/60 mt-1">
            Bomgil — A global community of walking travelers
          </p>
        </div>
      </section>
    </div>
  );
}
