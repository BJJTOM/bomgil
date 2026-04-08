"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useActivity } from "@/hooks/useActivities";
import { useQueryClient } from "@tanstack/react-query";
import { MapView } from "@/components/MapView";
import api from "@/lib/api";
import type { TrackPoint } from "@/types";

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  manual_gpx: { label: "GPX 파일", icon: "📁" },
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

export default function ActivityDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: activity, isLoading } = useActivity(id as string);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  const handleSaveTitle = async () => {
    if (!editTitle.trim() || !id) return;
    try {
      await api.patch(`/activities/${id}/`, { title: editTitle.trim() });
      qc.invalidateQueries({ queryKey: ["activity", id] });
      setEditingTitle(false);
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-warm pt-14 flex items-center justify-center">
        <div className="animate-pulse text-text-tertiary">로딩 중...</div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-warm pt-14 flex items-center justify-center">
        <p className="text-text-tertiary">기록을 찾을 수 없어요</p>
      </div>
    );
  }

  const trackPoints: TrackPoint[] = activity.track_points || [];
  const pathCoordinates: [number, number][] = trackPoints.map((p) => [p.lng, p.lat]);
  const center = trackPoints.length > 0
    ? { lat: trackPoints[Math.floor(trackPoints.length / 2)].lat, lng: trackPoints[Math.floor(trackPoints.length / 2)].lng }
    : undefined;

  // Elevation data for chart
  const elevationData = trackPoints
    .filter((p) => p.ele !== null)
    .map((p, i) => ({ index: i, ele: p.ele! }));
  const maxEle = elevationData.length > 0 ? Math.max(...elevationData.map((d) => d.ele)) : 0;
  const minEle = elevationData.length > 0 ? Math.min(...elevationData.map((d) => d.ele)) : 0;
  const eleRange = maxEle - minEle || 1;

  return (
    <div className="min-h-screen bg-warm pb-24">
      {/* Map */}
      <div className="relative">
        <div className="h-[300px] md:h-[400px]">
          {pathCoordinates.length > 0 ? (
            <MapView
              center={center}
              pathCoordinates={pathCoordinates}
              zoom={13}
              theme="light"
              showStats
              distance={activity.distance_km || undefined}
              duration={activity.duration_minutes ? String(activity.duration_minutes) : undefined}
              className="w-full h-full"
              markers={[
                { id: 1, lat: trackPoints[0].lat, lng: trackPoints[0].lng, title: "출발", emoji: "🟢" },
                { id: 2, lat: trackPoints[trackPoints.length - 1].lat, lng: trackPoints[trackPoints.length - 1].lng, title: "도착", emoji: "🔴" },
              ]}
            />
          ) : (
            <div className="w-full h-full bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[40px] mb-2 opacity-30">🗺️</div>
                <p className="text-gray-400 text-[14px]">경로 데이터 없음</p>
                <p className="text-gray-300 text-[11px] mt-1">GPS로 걷기 기록을 시작하면 경로가 표시됩니다</p>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => router.back()}
          className="absolute top-14 left-4 md:top-20 bg-black/50 backdrop-blur-md w-9 h-9 rounded-full flex items-center justify-center border border-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-5 -mt-6 relative z-10">
        {/* Title Card */}
        <div className="card shadow-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{SOURCE_LABELS[activity.source]?.icon || "📍"}</span>
            <div className="flex-1">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    className="text-[18px] font-bold bg-bg-secondary rounded-lg px-2 py-1 outline-none flex-1"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    autoFocus
                  />
                  <button onClick={handleSaveTitle} className="text-[13px] text-primary font-semibold">저장</button>
                  <button onClick={() => setEditingTitle(false)} className="text-[13px] text-text-tertiary">취소</button>
                </div>
              ) : (
                <h1 className="text-[18px] font-bold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => { setEditTitle(activity.title || ""); setEditingTitle(true); }}>
                  {activity.title || `${SOURCE_LABELS[activity.source]?.label} 기록`}
                  <span className="text-[11px] text-text-tertiary ml-1.5">✎</span>
                </h1>
              )}
              <p className="text-[12px] text-text-tertiary">
                {activity.started_at
                  ? new Date(activity.started_at).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric", weekday: "short" })
                  : new Date(activity.created_at).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                {activity.started_at && (
                  <> · {new Date(activity.started_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                  {activity.finished_at && ` ~ ${new Date(activity.finished_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}`}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="chip text-[11px]">{SOURCE_LABELS[activity.source]?.label}</span>
            {activity.trail && <span className="chip text-[11px]">코스 연결됨</span>}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="card shadow-card p-5 mb-4">
          <h2 className="text-[15px] font-bold mb-4">활동 요약</h2>
          <div className="grid grid-cols-3 gap-y-5 gap-x-3">
            <div className="text-center">
              <p className="text-[11px] text-text-tertiary mb-1">거리</p>
              <p className="text-[20px] font-bold font-en text-primary">{activity.distance_km ? `${parseFloat(activity.distance_km).toFixed(1)}` : "-"}</p>
              <p className="text-[10px] text-text-tertiary">km</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-text-tertiary mb-1">시간</p>
              <p className="text-[20px] font-bold font-en text-primary">{formatDuration(activity.duration_minutes)}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-text-tertiary mb-1">페이스</p>
              <p className="text-[20px] font-bold font-en text-primary">{formatPace(activity.avg_pace_min_km)}</p>
              <p className="text-[10px] text-text-tertiary">/km</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-text-tertiary mb-1">걸음수</p>
              <p className="text-[20px] font-bold font-en">{activity.total_steps?.toLocaleString() || "-"}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-text-tertiary mb-1">칼로리</p>
              <p className="text-[20px] font-bold font-en">{activity.calories_burned?.toLocaleString() || "-"}</p>
              <p className="text-[10px] text-text-tertiary">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-text-tertiary mb-1">속도</p>
              <p className="text-[20px] font-bold font-en">{activity.avg_speed_kmh ? parseFloat(activity.avg_speed_kmh).toFixed(1) : "-"}</p>
              <p className="text-[10px] text-text-tertiary">km/h</p>
            </div>
          </div>
        </div>

        {/* Elevation Profile */}
        {elevationData.length > 10 && (
          <div className="card shadow-card p-5 mb-4">
            <h2 className="text-[15px] font-bold mb-1">고도 프로필</h2>
            <div className="flex items-center gap-3 mb-3 text-[11px] text-text-tertiary">
              <span>최고 {maxEle.toFixed(0)}m</span>
              <span>최저 {minEle.toFixed(0)}m</span>
              <span>획득 고도 {activity.elevation_gain_m || 0}m</span>
            </div>
            <div className="h-[120px] flex items-end gap-px">
              {elevationData.filter((_, i) => i % Math.max(1, Math.floor(elevationData.length / 100)) === 0).map((d, i) => {
                const height = ((d.ele - minEle) / eleRange) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t-sm"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${d.ele.toFixed(0)}m`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-text-tertiary">
              <span>시작</span>
              <span>종료</span>
            </div>
          </div>
        )}

        {/* Elevation Stats */}
        {(activity.elevation_gain_m || activity.max_elevation_m) && (
          <div className="card shadow-card p-5 mb-4">
            <h2 className="text-[15px] font-bold mb-4">고도 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-secondary rounded-card p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="2"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
                  <span className="text-[11px] text-text-tertiary">획득 고도</span>
                </div>
                <p className="text-[18px] font-bold font-en">{activity.elevation_gain_m || 0}<span className="text-[12px] text-text-tertiary ml-0.5">m</span></p>
              </div>
              <div className="bg-bg-secondary rounded-card p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2"><path d="M7 7l9.2 9.2M17 7v10H7"/></svg>
                  <span className="text-[11px] text-text-tertiary">손실 고도</span>
                </div>
                <p className="text-[18px] font-bold font-en">{activity.elevation_loss_m || 0}<span className="text-[12px] text-text-tertiary ml-0.5">m</span></p>
              </div>
              {activity.max_elevation_m && (
                <div className="bg-bg-secondary rounded-card p-3.5">
                  <p className="text-[11px] text-text-tertiary mb-1">최고 고도</p>
                  <p className="text-[18px] font-bold font-en">{parseFloat(activity.max_elevation_m).toFixed(0)}<span className="text-[12px] text-text-tertiary ml-0.5">m</span></p>
                </div>
              )}
              {activity.min_elevation_m && (
                <div className="bg-bg-secondary rounded-card p-3.5">
                  <p className="text-[11px] text-text-tertiary mb-1">최저 고도</p>
                  <p className="text-[18px] font-bold font-en">{parseFloat(activity.min_elevation_m).toFixed(0)}<span className="text-[12px] text-text-tertiary ml-0.5">m</span></p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
