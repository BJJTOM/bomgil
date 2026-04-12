"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useActivity } from "@/hooks/useActivities";
import { useQueryClient } from "@tanstack/react-query";
import { MapView } from "@/components/MapView";
import { MapFullscreen, MapExpandButton } from "@/components/MapFullscreen";
import { PhotoLightbox } from "@/components/PhotoLightbox";
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
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Merge state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [sameDayActivities, setSameDayActivities] = useState<any[]>([]);
  const [selectedMergeIds, setSelectedMergeIds] = useState<number[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string>("");

  const openMergeModal = async () => {
    if (!activity) return;
    if (!activity.started_at && !activity.created_at) {
      alert("날짜 정보가 없어 합치기를 할 수 없습니다.");
      return;
    }
    setShowMergeModal(true);
    setMergeLoading(true);
    setMergeError("");
    try {
      const dateStr = ((activity.started_at || activity.created_at) as string).split("T")[0];
      const { data } = await api.get("/activities/", { params: { page_size: 50 } });
      const results = data?.results ?? data ?? [];
      const sameDay = results.filter((a: any) => {
        if (a.id === activity.id) return false;
        const aDate = ((a.started_at || a.created_at || "") as string).split("T")[0];
        return aDate === dateStr;
      });
      setSameDayActivities(sameDay);
      setSelectedMergeIds([]);
    } catch {
      setMergeError("활동 목록을 불러오지 못했습니다.");
    } finally {
      setMergeLoading(false);
    }
  };

  const toggleMergeSelect = (mergeId: number) => {
    setSelectedMergeIds((prev) =>
      prev.includes(mergeId) ? prev.filter((x) => x !== mergeId) : [...prev, mergeId],
    );
  };

  const executeMerge = async (deleteOriginals: boolean) => {
    if (!activity || selectedMergeIds.length === 0) return;
    if (deleteOriginals && !confirm("원본 기록도 함께 삭제됩니다. 계속하시겠어요?")) return;
    setMerging(true);
    setMergeError("");
    try {
      const { data } = await api.post("/activities/merge/", {
        activity_ids: [activity.id, ...selectedMergeIds],
        delete_originals: deleteOriginals,
      });
      setShowMergeModal(false);
      qc.invalidateQueries({ queryKey: ["activity", id] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      router.push(`/activities/${data.id}`);
    } catch (e: any) {
      setMergeError(e?.response?.data?.error || "합치기에 실패했습니다.");
    } finally {
      setMerging(false);
    }
  };

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
            <>
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
              <MapExpandButton onClick={() => setMapFullscreen(true)} />
              <MapFullscreen
                open={mapFullscreen}
                onClose={() => setMapFullscreen(false)}
                title={activity.title || "활동 기록"}
                pathCoordinates={pathCoordinates}
                markers={[
                  { id: 1, lat: trackPoints[0].lat, lng: trackPoints[0].lng, title: "출발", emoji: "🟢" },
                  { id: 2, lat: trackPoints[trackPoints.length - 1].lat, lng: trackPoints[trackPoints.length - 1].lng, title: "도착", emoji: "🔴" },
                ]}
                distance={activity.distance_km || undefined}
                duration={activity.duration_minutes ? String(activity.duration_minutes) : undefined}
                theme="dark"
              />
            </>
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

        {/* Photos */}
        {(activity as any).photos && (activity as any).photos.length > 0 && (
          <div className="card shadow-card p-5 mb-4">
            <h2 className="text-[15px] font-bold mb-3">사진 ({(activity as any).photos.length})</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(activity as any).photos.map((p: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setLightboxIndex(i);
                    setLightboxOpen(true);
                  }}
                  className="flex-shrink-0 w-[120px] text-left active:opacity-70 transition-opacity"
                >
                  <img src={p.uri || p.image} alt="" className="w-[120px] h-[120px] object-cover rounded-xl bg-gray-100" />
                  {p.title && <p className="text-[11px] text-gray-500 mt-1 truncate">{p.title}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Spots */}
        {(activity as any).spots && (activity as any).spots.length > 0 && (
          <div className="card shadow-card p-5 mb-4">
            <h2 className="text-[15px] font-bold mb-3">스팟 ({(activity as any).spots.length})</h2>
            <div className="space-y-2">
              {(activity as any).spots.map((spot: any, i: number) => {
                const colors: Record<string, string> = { restaurant: "#FF6B6B", cafe: "#F59E0B", photo: "#4ADE80", rest: "#60A5FA", view: "#A78BFA", "맛집": "#D85A30", "카페": "#378ADD", "포토": "#7F77DD", "휴식": "#888780", "전망": "#EF9F27" };
                const color = colors[spot.type] || "#888";
                return (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">{spot.name}</p>
                      {spot.description && <p className="text-[12px] text-gray-500 truncate">{spot.description}</p>}
                    </div>
                    <span className="text-[10px] text-gray-400 px-2 py-0.5 bg-white rounded">{spot.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === Activity Management === */}
        <div className="card shadow-card p-5 mb-4">
          <h2 className="text-[15px] font-bold mb-4">활동 관리</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Merge records */}
            <button
              onClick={openMergeModal}
              className="bg-bg-secondary rounded-xl p-4 text-left hover:bg-blue-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 009 9"/></svg>
              </div>
              <p className="text-[13px] font-bold text-gray-900">기록 합치기</p>
              <p className="text-[11px] text-gray-500">다른 활동과 병합</p>
            </button>

            {/* Add spot */}
            <button
              onClick={() => alert("스팟 추가 기능은 곧 제공됩니다")}
              className="bg-bg-secondary rounded-xl p-4 text-left hover:bg-amber-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <p className="text-[13px] font-bold text-gray-900">스팟 추가</p>
              <p className="text-[11px] text-gray-500">장소 등록하기</p>
            </button>

            {/* Share course */}
            <button
              onClick={() => router.push(`/trails/new?fromActivity=${id}`)}
              className="bg-bg-secondary rounded-xl p-4 text-left hover:bg-green-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </div>
              <p className="text-[13px] font-bold text-gray-900">코스 공유</p>
              <p className="text-[11px] text-gray-500">경로를 코스로</p>
            </button>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      <PhotoLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        images={((activity as any).photos || []).map((p: any) => ({
          src: p.uri || p.image,
          caption: p.title || p.caption,
        }))}
      />

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => !merging && setShowMergeModal(false)}>
          <div
            className="bg-white w-full md:max-w-md rounded-t-[24px] md:rounded-[24px] max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold">기록 합치기</h3>
                <button
                  onClick={() => !merging && setShowMergeModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-[12px] text-gray-500 mt-1">같은 날짜의 다른 활동을 선택하세요</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {mergeLoading ? (
                <div className="py-12 text-center text-gray-400 text-[14px]">불러오는 중...</div>
              ) : mergeError ? (
                <div className="py-8 text-center">
                  <p className="text-[14px] text-red-500 mb-3">{mergeError}</p>
                  <button onClick={openMergeModal} className="text-[13px] text-primary underline">
                    다시 시도
                  </button>
                </div>
              ) : sameDayActivities.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-[28px] mb-2">📭</div>
                  <p className="text-[14px] text-gray-500">같은 날짜의 다른 기록이 없어요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sameDayActivities.map((a) => {
                    const checked = selectedMergeIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleMergeSelect(a.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                          checked ? "bg-emerald-50 border-emerald-400" : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                            checked ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
                          }`}
                        >
                          {checked && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-gray-900 truncate">
                            {a.title || "활동 기록"}
                          </p>
                          <div className="flex items-center gap-2 text-[12px] text-gray-500 mt-0.5">
                            {a.distance_km && <span>{parseFloat(a.distance_km).toFixed(2)}km</span>}
                            {a.duration_minutes != null && (
                              <>
                                <span>·</span>
                                <span>{formatDuration(a.duration_minutes)}</span>
                              </>
                            )}
                            {a.started_at && (
                              <>
                                <span>·</span>
                                <span>
                                  {new Date(a.started_at).toLocaleTimeString("ko-KR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {sameDayActivities.length > 0 && !mergeLoading && (
              <div className="px-5 py-4 border-t border-gray-100 space-y-2">
                <p className="text-[12px] text-gray-500 text-center">
                  현재 기록 포함 <span className="font-semibold text-gray-700">{selectedMergeIds.length + 1}개</span> 합치기
                </p>
                <button
                  onClick={() => executeMerge(false)}
                  disabled={merging || selectedMergeIds.length === 0}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[14px] font-semibold disabled:opacity-40"
                >
                  {merging ? "합치는 중..." : "합치기 (원본 유지)"}
                </button>
                <button
                  onClick={() => executeMerge(true)}
                  disabled={merging || selectedMergeIds.length === 0}
                  className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-[14px] font-semibold disabled:opacity-40"
                >
                  합치기 (원본 삭제)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
