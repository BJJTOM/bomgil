"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePopularTrails } from "@/hooks/useTrails";
import { TrailCard } from "@/components/TrailCard";
import { TrailCardSkeleton } from "@/components/ui/Skeleton";
import { useT, useLanguageStore, LANGUAGES } from "@/stores/language";
import api from "@/lib/api";
import { Footer } from "@/components/Footer";

const DISCOVER_COUNTRIES = [
  { code: "KR", name: "Korea", nameKo: "한국", nameEn: "Korea", nameJa: "韓国", nameZh: "韩国", emoji: "🇰🇷", desc: { ko: "서울, 제주, 부산...", en: "Seoul, Jeju, Busan...", ja: "ソウル, 済州, 釜山...", zh: "首尔, 济州, 釜山..." } },
  { code: "JP", name: "Japan", nameKo: "일본", nameEn: "Japan", nameJa: "日本", nameZh: "日本", emoji: "🇯🇵", desc: { ko: "도쿄, 교토, 오사카...", en: "Tokyo, Kyoto, Osaka...", ja: "東京, 京都, 大阪...", zh: "东京, 京都, 大阪..." } },
  { code: "TW", name: "Taiwan", nameKo: "대만", nameEn: "Taiwan", nameJa: "台湾", nameZh: "台湾", emoji: "🇹🇼", desc: { ko: "타이베이, 지우펀...", en: "Taipei, Jiufen...", ja: "台北, 九份...", zh: "台北, 九份..." } },
  { code: "TH", name: "Thailand", nameKo: "태국", nameEn: "Thailand", nameJa: "タイ", nameZh: "泰国", emoji: "🇹🇭", desc: { ko: "방콕, 치앙마이...", en: "Bangkok, Chiang Mai...", ja: "バンコク, チェンマイ...", zh: "曼谷, 清迈..." } },
  { code: "US", name: "USA", nameKo: "미국", nameEn: "USA", nameJa: "アメリカ", nameZh: "美国", emoji: "🇺🇸", desc: { ko: "NYC, LA, 포틀랜드...", en: "NYC, LA, Portland...", ja: "NYC, LA, ポートランド...", zh: "纽约, 洛杉矶, 波特兰..." } },
  { code: "GB", name: "UK", nameKo: "영국", nameEn: "UK", nameJa: "イギリス", nameZh: "英国", emoji: "🇬🇧", desc: { ko: "런던, 에든버러...", en: "London, Edinburgh...", ja: "ロンドン, エディンバラ...", zh: "伦敦, 爱丁堡..." } },
  { code: "FR", name: "France", nameKo: "프랑스", nameEn: "France", nameJa: "フランス", nameZh: "法国", emoji: "🇫🇷", desc: { ko: "파리, 프로방스...", en: "Paris, Provence...", ja: "パリ, プロヴァンス...", zh: "巴黎, 普罗旺斯..." } },
  { code: "ES", name: "Spain", nameKo: "스페인", nameEn: "Spain", nameJa: "スペイン", nameZh: "西班牙", emoji: "🇪🇸", desc: { ko: "바르셀로나, 산티아고...", en: "Barcelona, Santiago...", ja: "バルセロナ, サンティアゴ...", zh: "巴塞罗那, 圣地亚哥..." } },
];


function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setDisplay(value);
      return;
    }
    hasAnimated.current = true;
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value]);

  const formatted = display >= 1000 ? `${(display / 1000).toFixed(1)}K` : String(display);
  return <span>{formatted}{suffix}</span>;
}

