"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWalkPlans, useRequestCompanion } from "@/hooks/useCompanions";
import { useAuthStore } from "@/stores/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { PACE_LABELS, TRAIL_TYPE_CONFIG, formatDistance, formatDuration } from "@/lib/utils";
import type { WalkPlan } from "@/types";

export default function CompanionsPage() {
  const { isAuthenticated } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [region, setRegion] = useState("");
  const [trailType, setTrailType] = useState("");
  const [showRequestModal, setShowRequestModal] = useState<number | null>(null);
  const [requestMessage, setRequestMessage] = useState("");

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (selectedDate) p.date = selectedDate;
    if (region) p.region = region;
    if (trailType) p.trail_type = trailType;
    return p;
  }, [selectedDate, region, trailType]);

  const { data: plans = [], isLoading } = useWalkPlans(params);
  const requestMutation = useRequestCompanion();

  // Generate date chips for next 30 days
  const dateChips = useMemo(() => {
    const chips = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const label = `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`;
      chips.push({ date: dateStr, label, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
    }
    return chips;
  }, []);

  const REGIONS = ["서울", "부산", "제주", "전주", "강릉", "경주", "하동"];

  const handleRequest = async (planId: number) => {
    await requestMutation.mutateAsync({ planId, message: requestMessage });
    setShowRequestModal(null);
    setRequestMessage("");
  };

  return (
    <div className="md:pt-16 max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">동행 찾기</h1>
          <p className="text-text-secondary text-[14px] mt-0.5">함께 걸을 사람을 찾아보세요</p>
        </div>
        {isAuthenticated && (
          <Link href="/walk-plans/new" className="btn-primary !py-2.5 !px-5 !text-[13px]">
            + 일정 등록
          </Link>
        )}
      </div>

      {/* Date selector */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        <button
          onClick={() => setSelectedDate("")}
          className={!selectedDate ? "chip-active flex-shrink-0" : "chip flex-shrink-0"}
        >
          전체
        </button>
        {dateChips.slice(0, 14).map((chip) => (
          <button
            key={chip.date}
            onClick={() => setSelectedDate(chip.date === selectedDate ? "" : chip.date)}
            className={`flex-shrink-0 ${
              selectedDate === chip.date
                ? "chip-active"
                : chip.isWeekend
                ? "chip !bg-accent-light !text-primary"
                : "chip"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="chip cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238B95A1%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
        >
          <option value="">지역</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={trailType}
          onChange={(e) => setTrailType(e.target.value)}
          className="chip cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238B95A1%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
        >
          <option value="">코스 유형</option>
          {Object.entries(TRAIL_TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Walk plan cards */}
      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">불러오는 중...</div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="아직 이 날짜에 등록된 일정이 없어요"
          description="첫 일정을 등록해보세요!"
          action={
            isAuthenticated ? (
              <Link
                href="/walk-plans/new"
                className="px-6 py-3 bg-primary text-white rounded-button font-medium"
              >
                내가 첫 일정 등록하기
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <WalkPlanCard
              key={plan.id}
              plan={plan}
              onRequest={() => setShowRequestModal(plan.id)}
            />
          ))}
        </div>
      )}

      {/* Request modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-card shadow-hover w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">동행 신청하기</h3>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="안녕하세요! 같이 걸어요~"
              rows={3}
              maxLength={200}
              className="input-field resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRequestModal(null)}
                className="px-4 py-2 text-sm text-text-secondary"
              >
                취소
              </button>
              <button
                onClick={() => handleRequest(showRequestModal)}
                disabled={!requestMessage || requestMutation.isPending}
                className="px-6 py-2 bg-primary text-white rounded-button text-sm font-medium disabled:opacity-50"
              >
                {requestMutation.isPending ? "신청 중..." : "신청 보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WalkPlanCard({ plan, onRequest }: { plan: WalkPlan; onRequest: () => void }) {
  const pace = PACE_LABELS[plan.pace];
  const trailType = TRAIL_TYPE_CONFIG[plan.trail?.trail_type || "mixed"];
  const dateObj = new Date(plan.planned_date);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dateLabel = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`;

  return (
    <div className="bg-white rounded-card shadow-soft p-5">
      <div className="flex gap-4">
        {/* Trail thumbnail */}
        <Link href={`/trails/${plan.trail?.id}`} className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-accent/20">
          {plan.trail?.cover_image ? (
            <Image src={plan.trail.cover_image} alt="" fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🥾</div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          {/* Trail info */}
          <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
            <span>{trailType?.label} · {plan.trail?.region}</span>
          </div>
          <Link href={`/trails/${plan.trail?.id}`} className="font-bold text-base truncate block hover:text-primary">
            {plan.trail?.title}
          </Link>

          {/* Date & pace */}
          <div className="flex items-center gap-2 mt-1.5 text-sm text-text-secondary">
            <span>📅 {dateLabel}</span>
            {plan.planned_time && <span>🕐 {plan.planned_time.slice(0, 5)}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
            <span>{formatDistance(plan.trail?.distance_km || "0")}</span>
            <span>·</span>
            <span>{formatDuration(plan.trail?.estimated_minutes || 0)}</span>
            <span>·</span>
            <span>{pace?.emoji} {pace?.label}</span>
          </div>
        </div>
      </div>

      {/* Author & message */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t">
        <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
          {plan.user?.profile_image ? (
            <Image src={plan.user.profile_image} alt="" width={40} height={40} className="object-cover" />
          ) : (
            <span className="text-sm">👤</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{plan.user?.nickname}</span>
            {plan.user?.age_range && (
              <span className="text-xs text-text-secondary">{plan.user.age_range}</span>
            )}
            {plan.user?.companion_rating && (
              <span className="text-xs text-yellow-600">★{plan.user.companion_rating}</span>
            )}
          </div>
          {plan.message && (
            <p className="text-sm text-text-secondary truncate mt-0.5">"{plan.message}"</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-text-secondary">
          동행 {plan.accepted_count || 0}/{plan.max_companions}명 모집 중
        </span>
        <button
          onClick={onRequest}
          className="px-5 py-2 bg-primary text-white rounded-button text-sm font-medium hover:shadow-hover transition-all"
        >
          동행 신청하기
        </button>
      </div>
    </div>
  );
}
