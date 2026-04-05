"use client";

import Link from "next/link";
import { useActivities, useActivityStats } from "@/hooks/useActivities";
import { useT } from "@/stores/language";
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
  const { data: stats, isLoading: statsLoading } = useActivityStats();
  const { data: activities = [], isLoading } = useActivities();

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

  const today = new Date().toISOString().split("T")[0];
  const todayWeekly = stats?.weekly?.find((d) => d.date === today);
  const todayFromActivities = (activities as ActivityTrack[]).filter(
    (a) => a.started_at && a.started_at.startsWith(today)
  );
  const todayStats = todayWeekly
    ? {
        steps: todayWeekly.total_steps,
        distance: parseFloat(todayWeekly.total_distance_km),
        calories: todayWeekly.total_calories,
      }
    : {
        steps: todayFromActivities.reduce((s, a) => s + (a.total_steps || 0), 0),
        distance: todayFromActivities.reduce((s, a) => s + parseFloat(a.distance_km || "0"), 0),
        calories: todayFromActivities.reduce((s, a) => s + (a.calories_burned || 0), 0),
      };

  const recentActivityLabel: Record<string, string> = {
    ko: "최근 활동",
    en: "Recent Activity",
    ja: "最近のアクティビティ",
    zh: "最近活动",
  };

  const todayLabel: Record<string, string> = {
    ko: "오늘",
    en: "Today",
    ja: "今日",
    zh: "今天",
  };

  const todayDateStr = new Date().toLocaleDateString(language, { month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Header */}
      <div className="bg-white pt-14 md:pt-20 px-5 pb-5 border-b border-[#F2F4F6]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[22px] font-bold text-[#191F28]">{t("activities.title")}</h1>
              <p className="text-[13px] text-[#B0B8C1] mt-0.5">{todayDateStr}</p>
            </div>
            <Link href="/activities/upload" className="px-3.5 py-1.5 bg-[#F7F8FA] text-[#2D4A2E] rounded-[20px] text-[13px] font-medium hover:bg-[#E5E8EB] transition-colors">
              + {t("activities.addRecord")}
            </Link>
          </div>

          {/* Today's main stat — distance */}
          <div className="text-center mb-5">
            <p className="text-[12px] text-[#B0B8C1] mb-1">{todayLabel[language] ?? todayLabel.en}</p>
            <p className="text-[48px] font-bold text-[#2D4A2E] font-en leading-none">{todayStats.distance.toFixed(1)}</p>
            <p className="text-[14px] text-[#B0B8C1] mt-0.5">km</p>
          </div>

          {/* Today's ring stats */}
          <div className="flex justify-center gap-8 mb-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full border-[3px] border-[#2D4A2E] flex items-center justify-center mb-1">
                <span className="text-[14px] font-bold text-[#191F28] font-en">{todayStats.steps.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-[#B0B8C1]">{t("activities.steps")}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full border-[3px] border-[#A8E6CF] flex items-center justify-center mb-1">
                <span className="text-[14px] font-bold text-[#191F28] font-en">{todayStats.distance.toFixed(1)}</span>
              </div>
              <p className="text-[10px] text-[#B0B8C1]">km</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full border-[3px] border-[#FF6B6B] flex items-center justify-center mb-1">
                <span className="text-[14px] font-bold text-[#191F28] font-en">{todayStats.calories}</span>
              </div>
              <p className="text-[10px] text-[#B0B8C1]">kcal</p>
            </div>
          </div>

          {/* Start walking */}
          <Link href="/walk" className="block w-full py-3.5 bg-[#2D4A2E] text-white rounded-[14px] text-[15px] font-semibold text-center active:scale-[0.98] transition-transform">
            🚶 {t("activities.startWalk")}
          </Link>

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
              <div className="py-12 text-center">
                <p className="text-[14px] text-[#B0B8C1]">{t("activities.noRecords")}</p>
              </div>
            ) : (
              activities.map((activity: ActivityTrack) => (
                <Link key={activity.id} href={`/activities/${activity.id}`} className="block bg-white rounded-[16px] border border-[#E5E8EB] p-4 hover:shadow-card transition-shadow">
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