export default function Home() {
  const { data: popularTrails, isLoading: trailsLoading } = usePopularTrails();
  const { t, language } = useT();
  const { setLanguage } = useLanguageStore();
  const [showLangMenu, setShowLangMenu] = useState(false);

  const { data: platformStats } = useQuery<{
    countries: number;
    trails: number;
    stories: number;
    users: number;
  }>({
    queryKey: ["platform-stats"],
    queryFn: async () => (await api.get("/stats/")).data,
    staleTime: 5 * 60 * 1000,
  });

  const heroSubTexts: Record<string, string> = {
    ko: "전 세계 도보여행 코스를 발견하고, 나만의 길을 공유하세요.\n당신의 발걸음이 누군가의 여행이 됩니다.",
    en: "Discover walking trails around the world and share your own paths.\nYour footsteps become someone else's journey.",
    ja: "世界中の散歩コースを発見し、自分だけの道を共有しましょう。\nあなたの足跡が誰かの旅になります。",
    zh: "发现世界各地的步行路线，分享你自己的旅程。\n你的足迹将成为他人的旅行。",
  };

  const communityBadgeTexts: Record<string, string> = {
    ko: "전 세계 도보여행자들의 커뮤니티",
    en: "A global community of walking travelers",
    ja: "世界中の散歩旅行者のコミュニティ",
    zh: "全球步行旅行者社区",
  };

  const discoverTexts: Record<string, { title: string; sub: string }> = {
    ko: { title: "어디를 걸어볼까요?", sub: "전 세계 도보여행 코스를 탐색하세요" },
    en: { title: "Where will you walk?", sub: "Explore walking trails around the world" },
    ja: { title: "どこを歩きますか？", sub: "世界中の散歩コースを探索しましょう" },
    zh: { title: "去哪里走走？", sub: "探索世界各地的步行路线" },
  };

  const popularSubTexts: Record<string, string> = {
    ko: "여행자들이 가장 사랑한 도보 코스",
    en: "Walking trails most loved by travelers",
    ja: "旅行者に最も愛された散歩コース",
    zh: "旅行者最喜爱的步行路线",
  };

  const emptyTrailsTexts: Record<string, { title: string; sub: string; cta: string }> = {
    ko: { title: "아직 인기 코스가 없어요", sub: "첫 번째 코스를 등록하고 여행자들과 공유해보세요", cta: "코스 등록하기" },
    en: { title: "No popular trails yet", sub: "Create the first trail and share it with travelers", cta: "Create a Trail" },
    ja: { title: "まだ人気コースがありません", sub: "最初のコースを登録して旅行者と共有しましょう", cta: "コースを登録" },
    zh: { title: "还没有热门路线", sub: "创建第一条路线并与旅行者分享", cta: "创建路线" },
  };

  const zeroStatTexts: Record<string, { countries: string; trails: string; stories: string; users: string }> = {
    ko: { countries: "베타 운영 중", trails: "첫 코스를 등록해주세요", stories: "첫 이야기를 남겨주세요", users: "함께해요" },
    en: { countries: "Beta", trails: "Be the first to create a trail", stories: "Share the first story", users: "Join us" },
    ja: { countries: "ベータ運営中", trails: "最初のコースを登録してください", stories: "最初の物語を残してください", users: "一緒に" },
    zh: { countries: "测试中", trails: "创建第一条路线", stories: "留下第一个故事", users: "一起来" },
  };

  const ctaBadgeTexts: Record<string, string> = {
    ko: "누구나 코스를 등록할 수 있어요",
    en: "Anyone can create a trail",
    ja: "誰でもコースを登録できます",
    zh: "任何人都可以创建路线",
  };

  const ctaTitleTexts: Record<string, string> = {
    ko: "나만 아는 그 길,\nMoru에 공유해주세요",
    en: "Share your hidden paths\non Moru",
    ja: "あなただけが知るその道を\nMoruで共有しましょう",
    zh: "把你知道的路线\n分享到Moru",
  };

  const ctaDescTexts: Record<string, string> = {
    ko: "동네 산책로, 여행지 골목길, 해외 숨은 명소까지.\n당신이 걸었던 길이 다른 여행자의 지도가 됩니다.",
    en: "Neighborhood walks, hidden alleys, secret spots abroad.\nYour path becomes another traveler's map.",
    ja: "近所の散歩道、旅先の路地、海外の隠れた名所まで。\nあなたが歩いた道が他の旅行者の地図になります。",
    zh: "社区散步道、旅途小巷、海外隐秘景点。\n你走过的路将成为其他旅行者的地图。",
  };

  const communityButtonTexts: Record<string, string> = {
    ko: "커뮤니티 둘러보기",
    en: "Browse Community",
    ja: "コミュニティを見る",
    zh: "浏览社区",
  };


  const statsTexts: Record<string, { countries: string; trails: string; stories: string; travelers: string }> = {
    ko: { countries: "등록 국가", trails: "코스", stories: "걸은 이야기", travelers: "여행자" },
    en: { countries: "Countries", trails: "Trails", stories: "Stories", travelers: "Travelers" },
    ja: { countries: "登録国", trails: "コース", stories: "物語", travelers: "旅行者" },
    zh: { countries: "国家", trails: "路线", stories: "故事", travelers: "旅行者" },
  };

  const featureSectionTitle: Record<string, string> = {
    ko: "핵심 기능 3가지",
    en: "3 Core Features",
    ja: "3つのコア機能",
    zh: "3大核心功能",
  };

  const featureCards: Record<string, { title: string; desc: string }[]> = {
    ko: [
      { title: "GPS 걷기 기록", desc: "걸으면서 자동으로 경로를 기록하고, 거리·시간·고도를 분석합니다" },
      { title: "AI 맞춤 추천", desc: "내 걷기 패턴을 분석해 나에게 딱 맞는 코스를 추천합니다" },
      { title: "동행 매칭", desc: "같은 코스를 걷고 싶은 동행자를 찾고, 함께 걸어보세요" },
    ],
    en: [
      { title: "GPS Walk Tracking", desc: "Automatically record your route while walking, with distance, time, and elevation analysis" },
      { title: "AI Recommendations", desc: "Get personalized trail suggestions based on your walking patterns" },
      { title: "Companion Matching", desc: "Find walking partners who want to explore the same trails" },
    ],
    ja: [
      { title: "GPS歩行記録", desc: "歩きながら自動でルートを記録し、距離・時間・高度を分析します" },
      { title: "AIおすすめ", desc: "歩行パターンを分析して、ぴったりのコースをおすすめします" },
      { title: "同行マッチング", desc: "同じコースを歩きたい仲間を見つけて、一緒に歩きましょう" },
    ],
    zh: [
      { title: "GPS步行记录", desc: "步行时自动记录路线，分析距离、时间和海拔" },
      { title: "AI个性推荐", desc: "分析你的步行模式，为你推荐最合适的路线" },
      { title: "同行匹配", desc: "找到想走同一路线的同伴，一起出发吧" },
    ],
  };

  const appDownloadTexts: Record<string, { title: string; sub: string }> = {
    ko: { title: "언제 어디서나 Moru와 함께", sub: "GPS 걷기 기록, AI 코스 추천, 동행 매칭까지" },
    en: { title: "Moru with you, everywhere", sub: "GPS walk tracking, AI trail recommendations, and companion matching" },
    ja: { title: "いつでもどこでもMoruと一緒に", sub: "GPS歩行記録、AIコースおすすめ、同行マッチングまで" },
    zh: { title: "随时随地，Moru与你同行", sub: "GPS步行记录、AI路线推荐、同行匹配" },
  };

  const countryUnit = language === "ko" ? "개국" : language === "ja" ? "ヶ国" : language === "zh" ? "国" : "";

  return (
    <div className="bg-warm" style={{ backgroundColor: "var(--c-warm)" }}>
      {/* Mobile top bar */}
      <div className="md:hidden absolute top-0 left-0 right-0 z-20 px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="Moru" className="w-7 h-7 rounded-lg" />
          <span className="text-white font-bold text-[17px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Moru</span>
        </div>
        <button onClick={() => setShowLangMenu(!showLangMenu)} className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
          <span className="text-[14px]">{LANGUAGES.find(l => l.code === language)?.flag}</span>
        </button>
        {showLangMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
            <div className="absolute top-full right-5 mt-1 bg-[#1a1a1a]/95 backdrop-blur-xl rounded-[16px] shadow-card border border-white/10 py-1 min-w-[140px] z-50">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLanguage(l.code); setShowLangMenu(false); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors ${
                    language === l.code ? "text-[#A8E6CF] font-semibold bg-white/10" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  {language === l.code && <span className="ml-auto text-[#A8E6CF]">&#10003;</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Hero -- photo background with dark overlay */}
      <section className="relative overflow-hidden">
        <div
          className="relative min-h-[500px] md:min-h-[600px] flex items-center justify-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1551632811-561732d1e306?w=1920&q=80')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
            backgroundSize: "40px 40px, 60px 60px",
          }} />
          <div className="relative max-w-5xl mx-auto px-5 text-center z-10 py-20 md:py-28">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-pill px-4 py-2 mb-5">
              <span className="flex gap-0.5 text-[13px]">🇰🇷🇯🇵🇺🇸🇬🇧🇫🇷</span>
              <span className="text-white/70 text-[13px] font-medium">{communityBadgeTexts[language] ?? communityBadgeTexts.en}</span>
            </div>
            <h1 className="text-[36px] md:text-[48px] font-bold text-white mb-3 tracking-tight leading-[1.2] drop-shadow-lg">
              {t("home.hero")}
            </h1>
            <p className="text-[15px] md:text-[17px] text-white/70 mb-8 max-w-xl mx-auto leading-relaxed whitespace-pre-line drop-shadow-md">
              {heroSubTexts[language] ?? heroSubTexts.en}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/explore" className="bg-white text-primary px-7 py-3.5 rounded-button text-[15px] font-semibold hover:shadow-float transition-all active:scale-[0.98]">
                {t("home.exploreButton")}
              </Link>
              <Link href="/trails/new" className="bg-white/15 backdrop-blur-sm text-white px-7 py-3.5 rounded-button text-[15px] font-medium hover:bg-white/25 transition-all active:scale-[0.98] border border-white/20">
                {t("home.ctaButton")}
              </Link>
            </div>
          </div>
        </div>

        {/* Stats bar -- bigger and bolder */}
        <div className="max-w-4xl mx-auto -mt-10 px-5 relative z-10">
          <div className="card shadow-card rounded-2xl grid grid-cols-4 divide-x divide-border-light">
            {[
              {
                key: "countries" as const,
                value: platformStats?.countries,
                label: statsTexts[language]?.countries ?? statsTexts.en.countries,
                suffix: countryUnit,
              },
              {
                key: "trails" as const,
                value: platformStats?.trails,
                label: statsTexts[language]?.trails ?? statsTexts.en.trails,
                suffix: "",
              },
              {
                key: "stories" as const,
                value: platformStats?.stories,
                label: statsTexts[language]?.stories ?? statsTexts.en.stories,
                suffix: "",
              },
              {
                key: "users" as const,
                value: platformStats?.users,
                label: statsTexts[language]?.travelers ?? statsTexts.en.travelers,
                suffix: "",
              },
            ].map((stat) => (
              <div key={stat.label} className="py-5 md:py-7 text-center">
                <div className="text-[22px] md:text-[28px] font-bold font-en text-primary">
                  {stat.value == null ? (
                    <span className="inline-block w-12 h-6 animate-pulse bg-border-light rounded" />
                  ) : stat.value === 0 ? (
                    <span className="text-[12px] md:text-[13px] font-medium text-text-tertiary">
                      {zeroStatTexts[language]?.[stat.key] ?? zeroStatTexts.en[stat.key]}
                    </span>
                  ) : (
                    <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                  )}
                </div>
                <p className="text-[11px] md:text-[13px] text-text-tertiary mt-1 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features -- 3 cards */}
      <section className="max-w-5xl mx-auto px-5 pt-14 md:pt-20 pb-10 md:pb-14">
        <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-center mb-3">
          {featureSectionTitle[language] ?? featureSectionTitle.en}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
          {/* Card 1: GPS Walk Tracking */}
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-7 text-center shadow-sm hover:shadow-card transition-shadow duration-200">
            <div className="w-14 h-14 rounded-full bg-[#E8F5E9] dark:bg-[#2D4A2E]/30 flex items-center justify-center mx-auto mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold mb-2 text-text-primary">
              {(featureCards[language] ?? featureCards.en)[0].title}
            </h3>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              {(featureCards[language] ?? featureCards.en)[0].desc}
            </p>
          </div>

          {/* Card 2: AI Recommendations */}
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-7 text-center shadow-sm hover:shadow-card transition-shadow duration-200">
            <div className="w-14 h-14 rounded-full bg-[#FFF3E0] dark:bg-[#5C3D00]/30 flex items-center justify-center mx-auto mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold mb-2 text-text-primary">
              {(featureCards[language] ?? featureCards.en)[1].title}
            </h3>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              {(featureCards[language] ?? featureCards.en)[1].desc}
            </p>
          </div>

          {/* Card 3: Companion Matching */}
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-7 text-center shadow-sm hover:shadow-card transition-shadow duration-200">
            <div className="w-14 h-14 rounded-full bg-[#E3F2FD] dark:bg-[#0D47A1]/30 flex items-center justify-center mx-auto mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold mb-2 text-text-primary">
              {(featureCards[language] ?? featureCards.en)[2].title}
            </h3>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              {(featureCards[language] ?? featureCards.en)[2].desc}
            </p>
          </div>
        </div>
      </section>

      {/* Discover by Country */}
      <section className="max-w-7xl mx-auto px-5 pt-10 md:pt-16 pb-8 bg-[#FAFAFA]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">{discoverTexts[language]?.title ?? discoverTexts.en.title}</h2>
            <p className="text-[13px] text-text-tertiary mt-0.5">{discoverTexts[language]?.sub ?? discoverTexts.en.sub}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DISCOVER_COUNTRIES.map((country) => {
            const name = language === "ko" ? country.nameKo : language === "ja" ? country.nameJa : language === "zh" ? country.nameZh : country.nameEn;
            const desc = (country.desc as any)[language] ?? country.desc.en;
            return (
              <Link
                key={country.code}
                href={`/explore?country=${country.code}`}
                className="card-hover p-4 flex items-center gap-3.5 group hover:translate-y-[-2px] hover:shadow-card transition-all duration-200"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform duration-200">{country.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold group-hover:text-primary transition-colors">{name}</p>
                  <p className="text-[11px] text-text-tertiary truncate">{desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>


      {/* Popular Trails */}
      <section className="bg-surface py-8 md:py-14">
        <div className="max-w-7xl mx-auto px-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[20px] font-bold tracking-tight">{t("home.popularTrails")}</h2>
              <p className="text-[13px] text-text-tertiary mt-0.5">{popularSubTexts[language] ?? popularSubTexts.en}</p>
            </div>
            <Link href="/explore?ordering=-like_count" className="text-[13px] text-primary font-medium">{t("home.viewAll")}</Link>
          </div>
          {trailsLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="min-w-[280px]"><TrailCardSkeleton /></div>
              ))}
            </div>
          ) : popularTrails && popularTrails.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {popularTrails.slice(0, 6).map((trail: any) => (
                <div key={trail.id} className="min-w-[280px]">
                  <TrailCard trail={trail} variant="compact" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-20 h-20 rounded-full bg-[#F0F7F0] flex items-center justify-center mb-4">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 4v16" />
                  <path d="M17 4v16" />
                  <path d="M19 4H14.5a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7H13" />
                  <path d="M5 20l4-16" />
                  <path d="M3 20h6" />
                </svg>
              </div>
              <h3 className="text-[17px] font-semibold text-text-primary mb-2">
                {emptyTrailsTexts[language]?.title ?? emptyTrailsTexts.en.title}
              </h3>
              <p className="text-[14px] text-text-tertiary mb-6 text-center max-w-sm">
                {emptyTrailsTexts[language]?.sub ?? emptyTrailsTexts.en.sub}
              </p>
              <Link
                href="/trails/new"
                className="btn-primary px-6 py-3 text-[14px] font-medium"
              >
                {emptyTrailsTexts[language]?.cta ?? emptyTrailsTexts.en.cta}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* UGC CTA */}
      <section className="bg-surface py-10 md:py-20">
        <div className="max-w-5xl mx-auto px-5">
          <div className="bg-gradient-to-br from-primary-50 to-accent-light/30 rounded-card p-10 md:p-16">
            <div className="text-center">
              <div className="inline-flex items-center gap-2.5 bg-white rounded-pill px-5 py-2.5 shadow-soft mb-7">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                <span className="text-[15px] font-semibold text-primary">{ctaBadgeTexts[language] ?? ctaBadgeTexts.en}</span>
              </div>
              <h2 className="text-[28px] md:text-[36px] font-bold tracking-tight mb-4 whitespace-pre-line leading-snug">{ctaTitleTexts[language] ?? ctaTitleTexts.en}</h2>
              <p className="text-[16px] md:text-[18px] text-text-secondary leading-relaxed mb-10 max-w-lg mx-auto whitespace-pre-line">
                {ctaDescTexts[language] ?? ctaDescTexts.en}
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link href="/trails/new" className="btn-primary px-8 py-4 text-[16px] font-semibold">{t("home.ctaButton")}</Link>
                <Link href="/community" className="btn-secondary px-8 py-4 text-[16px] font-semibold">{communityButtonTexts[language] ?? communityButtonTexts.en}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* App Download CTA */}
      <section className="py-14 md:py-20 bg-gradient-to-b from-[#F5F5F5] to-[#FAFAFA] dark:from-[#1a1a1a] dark:to-[#111]">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <img src="/icon-192.png" alt="Moru" className="w-10 h-10 rounded-xl" />
          </div>
          <h2 className="text-[24px] md:text-[30px] font-bold tracking-tight mb-3">
            {appDownloadTexts[language]?.title ?? appDownloadTexts.en.title}
          </h2>
          <p className="text-[15px] md:text-[17px] text-text-secondary mb-8 max-w-md mx-auto">
            {appDownloadTexts[language]?.sub ?? appDownloadTexts.en.sub}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-black text-white px-6 py-3.5 rounded-xl hover:bg-black/80 transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="text-left">
                <div className="text-[10px] leading-none opacity-70">Download on the</div>
                <div className="text-[15px] font-semibold leading-tight">App Store</div>
              </div>
            </a>
            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-black text-white px-6 py-3.5 rounded-xl hover:bg-black/80 transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 010 1.38l-2.302 2.302L15.395 13l2.302-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
              </svg>
              <div className="text-left">
                <div className="text-[10px] leading-none opacity-70">GET IT ON</div>
                <div className="text-[15px] font-semibold leading-tight">Google Play</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
