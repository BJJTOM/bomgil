"use client";

import { useState } from "react";
import Link from "next/link";
import { usePopularTrails } from "@/hooks/useTrails";
import { TrailCard } from "@/components/TrailCard";
import { TrailCardSkeleton } from "@/components/ui/Skeleton";
import { useT, useLanguageStore, LANGUAGES } from "@/stores/language";

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
  const { t, language } = useT();
  const { setLanguage } = useLanguageStore();
  const [showLangMenu, setShowLangMenu] = useState(false);

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

  const storyTexts: Record<string, { title: string; sub: string }> = {
    ko: { title: "걸은 이야기", sub: "전 세계 도보여행자들의 생생한 후기" },
    en: { title: "Walking Stories", sub: "Real stories from walking travelers around the world" },
    ja: { title: "歩いた物語", sub: "世界中の散歩旅行者のリアルな体験談" },
    zh: { title: "行走故事", sub: "来自世界各地步行旅行者的真实故事" },
  };

  const noStoryTexts: Record<string, { title: string; sub: string }> = {
    ko: { title: "아직 이야기가 없어요", sub: "도보여행 후 첫 번째 이야기를 남겨보세요" },
    en: { title: "No stories yet", sub: "Share your first walking story" },
    ja: { title: "まだ物語がありません", sub: "散歩の後、最初の物語を残してください" },
    zh: { title: "还没有故事", sub: "分享你的第一个行走故事" },
  };

  const ctaBadgeTexts: Record<string, string> = {
    ko: "누구나 코스를 등록할 수 있어요",
    en: "Anyone can create a trail",
    ja: "誰でもコースを登録できます",
    zh: "任何人都可以创建路线",
  };

  const ctaTitleTexts: Record<string, string> = {
    ko: "나만 아는 그 길,\nRoami에 공유해주세요",
    en: "Share your hidden paths\non Roami",
    ja: "あなただけが知るその道を\nRoamiで共有しましょう",
    zh: "把你知道的路线\n分享到Roami",
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

  const koreaRegionTexts: Record<string, string> = {
    ko: "한국 지역별",
    en: "Korea Regions",
    ja: "韓国地域別",
    zh: "韩国地区",
  };

  const statsTexts: Record<string, { countries: string; trails: string; stories: string; travelers: string }> = {
    ko: { countries: "등록 국가", trails: "코스", stories: "걸은 이야기", travelers: "여행자" },
    en: { countries: "Countries", trails: "Trails", stories: "Stories", travelers: "Travelers" },
    ja: { countries: "登録国", trails: "コース", stories: "物語", travelers: "旅行者" },
    zh: { countries: "国家", trails: "路线", stories: "故事", travelers: "旅行者" },
  };

  const footerTexts: Record<string, { main: string; sub: string }> = {
    ko: {
      main: "Roami는 전 세계 도보여행자들을 위한 코스 공유 & 동행 매칭 플랫폼입니다",
      sub: "Roami — A walking travel platform for discovering trails, sharing routes, and finding companions.",
    },
    en: {
      main: "Roami is a trail-sharing & companion-matching platform for walking travelers worldwide",
      sub: "Discover trails, share routes, and find walking companions.",
    },
    ja: {
      main: "Roamiは世界中の散歩旅行者のためのコース共有＆同行マッチングプラットフォームです",
      sub: "コースを発見し、ルートを共有し、散歩仲間を見つけましょう。",
    },
    zh: {
      main: "Roami是面向全球步行旅行者的路线分享和同行匹配平台",
      sub: "发现路线，分享行程，寻找步行伙伴。",
    },
  };

  const countryStatsLabel = language === "ko" ? "8개국" : language === "ja" ? "8ヶ国" : language === "zh" ? "8国" : "8";

  return (
    <div className="bg-warm" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Mobile top bar */}
      <div className="md:hidden absolute top-0 left-0 right-0 z-20 px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="Roami" className="w-7 h-7 rounded-lg" />
          <span className="text-white font-bold text-[17px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Roami</span>
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
                  {language === l.code && <span className="ml-auto text-[#A8E6CF]">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

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
              <span className="text-white/70 text-[13px] font-medium">{communityBadgeTexts[language] ?? communityBadgeTexts.en}</span>
            </div>
            <h1 className="text-[36px] md:text-[48px] font-bold text-white mb-3 tracking-tight leading-[1.2]">
              {t("home.hero")}
            </h1>
            <p className="text-[15px] md:text-[17px] text-white/50 mb-8 max-w-xl mx-auto leading-relaxed whitespace-pre-line">
              {heroSubTexts[language] ?? heroSubTexts.en}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/explore" className="bg-white text-primary px-7 py-3.5 rounded-button text-[15px] font-semibold hover:shadow-float transition-all active:scale-[0.98]">
                {t("home.exploreButton")}
              </Link>
              <Link href="/trails/new" className="bg-white/15 backdrop-blur-sm text-white px-7 py-3.5 rounded-button text-[15px] font-medium hover:bg-white/25 transition-all active:scale-[0.98]">
                {t("home.ctaButton")}
              </Link>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-4xl mx-auto -mt-8 px-5 relative z-10">
          <div className="card shadow-card grid grid-cols-4 divide-x divide-border-light">
            {[
              { value: countryStatsLabel, label: statsTexts[language]?.countries ?? statsTexts.en.countries },
              { value: "120+", label: statsTexts[language]?.trails ?? statsTexts.en.trails },
              { value: "850+", label: statsTexts[language]?.stories ?? statsTexts.en.stories },
              { value: "2.4K", label: statsTexts[language]?.travelers ?? statsTexts.en.travelers },
            ].map((stat) => (
              <div key={stat.label} className="py-4 text-center">
                <div className="text-[18px] md:text-[22px] font-bold font-en text-primary">{stat.value}</div>
                <p className="text-[11px] md:text-[12px] text-text-tertiary mt-0.5">{stat.label}</p>
              </div>
            ))}
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

      {/* Korea Regions */}
      <section className="max-w-7xl mx-auto px-5 pb-10 bg-[#FAFAFA]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🇰🇷</span>
          <h3 className="text-[16px] font-bold">{koreaRegionTexts[language] ?? koreaRegionTexts.en}</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {KR_REGIONS.map((r) => (
            <Link
              key={r.name}
              href={`/explore?region=${r.name}`}
              className="chip hover:bg-primary hover:text-white hover:scale-105 hover:shadow-soft transition-all duration-200 flex-shrink-0"
            >
              {r.emoji} {r.name}
            </Link>
          ))}
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

      {/* UGC CTA */}
      <section className="bg-surface py-8 md:py-14">
        <div className="max-w-3xl mx-auto px-5">
          <div className="bg-gradient-to-br from-primary-50 to-accent-light/30 rounded-card p-8 md:p-10">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white rounded-pill px-4 py-2 shadow-soft mb-5">
                <span className="text-lg">🗺️</span>
                <span className="text-[13px] font-semibold text-primary">{ctaBadgeTexts[language] ?? ctaBadgeTexts.en}</span>
              </div>
              <h2 className="text-[22px] font-bold tracking-tight mb-2 whitespace-pre-line">{ctaTitleTexts[language] ?? ctaTitleTexts.en}</h2>
              <p className="text-[14px] text-text-secondary leading-relaxed mb-7 max-w-md mx-auto whitespace-pre-line">
                {ctaDescTexts[language] ?? ctaDescTexts.en}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/trails/new" className="btn-primary">{t("home.ctaButton")}</Link>
                <Link href="/community" className="btn-secondary">{communityButtonTexts[language] ?? communityButtonTexts.en}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Global footer info */}
      <section className="py-10 border-t border-border-light bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-5 text-center">
          <p className="text-[13px] text-text-tertiary">
            {footerTexts[language]?.main ?? footerTexts.en.main}
          </p>
          <p className="text-[12px] text-text-tertiary/60 mt-1">
            {footerTexts[language]?.sub ?? footerTexts.en.sub}
          </p>
        </div>
      </section>
    </div>
  );
}
