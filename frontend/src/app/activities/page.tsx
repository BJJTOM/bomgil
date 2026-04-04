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

  // Compute today's stats from weekly data or activities list
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

  return (
    <div className="bg-warm min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-50 to-warm pt-14 md:pt-20 px-5 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-text-primary">{t("activities.title")}</h1>
              <p className="text-[13px] text-text-tertiary mt-0.5">{t("activities.subtitle")}</p>
            </div>
            <Link href="/activities/upload" className="px-4 py-2 bg-primary/10 text-primary rounded-pill text-[13px] font-medium hover:bg-primary/15 transition-colors">
              + {t("activities.addRecord")}
            </Link>
          </div>

          {/* Big stat - total distance */}
          <div className="text-center mb-6">
            <p className="text-[11px] text-text-tertiary uppercase tracking-wider mb-2">{t("activities.totalDistance")}</p>
            <p className="text-[56px] font-bold text-primary font-en leading-none">{stats?.total_distance_km.toFixed(1) || "0.0"}</p>
            <p className="text-[14px] text-text-tertiary mt-1">km</p>
          </div>

          {/* Today's ring */}
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-4 border-[#2D4A2E] bg-white flex items-center justify-center mb-2 shadow-soft">
                <span className="text-[16px] font-bold text-text-primary font-en">{todayStats.steps.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">{t("activities.steps")}</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-4 border-[#A8E6CF] bg-white flex items-center justify-center mb-2 shadow-soft">
                <span className="text-[16px] font-bold text-text-primary font-en">{todayStats.distance.toFixed(1)}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">km</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-4 border-[#FF6B6B] bg-white flex items-center justify-center mb-2 shadow-soft">
                <span className="text-[16px] font-bold text-text-primary font-en">{todayStats.calories}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">kcal</p>
            </div>
          </div>

          {/* Start walking CTA */}
          <Link href="/walk" className="block w-full py-4 bg-primary text-white rounded-[16px] text-[15px] font-semibold text-center active:scale-[0.98] transition-transform shadow-soft">
            🚶 {t("activities.startWalk")}
          </Link>

          {/* Weekly Chart */}
          {stats && stats.weekly.length > 0 && (
            <div className="mt-5 bg-white rounded-[16px] p-4 shadow-soft">
              <p className="text-[12px] text-text-tertiary mb-3">{t("activities.weeklyDistance")}</p>
              <div className="flex items-end gap-1.5 h-[60px]">
                {stats.weekly.map((day) => {
                  const km = parseFloat(day.total_distance_km);
                  const maxKm = Math.max(...stats.weekly.map((d) => parseFloat(d.total_distance_km)), 1);
                  const height = Math.max((km / maxKm) * 100, 4);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-primary/30 rounded-sm transition-all"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[9px] text-text-tertiary">
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
      <div className="min-h-[200px] px-5 pt-4 pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[16px] font-bold mb-4">{recentActivityLabel[language] ?? recentActivityLabel.en}</h2>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[14px] p-5 animate-pulse">
                  <div className="h-4 bg-bg-secondary rounded w-1/3 mb-3" />
                  <div className="h-3 bg-bg-secondary rounded w-2/3" />
                </div>
              ))
            ) : activities.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[14px] text-text-tertiary">{t("activities.noRecords")}</p>
              </div>
            ) : (
              activities.map((activity: ActivityTrack) => (
                <Link key={activity.id} href={`/activities/${activity.id}`} className="block bg-white rounded-[14px] p-5 hover:shadow-soft transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{SOURCE_LABELS[activity.source]?.icon || "📍"}</span>
                      <div>
                        <p className="text-[14px] font-semibold">
                          {activity.title || `${SOURCE_LABELS[activity.source]?.label} ${t("activities.record")}`}
                        </p>
                        <p className="text-[11px] text-text-tertiary mt-0.5">
                          {activity.started_at
                            ? new Date(activity.started_at).toLocaleDateString(language, { month: "long", day: "numeric", weekday: "short" })
                            : new Date(activity.created_at).toLocaleDateString(language, { month: "long", day: "numeric", weekday: "short" })}
                          {" · "}
                          {SOURCE_LABELS[activity.source]?.label}
                        </p>
                      </div>
                    </div>
                    <span className="bg-[#111] text-white text-[11px] font-semibold px-2.5 py-1 rounded-pill">{activity.distance_km ? `${parseFloat(activity.distance_km).toFixed(1)}km` : "-"}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <div>
                      <p className="text-[10px] text-text-tertiary">{t("activities.distance")}</p>
                      <p className="text-[13px] font-semibold font-en">{activity.distance_km ? `${parseFloat(activity.distance_km).toFixed(1)}km` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary">{t("activities.time")}</p>
                      <p className="text-[13px] font-semibold">{formatDuration(activity.duration_minutes)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary">{t("activities.steps")}</p>
                      <p className="text-[13px] font-semibold font-en">{activity.total_steps?.toLocaleString() || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary">{t("activities.pace")}</p>
                      <p className="text-[13px] font-semibold font-en">{formatPace(activity.avg_pace_min_km)}</p>
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
