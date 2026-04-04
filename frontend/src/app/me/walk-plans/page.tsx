"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMyWalkPlans, useAcceptRequest, useRejectRequest } from "@/hooks/useCompanions";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { PACE_LABELS, formatDistance, formatDuration } from "@/lib/utils";
import type { WalkPlan, CompanionRequest } from "@/types";

export default function MyWalkPlansPage() {
  const { isAuthenticated } = useAuthStore();
  const { data: plans = [], isLoading } = useMyWalkPlans();
  const acceptReq = useAcceptRequest();
  const rejectReq = useRejectRequest();

  if (!isAuthenticated) {
    return (
      <div className="md:pt-[60px] flex items-center justify-center min-h-screen">
        <EmptyState title="로그인이 필요합니다" />
      </div>
    );
  }

  return (
    <div className="md:pt-[60px] max-w-2xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">내 일정</h1>
        <Link href="/walk-plans/new" className="btn-primary !py-2.5 !px-5 !text-[13px]">
          + 일정 등록
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">불러오는 중...</div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="등록한 일정이 없습니다"
          description="일정을 등록하고 동행을 찾아보세요!"
          action={
            <Link href="/walk-plans/new" className="btn-primary">일정 등록하기</Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {plans.map((plan: WalkPlan) => (
            <MyWalkPlanCard
              key={plan.id}
              plan={plan}
              onAccept={(reqId) => acceptReq.mutate(reqId)}
              onReject={(reqId) => rejectReq.mutate(reqId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MyWalkPlanCard({
  plan,
  onAccept,
  onReject,
}: {
  plan: WalkPlan;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const [showRequests, setShowRequests] = useState(false);
  const pace = PACE_LABELS[plan.pace];

  const { data: requests = [] } = useQuery<CompanionRequest[]>({
    queryKey: ["plan-requests", plan.id],
    queryFn: async () => (await api.get(`/walk-plans/${plan.id}/requests/`)).data,
    enabled: showRequests,
  });

  const statusLabel: Record<string, { text: string; color: string }> = {
    open: { text: "모집 중", color: "bg-success/10 text-success" },
    matched: { text: "매칭 완료", color: "bg-primary-50 text-primary" },
    closed: { text: "마감", color: "bg-bg-secondary text-text-secondary" },
    completed: { text: "완료", color: "bg-bg-secondary text-text-tertiary" },
  };
  const st = statusLabel[plan.companion_status] || statusLabel.open;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <Link href={`/trails/${plan.trail?.id}`} className="font-semibold text-[16px] hover:text-primary truncate flex-1">
          {plan.trail?.title}
        </Link>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill ${st.color}`}>
          {st.text}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[13px] text-text-secondary">
        <span>{plan.planned_date}</span>
        {plan.planned_time && <span>· {plan.planned_time.slice(0, 5)}</span>}
        <span>· {pace?.emoji} {pace?.label}</span>
        <span>· 동행 {plan.accepted_count || 0}/{plan.max_companions}명</span>
      </div>

      {plan.message && (
        <p className="text-[13px] text-text-tertiary mt-2 truncate">"{plan.message}"</p>
      )}

      {plan.companion_status === "open" && (
        <button
          onClick={() => setShowRequests(!showRequests)}
          className="mt-3 text-[13px] text-primary font-medium"
        >
          {showRequests ? "신청 목록 접기" : "받은 신청 보기"}
        </button>
      )}

      {showRequests && (
        <div className="mt-3 space-y-2.5 border-t border-border-light pt-3">
          {requests.length === 0 ? (
            <p className="text-[13px] text-text-tertiary py-2">아직 받은 신청이 없습니다</p>
          ) : (
            requests.map((req: CompanionRequest) => (
              <div key={req.id} className="flex items-center gap-3 p-3 bg-bg-secondary rounded-button">
                <div className="w-9 h-9 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {req.requester?.profile_image ? (
                    <Image src={req.requester.profile_image} alt="" width={36} height={36} className="object-cover" />
                  ) : (
                    <span className="text-sm">👤</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium">{req.requester?.nickname}</p>
                  <p className="text-[12px] text-text-tertiary truncate">{req.message}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onAccept(req.id)}
                    className="px-3.5 py-1.5 bg-primary text-white rounded-button text-[12px] font-semibold"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => onReject(req.id)}
                    className="px-3.5 py-1.5 bg-bg-secondary text-text-secondary rounded-button text-[12px] font-medium"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
