"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useActivities, useActivityStats } from "@/hooks/useActivities";
import { useQueryClient } from "@tanstack/react-query";
import { useT } from "@/stores/language";
import { useAuthStore } from "@/stores/auth";
import api from "@/lib/api";
import type { ActivityTrack } from "@/types";

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  manual_gpx: { label: "GPX", icon: "📁" },
  apple_watch: { label: "Apple Watch", icon: "⌚" },
  garmin: { label: "Garmin", icon: "⌚" },
  samsung_health: { label: "Samsung Health", icon: "📱" },
  google_fit: { label: "Google Fit", icon: "📱" },
  cashwalk: { label: "Cashwalk", icon: "🚶" },
  phone_gps: { label: "GPS", icon: "📍" },
  strava: { label: "Strava", icon: "🏃" },
};

export default function ActivitiesPage() {
  const { t, language } = useT();
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useActivityStats();
  const { data: activities = [], isLoading } = useActivities();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  // Clean up legacy paused-walk localStorage key (web walk feature removed).
  // Recording is now mobile-only; this key is leftover state from older builds.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem("moru_paused_walk");
    } catch {}
  }, []);

  const hour = new Date().getHours();
  const greeting = language === "ko"
    ? hour < 12 ? "좋은 아침이에요!" : hour < 18 ? "좋은 오후에요!" : "좋은 저녁이에요!"
    : hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";

  const handleDelete = async (id: number) => {
    if (!confirm(language === "ko" ? "이 활동 기록을 삭제하시겠어요?" : "Delete this activity?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/activities/${id}/`);
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activity-stats"] });
    } catch {}
    setDeletingId(null);
  };

  function formatDuration(minutes: number | null) {
    if (!minutes) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (language === "ko") return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
    if (language === "ja") return h > 0 ? `${h}時間${m}分` : `${m}分`;
    if (language === "zh") return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function formatPace(pace: string | null) {
    if (!pace) return "-";
    const p = parseFloat(pace);
    const min = Math.floor(p);
    const sec = Math.round((p - min) * 60);
    return `${min}'${sec.toString().padStart(2, "0")}"`;
  }

  const recentActivityLabel: Record<string, string> = {
    ko: "최근 활동",
    en: "Recent Activity",
    ja: "最近のアクティビティ",
    zh: "最近活动",
  };

  const todayDateStr = new Date().toLocaleDateString(language, { month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "var(--c-warm)" }}>
      {/* Header */}
      <div className="bg-white pt-6 md:pt-20 px-5 pb-5 border-b border-[#F2F4F6]">
        <div className="max-w-3xl mx-auto">
          <div className="mb-3">
            <button
              onClick={() => window.history.back()}
              className="w-9 h-9 rounded-full bg-[#F7F8FA] flex items-center justify-center hover:bg-[#E5E8EB] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
          </div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[13px] text-[#8B95A1] mb-0.5">{greeting}</p>
              <h1 className="text-[22px] font-bold text-[#191F28]">{t("activities.title")}</h1>
              <p className="text-[12px] text-[#B0B8C1] mt-0.5">{todayDateStr}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/activities/stats" className="px-3.5 py-1.5 bg-[#F7F8FA] text-[#8B95A1] rounded-[20px] text-[13px] font-medium hover:bg-[#E5E8EB] transition-colors">
                통계
              </Link>
              <Link href="/activities/upload" className="px-3.5 py-1.5 bg-[#F7F8FA] text-[#2D4A2E] rounded-[20px] text-[13px] font-medium hover:bg-[#E5E8EB] transition-colors">
                + {t("activities.addRecord")}
              </Link>
            </div>
          </div>

          {/* Mobile app banner — recording is mobile-only */}
          <div className="w-full py-3.5 px-4 bg-[#F0F7F0] border border-[#2D4A2E]/20 rounded-[14px] flex items-center gap-3">
            <span className="text-[22px]">📱</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#2D4A2E]">
                {language === "ko" ? "걷기 기록은 모바일 앱에서" : language === "ja" ? "ウォーキング記録はモバイルアプリで" : language === "zh" ? "使用移动应用记录步行" : "Record walks in the mobile app"}
              </p>
              <p className="text-[11px] text-[#6B7F6C] mt-0.5">
                {language === "ko" ? "GPS 기록, 음성 안내, 오프라인 지원" : language === "ja" ? "GPS記録、音声案内、オフライン対応" : language === "zh" ? "GPS记录、语音引导、离线支持" : "GPS tracking, voice guidance, offline"}
              </p>
            </div>
          </div>

          {/* Weekly Chart */}
          {stats && stats.weekly.length > 0 && (
            <div className="mt-4 bg-[#F7F8FA] rounded-[16px] p-4">
              <p className="text-[12px] text-[#B0B8C1] mb-3">{t("activities.weeklyDistance")}</p>
              <div className="flex items-end gap-1.5 h-[50px]">
                {stats.weekly.map((day) => {
                  const km = parseFloat(day.total_distance_km);
                  const maxKm = Math.max(...stats.weekly.map((d) => parseFloat(d.total_distance_km)), 1);
                  const height = Math.max((km / maxKm) * 100, 4);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-[#2D4A2E]/25 rounded-sm transition-all"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[9px] text-[#B0B8C1]">
                        {new Date(day.date).toLocaleDateString(language, { weekday: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Total Stats */}
      {stats && (
        <div className="px-5 pt-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-[16px] border border-[#E5E8EB] p-5">
              <h2 className="text-[15px] font-bold text-[#191F28] mb-3">{t("activities.totalStats")}</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-[20px] font-bold text-[#2D4A2E] font-en">{stats.total_distance_km.toFixed(1)}</p>
                  <p className="text-[11px] text-[#B0B8C1]">km</p>
                </div>
                <div className="text-center">
                  <p className="text-[20px] font-bold text-[#2D4A2E] font-en">{stats.total_steps.toLocaleString()}</p>
                  <p className="text-[11px] text-[#B0B8C1]">{t("activities.steps")}</p>
                </div>
                <div className="text-center">
                  <p className="text-[20px] font-bold text-[#2D4A2E] font-en">{stats.total_calories.toLocaleString()}</p>
                  <p className="text-[11px] text-[#B0B8C1]">kcal</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity list */}
      <div className="px-5 pt-4 pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[17px] font-bold text-[#191F28] mb-3">{recentActivityLabel[language] ?? recentActivityLabel.en}</h2>
          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[16px] border border-[#E5E8EB] p-4 animate-pulse">
                  <div className="h-4 bg-[#F7F8FA] rounded w-1/3 mb-3" />
                  <div className="h-3 bg-[#F7F8FA] rounded w-2/3" />
                </div>
              ))
            ) : activities.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 text-2xl">📱</div>
                <p className="text-[15px] font-semibold text-gray-900 mb-1">
                  {language === "ko" ? "아직 기록이 없어요" : language === "ja" ? "まだ記録がありません" : language === "zh" ? "还没有记录" : "No records yet"}
                </p>
                <p className="text-[13px] text-gray-400">
                  {language === "ko" ? "모바일 앱에서 걷기를 기록해보세요" : language === "ja" ? "モバイルアプリでウォーキングを記録しましょう" : language === "zh" ? "在移动应用中记录步行" : "Record walks in the mobile app"}
                </p>
              </div>
            ) : (
              activities.slice(0, visibleCount).map((activity: ActivityTrack) => (
                <div key={activity.id} className="bg-white rounded-[16px] border border-[#E5E8EB] p-4 hover:shadow-card transition-shadow">
                  <Link href={`/activities/${activity.id}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{SOURCE_LABELS[activity.source]?.icon || "📍"}</span>
                        <div>
                          <p className="text-[14px] font-semibold text-[#191F28]">
                            {activity.title || `${SOURCE_LABELS[activity.source]?.label} ${t("activities.record")}`}
                          </p>
                          <p className="text-[11px] text-[#B0B8C1] mt-0.5">
                            {activity.started_at
                              ? new Date(activity.started_at).toLocaleDateString(language, { month: "long", day: "numeric", weekday: "short" })
                              : new Date(activity.created_at).toLocaleDateString(language, { month: "long", day: "numeric", weekday: "short" })}
                            {" · "}
                            {SOURCE_LABELS[activity.source]?.label}
                          </p>
                        </div>
                      </div>
                      <span className="text-[12px] font-semibold text-[#2D4A2E] bg-[#f0f7f0] px-2.5 py-1 rounded-[20px]">{activity.distance_km ? `${parseFloat(activity.distance_km).toFixed(1)}km` : "-"}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-2.5">
                      <div>
                        <p className="text-[10px] text-[#B0B8C1]">{t("activities.distance")}</p>
                        <p className="text-[13px] font-semibold text-[#191F28] font-en">{activity.distance_km ? `${parseFloat(activity.distance_km).toFixed(1)}km` : "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#B0B8C1]">{t("activities.time")}</p>
                        <p className="text-[13px] font-semibold text-[#191F28]">{formatDuration(activity.duration_minutes)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#B0B8C1]">{t("activities.steps")}</p>
                        <p className="text-[13px] font-semibold text-[#191F28] font-en">{activity.total_steps?.toLocaleString() || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#B0B8C1]">{t("activities.pace")}</p>
                        <p className="text-[13px] font-semibold text-[#191F28] font-en">{formatPace(activity.avg_pace_min_km)}</p>
                      </div>
                    </div>
                  </Link>
                  {/* Delete button */}
                  <div className="flex justify-end mt-2 pt-2 border-t border-[#F2F4F6]">
                    <button
                      onClick={() => handleDelete(activity.id)}
                      disabled={deletingId === activity.id}
                      className="text-[12px] text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
                    >
                      {deletingId === activity.id ? "..." : (language === "ko" ? "삭제" : "Delete")}
                    </button>
                  </div>
                </div>
              ))
            )}
            {/* Load more button */}
            {!isLoading && activities.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + 10)}
                className="w-full mt-3 py-3 bg-white border border-[#E5E8EB] rounded-[14px] text-[13px] font-semibold text-[#2D4A2E] hover:bg-[#F0F7F0] transition-colors"
              >
                {language === "ko" ? `더보기 (${activities.length - visibleCount}개)` : `Load more (${activities.length - visibleCount})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
