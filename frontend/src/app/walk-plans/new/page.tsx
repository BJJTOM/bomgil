"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateWalkPlan } from "@/hooks/useCompanions";
import { useAuthStore } from "@/stores/auth";
import { PACE_LABELS } from "@/lib/utils";

export default function NewWalkPlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-warm" />}>
      <NewWalkPlanContent />
    </Suspense>
  );
}

function NewWalkPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const createPlan = useCreateWalkPlan();

  const [form, setForm] = useState({
    trail: searchParams.get("trail") || "",
    planned_date: "",
    planned_time: "",
    pace: "moderate",
    max_companions: 3,
    preferred_gender: "any",
    preferred_age_range: "any",
    message: "",
  });

  if (!isAuthenticated) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">로그인이 필요합니다</h2>
          <a href="/auth/login" className="text-primary font-medium">로그인하기</a>
        </div>
      </div>
    );
  }

  const updateForm = (key: string, value: any) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      ...form,
      trail: parseInt(form.trail),
      planned_time: form.planned_time || null,
    };
    const result = await createPlan.mutateAsync(data);
    router.push(`/companions`);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="md:pt-16 max-w-lg mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-2">일정 등록하기</h1>
      <p className="text-text-secondary text-sm mb-8">함께 걸을 사람을 찾아보세요</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Trail ID */}
        <div>
          <label className="text-sm font-medium block mb-1.5">코스 ID</label>
          <input
            type="number"
            value={form.trail}
            onChange={(e) => updateForm("trail", e.target.value)}
            placeholder="코스 번호를 입력하세요"
            required
            className="input-field"
          />
          <p className="text-xs text-text-secondary mt-1">
            코스 상세 페이지에서 "일정 등록" 버튼을 누르면 자동으로 채워집니다
          </p>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">날짜</label>
            <input
              type="date"
              value={form.planned_date}
              onChange={(e) => updateForm("planned_date", e.target.value)}
              min={today}
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">출발 시간 (선택)</label>
            <input
              type="time"
              value={form.planned_time}
              onChange={(e) => updateForm("planned_time", e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* Pace */}
        <div>
          <label className="text-sm font-medium block mb-2">걷기 페이스</label>
          <div className="flex gap-3">
            {Object.entries(PACE_LABELS).map(([key, { label, emoji }]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateForm("pace", key)}
                className={`flex-1 py-3 rounded-card text-center text-sm transition-all ${
                  form.pace === key
                    ? "bg-primary text-white shadow-soft"
                    : "bg-white border border-gray-200 hover:border-primary"
                }`}
              >
                <div className="text-2xl mb-1">{emoji}</div>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Max companions */}
        <div>
          <label className="text-sm font-medium block mb-1.5">최대 동행 인원</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateForm("max_companions", n)}
                className={`w-12 h-12 rounded-full text-sm font-bold transition-all ${
                  form.max_companions === n
                    ? "bg-primary text-white"
                    : "bg-white border border-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">성별 선호</label>
            <select
              value={form.preferred_gender}
              onChange={(e) => updateForm("preferred_gender", e.target.value)}
              className="input-field"
            >
              <option value="any">상관없음</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">나이대 선호</label>
            <select
              value={form.preferred_age_range}
              onChange={(e) => updateForm("preferred_age_range", e.target.value)}
              className="input-field"
            >
              <option value="any">상관없음</option>
              <option value="20s">20대</option>
              <option value="30s">30대</option>
              <option value="40s">40대</option>
              <option value="50s_plus">50대 이상</option>
            </select>
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="text-sm font-medium block mb-1.5">한마디</label>
          <textarea
            value={form.message}
            onChange={(e) => updateForm("message", e.target.value)}
            placeholder="어떤 걷기를 기대하나요?"
            rows={3}
            maxLength={200}
            className="input-field resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={createPlan.isPending}
          className="w-full py-3 bg-primary text-white rounded-button font-bold text-base hover:shadow-hover transition-all disabled:opacity-50"
        >
          {createPlan.isPending ? "등록 중..." : "일정 등록하기"}
        </button>
      </form>
    </div>
  );
}
