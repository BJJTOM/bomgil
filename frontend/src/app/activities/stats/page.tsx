"use client";

import { useRouter } from "next/navigation";
import { useActivityStats, useActivities } from "@/hooks/useActivities";
import { useAuthStore } from "@/stores/auth";

export default function WalkStatsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { data: stats } = useActivityStats();
  const { data: activities = [] } = useActivities();

  if (!isAuthenticated) { router.replace("/auth/login"); return null; }

  const totalDays = Array.from(new Set(activities.map((a: any) => a.started_at?.split("T")[0]).filter(Boolean))).length;
  const avgDistance = stats && stats.track_count > 0 ? (stats.total_distance_km / stats.track_count).toFixed(1) : "0";
  const avgPace = stats && stats.total_distance_km > 0 ? (stats.total_duration_minutes / stats.total_distance_km).toFixed(1) : "0";

  // Streak calculation
  const dates = Array.from(new Set(activities.map((a: any) => a.started_at?.split("T")[0]).filter(Boolean))).sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (d.toISOString().split("T")[0] === expected.toISOString().split("T")[0]) streak++;
    else break;
  }

  const goals = [
    { label: "거리", current: stats?.total_distance_km || 0, target: 5, unit: "km", color: "#2D4A2E" },
    { label: "걸음", current: stats?.weekly?.[stats.weekly.length - 1]?.total_steps || 0, target: 10000, unit: "", color: "#4ADE80" },
    { label: "칼로리", current: stats?.weekly?.[stats.weekly.length - 1]?.total_calories || 0, target: 300, unit: "kcal", color: "#FF6B6B" },
  ];

  return (
    <div className="md:pt-[60px] min-h-screen bg-gray-50">
      <header className="sticky top-0 md:top-[60px] z-30 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg">←</button>
          <span className="text-[16px] font-semibold text-gray-900">걷기 통계</span>
          <div className="w-8" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Streak */}
        <div className="bg-white rounded-2xl p-5 text-center">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">연속 걷기</p>
          <p className="text-[48px] font-extrabold text-gray-900 leading-none">{streak}</p>
          <p className="text-[14px] text-gray-400 mt-1">일 연속</p>
        </div>

        {/* Daily Goals */}
        <div className="bg-white rounded-2xl p-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">오늘 목표</h2>
          <div className="space-y-4">
            {goals.map((g) => {
              const pct = Math.min((g.current / g.target) * 100, 100);
              return (
                <div key={g.label}>
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span className="text-gray-500">{g.label}</span>
                    <span className="font-semibold text-gray-900">{typeof g.current === "number" ? g.current.toLocaleString() : g.current} / {g.target.toLocaleString()}{g.unit}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total Stats */}
        <div className="bg-white rounded-2xl p-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">전체 통계</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "총 거리", value: `${stats?.total_distance_km?.toFixed(1) || 0}km` },
              { label: "총 걸음", value: `${stats?.total_steps?.toLocaleString() || 0}` },
              { label: "총 칼로리", value: `${stats?.total_calories?.toLocaleString() || 0}kcal` },
              { label: "총 활동", value: `${stats?.track_count || 0}회` },
              { label: "활동 일수", value: `${totalDays}일` },
              { label: "평균 거리", value: `${avgDistance}km` },
              { label: "평균 페이스", value: `${avgPace}분/km` },
              { label: "연속 일수", value: `${streak}일` },
            ].map((s) => (
              <div key={s.label} className="text-center py-3 bg-gray-50 rounded-xl">
                <p className="text-[16px] font-bold text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Chart */}
        {stats?.weekly && stats.weekly.length > 0 && (
          <div className="bg-white rounded-2xl p-5">
            <h2 className="text-[15px] font-bold text-gray-900 mb-4">주간 거리</h2>
            <div className="flex items-end gap-1.5 h-[80px]">
              {stats.weekly.map((day) => {
                const km = parseFloat(day.total_distance_km);
                const max = Math.max(...stats.weekly.map((d) => parseFloat(d.total_distance_km)), 1);
                const h = Math.max((km / max) * 100, 4);
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-gray-400">{km > 0 ? km.toFixed(1) : ""}</span>
                    <div className="w-full rounded-sm transition-all" style={{ height: `${h}%`, backgroundColor: "#2D4A2E", opacity: km > 0 ? 1 : 0.15 }} />
                    <span className="text-[9px] text-gray-400">{new Date(day.date).toLocaleDateString("ko", { weekday: "short" })}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
