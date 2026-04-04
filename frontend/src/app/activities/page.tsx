"use client";

import Link from "next/link";
import { useActivities, useActivityStats } from "@/hooks/useActivities";
import type { ActivityTrack } from "@/types";

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  manual_gpx: { label: "GPX", icon: "📁" },
  apple_watch: { label: "Apple Watch", icon: "⌚" },
  garmin: { label: "Garmin", icon: "⌚" },
  samsung_health: { label: "Samsung Health", icon: "📱" },
  google_fit: { label: "Google Fit", icon: "📱" },
  cashwalk: { label: "캐시워크", icon: "🚶" },
  phone_gps: { label: "스마트폰 GPS", icon: "📍" },
  strava: { label: "Strava", icon: "🏃" },
};

function formatDuration(minutes: number | null) {
  if (!minutes) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function formatPace(pace: string | null) {
  if (!pace) return "-";
  const p = parseFloat(pace);
  const min = Math.floor(p);
  const sec = Math.round((p - min) * 60);
  return `${min}'${sec.toString().padStart(2, "0")}"`;
}

export default function ActivitiesPage() {
  const { data: stats, isLoading: statsLoading } = useActivityStats();
  const { data: activities = [], isLoading } = useActivities();

  return (
    <div className="bg-warm min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1a3a1b] via-[#2D4A2E] to-[#1e442f] pt-14 md:pt-20 pb-8 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-white tracking-tight">활동 기록</h1>
              <p className="text-[13px] text-white/50 mt-0.5">나의 도보여행 데이터</p>
            </div>
            <Link
              href="/activities/upload"
              className="bg-white/15 backdrop-blur-sm text-white px-4 py-2.5 rounded-button text-[13px] font-medium hover:bg-white/25 transition-all"
            >
              + 기록 추가
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-card p-4">
              <p className="text-[11px] text-white/50 mb-1">총 거리</p>
              <p className="text-[24px] font-bold text-white font-en">
                {stats ? `${stats.total_distance_km.toFixed(1)}` : "-"}
                <span className="text-[13px] font-medium text-white/60 ml-1">km</span>
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-card p-4">
              <p className="text-[11px] text-white/50 mb-1">총 걸음수</p>
              <p className="text-[24px] font-bold text-white font-en">
                {stats ? stats.total_steps.toLocaleString() : "-"}
                <span className="text-[13px] font-medium text-white/60 ml-1">걸음</span>
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-card p-4">
              <p className="text-[11px] text-white/50 mb-1">총 시간</p>
              <p className="text-[24px] font-bold text-white font-en">
                {stats ? formatDuration(stats.total_duration_minutes) : "-"}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-card p-4">
              <p className="text-[11px] text-white/50 mb-1">기록 수</p>
              <p className="text-[24px] font-bold text-white font-en">
                {stats ? stats.track_count : "-"}
                <span className="text-[13px] font-medium text-white/60 ml-1">회</span>
              </p>
            </div>
          </div>

          {/* Weekly Chart - simple bar chart */}
          {stats && stats.weekly.length > 0 && (
            <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-card p-4">
              <p className="text-[12px] text-white/60 mb-3">이번 주 걸은 거리</p>
              <div className="flex items-end gap-1.5 h-[60px]">
                {stats.weekly.map((day) => {
                  const km = parseFloat(day.total_distance_km);
                  const maxKm = Math.max(...stats.weekly.map((d) => parseFloat(d.total_distance_km)), 1);
                  const height = Math.max((km / maxKm) * 100, 4);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-accent/70 rounded-sm transition-all"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[9px] text-white/40">
                        {new Date(day.date).toLocaleDateString("ko", { weekday: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="max-w-3xl mx-auto px-5 -mt-4">
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-bg-secondary rounded w-1/3 mb-3" />
                <div className="h-3 bg-bg-secondary rounded w-2/3" />
              </div>
            ))
          ) : activities.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-4xl mb-3">🥾</p>
              <p className="text-[15px] font-semibold mb-1">아직 기록이 없어요</p>
              <p className="text-[13px] text-text-tertiary mb-4">첫 번째 도보 기록을 추가해보세요</p>
              <Link href="/activities/upload" className="btn-primary inline-block">
                기록 추가하기
              </Link>
            </div>
          ) : (
            activities.map((activity: ActivityTrack) => (
              <Link key={activity.id} href={`/activities/${activity.id}`} className="card-hover p-5 block">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{SOURCE_LABELS[activity.source]?.icon || "📍"}</span>
                    <div>
                      <p className="text-[14px] font-semibold">
                        {activity.title || `${SOURCE_LABELS[activity.source]?.label} 기록`}
                      </p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">
                        {activity.started_at
                          ? new Date(activity.started_at).toLocaleDateString("ko", { month: "long", day: "numeric", weekday: "short" })
                          : new Date(activity.created_at).toLocaleDateString("ko", { month: "long", day: "numeric", weekday: "short" })}
                        {" · "}
                        {SOURCE_LABELS[activity.source]?.label}
                      </p>
                    </div>
                  </div>
                  <span className="chip text-[11px]">{activity.distance_km ? `${parseFloat(activity.distance_km).toFixed(1)}km` : "-"}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-3">
                  <div>
                    <p className="text-[10px] text-text-tertiary">거리</p>
                    <p className="text-[13px] font-semibold font-en">{activity.distance_km ? `${parseFloat(activity.distance_km).toFixed(1)}km` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-tertiary">시간</p>
                    <p className="text-[13px] font-semibold">{formatDuration(activity.duration_minutes)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-tertiary">걸음</p>
                    <p className="text-[13px] font-semibold font-en">{activity.total_steps?.toLocaleString() || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-tertiary">페이스</p>
                    <p className="text-[13px] font-semibold font-en">{formatPace(activity.avg_pace_min_km)}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
