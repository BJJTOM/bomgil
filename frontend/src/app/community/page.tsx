"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useChatRooms } from "@/hooks/useCompanions";
import { useT } from "@/stores/language";
import type { WalkStory } from "@/types";

function NotificationBadge() {
  const { isAuthenticated } = useAuthStore();
  const { data } = useQuery({
    queryKey: ["notification-count"],
    queryFn: async () => {
      const { data } = await api.get("/stories/notifications/");
      return data.unread_count as number;
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  if (!data || data === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
      {data > 99 ? "99+" : data}
    </span>
  );
}

export default function CommunityPage() {
  const { isAuthenticated } = useAuthStore();
  const { data: chatRooms } = useChatRooms();
  const { t } = useT();
  const qc = useQueryClient();

  const { data: stories = [], isLoading } = useQuery<WalkStory[]>({
    queryKey: ["community-feed"],
    queryFn: async () => {
      const { data } = await api.get("/stories/");
      return data.results ?? data;
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (id: number) => (await api.post(`/stories/${id}/like/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });

  const unreadChats = Array.isArray(chatRooms) ? chatRooms.filter((r: any) => r.unread_count > 0).length : 0;

  return (
    <div className="md:pt-[60px] min-h-screen" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Sticky Header */}
      <header className="sticky top-0 md:top-[60px] z-30 bg-white/95 backdrop-blur-xl border-b border-[#F2F4F6]">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <h1 className="text-[22px] font-bold tracking-tight text-[#191F28]">{t("community.title")}</h1>
          <div className="flex items-center gap-2">
            <Link
              href={isAuthenticated ? "/community/write" : "/auth/login"}
              className="px-3 py-1.5 bg-[#2D4A2E] text-white rounded-[20px] text-[12px] font-semibold hover:bg-[#243d25] transition-colors"
            >
              {t("community.write")}
            </Link>
            <Link
              href="/notifications"
              className="relative p-2.5 rounded-[12px] hover:bg-[#F7F8FA] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <NotificationBadge />
            </Link>
            <Link
              href="/chat"
              className="relative p-2.5 rounded-[12px] hover:bg-[#F7F8FA] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              {unreadChats > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadChats}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-3">
          <div className="flex items-center gap-2 text-[#2D4A2E] text-[13px] font-medium animate-slide-up">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
            </svg>
            {t("community.loadingStories")}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Feed */}
        {isLoading ? (
          <div className="py-20 text-center text-[#B0B8C1]">
            <div className="flex gap-1.5 justify-center mb-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#2D4A2E]/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            {t("common.loading")}
          </div>
        ) : stories.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <div className="max-w-sm mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f0f7f0] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <p className="text-[17px] font-bold text-[#191F28] mb-1">{t("community.noStories")}</p>
              <p className="text-[14px] text-[#B0B8C1] mb-5 leading-relaxed whitespace-pre-line">
                {t("community.noStoriesDesc")}
              </p>
              <Link
                href="/trails"
                className="inline-flex items-center gap-2 bg-[#2D4A2E] text-white text-[14px] font-semibold px-5 py-2.5 rounded-[14px] hover:bg-[#243d25] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {t("community.browseTrails")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white">
            {stories.map((story, index) => (
              <div key={story.id}>
                <FeedPost
                  story={story}
                  onLike={() => likeMutation.mutate(story.id)}
                />
                {index < stories.length - 1 && (
                  <div className="h-px bg-[#F2F4F6]" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link
        href={isAuthenticated ? "/community/write" : "/auth/login"}
        className="fixed bottom-24 md:bottom-8 right-5 z-40 w-14 h-14 bg-[#2D4A2E] text-white rounded-full shadow-float flex items-center justify-center active:scale-90 transition-transform"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>
    </div>
  );
}

function FeedPost({ story, onLike }: { story: WalkStory; onLike: () => void }) {
  const { t, language } = useT();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const { isAuthenticated } = useAuthStore();

  const MOOD_MAP: Record<string, { emoji: string; labelKey: string; bg: string }> = {
    happy: { emoji: "😊", labelKey: "community.moodHappy", bg: "bg-yellow-50 text-yellow-700" },
    peaceful: { emoji: "☮️", labelKey: "community.moodPeaceful", bg: "bg-blue-50 text-blue-700" },
    exciting: { emoji: "🤩", labelKey: "community.moodExciting", bg: "bg-orange-50 text-orange-700" },
    touching: { emoji: "🥹", labelKey: "community.moodTouching", bg: "bg-pink-50 text-pink-700" },
    funny: { emoji: "😄", labelKey: "community.moodFunny", bg: "bg-green-50 text-green-700" },
  };

  const mood = MOOD_MAP[story.mood];
  const isLong = story.content.length > 150;

  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslation(!showTranslation);
      return;
    }
    try {
      const targetLang = language === "ko" ? "en" : language;
      const { data } = await api.post("/stories/translate/", {
        text: story.content,
        target: targetLang,
      });
      setTranslatedText(data.translated);
      setShowTranslation(true);
    } catch {
      setTranslatedText("Translation unavailable");
      setShowTranslation(true);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t("community.minutesAgo").replace("{n}", String(mins));
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("community.hoursAgo").replace("{n}", String(hours));
    const days = Math.floor(hours / 24);
    if (days < 7) return t("community.daysAgo").replace("{n}", String(days));
    return new Date(dateStr).toLocaleDateString(language);
  };

  const photos = story.photos || [];

  const PhotoGrid = () => {
    if (photos.length === 0) return null;
    if (photos.length === 1) {
      return (
        <div className="relative w-full aspect-[4/3]">
          <Image src={photos[0].image} alt={photos[0].caption || ""} fill className="object-cover" />
        </div>
      );
    }
    if (photos.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-0.5">
          {photos.slice(0, 2).map((p) => (
            <div key={p.id} className="relative aspect-square">
              <Image src={p.image} alt={p.caption || ""} fill className="object-cover" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-0.5">
        <div className="relative aspect-square row-span-2">
          <Image src={photos[0].image} alt={photos[0].caption || ""} fill className="object-cover" />
        </div>
        <div className="relative aspect-square">
          <Image src={photos[1].image} alt={photos[1].caption || ""} fill className="object-cover" />
        </div>
        <div className="relative aspect-square">
          {photos.length > 3 ? (
            <>
              <Image src={photos[2].image} alt={photos[2].caption || ""} fill className="object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white text-[18px] font-bold">+{photos.length - 3}</span>
              </div>
            </>
          ) : (
            <Image src={photos[2].image} alt={photos[2].caption || ""} fill className="object-cover" />
          )}
        </div>
      </div>
    );
  };

  return (
    <article className="pb-1">
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2.5">
        <Link href={`/profile/${story.author.nickname}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A8E6CF] to-[#2D4A2E] p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
              {story.author.profile_image ? (
                <Image src={story.author.profile_image} alt="" width={36} height={36} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">👤</span>
              )}
            </div>
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={`/profile/${story.author.nickname}`} className="text-[14px] font-bold text-[#191F28] hover:underline">
              {story.author.nickname}
            </Link>
            {(story.author as any).is_verified && (
              <span className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full bg-[#2D4A2E]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#B0B8C1]">
            {story.trail_id && (
              <Link href={`/trails/${story.trail_id}`} className="hover:text-[#2D4A2E] transition-colors">
                {story.trail_region} · {story.trail_title} ·{" "}
              </Link>
            )}
            {timeAgo(story.created_at)}
          </p>
        </div>
      </div>

      {/* Photo grid */}
      <PhotoGrid />

      {/* Action bar — icon only */}
      <div className="flex items-center gap-4 px-4 pt-3 pb-1">
        <button
          onClick={() => {
            if (!isAuthenticated) { router.push("/auth/login"); return; }
            onLike();
          }}
          className="active:scale-90 transition-transform"
        >
          {story.is_liked ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF4B4B" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          )}
        </button>
        <button
          onClick={() => router.push(`/community/${story.id}`)}
          className="active:scale-90 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>
        <button className="active:scale-90 transition-transform">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>
      </div>

      {/* Like count */}
      {story.like_count > 0 && (
        <p className="px-4 text-[13px] font-semibold text-[#191F28]">
          {t("community.likesCount").replace("{count}", String(story.like_count))}
        </p>
      )}

      {/* Content */}
      <div className="px-4 pt-1 pb-2">
        {mood && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[20px] text-[11px] font-medium mb-1.5 ${mood.bg}`}>
            {mood.emoji} {t(mood.labelKey)}
          </span>
        )}

        {story.title && (
          <h3 className="text-[14px] font-bold text-[#191F28] leading-snug mb-0.5">{story.title}</h3>
        )}

        <p className="text-[14px] leading-[1.65] text-[#191F28] whitespace-pre-line">
          {isLong && !expanded ? (
            <>
              {story.content.slice(0, 150)}
              <button onClick={() => setExpanded(true)} className="text-[#B0B8C1] font-medium">
                ... {t("community.showMore")}
              </button>
            </>
          ) : (
            story.content
          )}
        </p>

        {/* Translate */}
        <button
          onClick={handleTranslate}
          className="text-[12px] text-[#B0B8C1] hover:text-[#2D4A2E] font-medium transition-colors mt-1 flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
            <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
          </svg>
          {showTranslation ? t("community.showOriginal") : t("community.translate")}
        </button>
        {showTranslation && translatedText && (
          <div className="mt-1.5 p-2.5 bg-blue-50/50 rounded-[12px] text-[13px] text-[#8B95A1] leading-relaxed">
            <p className="text-[10px] text-blue-400 font-medium mb-0.5">🌐 {t("community.aiTranslation")}</p>
            {translatedText}
          </div>
        )}
      </div>

      {/* Comment count */}
      {story.comment_count > 0 && (
        <button
          onClick={() => router.push(`/community/${story.id}`)}
          className="px-4 pb-2 text-[13px] text-[#B0B8C1] hover:underline"
        >
          {t("community.commentsCount").replace("{count}", String(story.comment_count))}
        </button>
      )}
    </article>
  );
}
