"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import api from "@/lib/api";

type ContentType = "all" | "trail" | "spot" | "review";

interface PendingItem {
  id: number;
  _type: string;
  title?: string;
  name?: string;
  content?: string;
  author?: any;
  created_at: string;
  [key: string]: any;
}

export default function ModerationPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ContentType>("all");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [rejectModal, setRejectModal] = useState<{
    type: string;
    id: number;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["moderation-stats"],
    queryFn: async () => {
      const { data } = await api.get("/moderation/stats/");
      return data;
    },
  });

  const typeParam = activeTab === "all" ? "" : `?type=${activeTab}`;
  const { data: pendingItems = [], isLoading } = useQuery<PendingItem[]>({
    queryKey: ["moderation-pending", activeTab],
    queryFn: async () => {
      const { data } = await api.get(`/moderation/pending/${typeParam}`);
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      await api.post(`/moderation/${type}/${id}/approve/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation-pending"] });
      queryClient.invalidateQueries({ queryKey: ["moderation-stats"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      type,
      id,
      reason,
    }: {
      type: string;
      id: number;
      reason: string;
    }) => {
      await api.post(`/moderation/${type}/${id}/reject/`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation-pending"] });
      queryClient.invalidateQueries({ queryKey: ["moderation-stats"] });
      setRejectModal(null);
      setRejectReason("");
    },
  });

  if (!user?.is_staff) {
    return (
      <div className="md:pt-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold">관리자 전용 페이지입니다</h2>
        </div>
      </div>
    );
  }

  const toggleSelect = (key: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleBulkApprove = () => {
    selectedItems.forEach((key) => {
      const [type, id] = key.split("-");
      approveMutation.mutate({ type, id: Number(id) });
    });
    setSelectedItems(new Set());
  };

  const TABS: { key: ContentType; label: string; count?: number }[] = [
    {
      key: "all",
      label: "전체",
      count: stats
        ? stats.pending.trails + stats.pending.spots + stats.pending.reviews
        : 0,
    },
    { key: "trail", label: "코스", count: stats?.pending.trails },
    { key: "spot", label: "경유지", count: stats?.pending.spots },
    { key: "review", label: "리뷰", count: stats?.pending.reviews },
  ];

  return (
    <div className="md:pt-16 max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-title mb-2">검열 대시보드</h1>
      <p className="text-text-secondary text-sm mb-8">
        콘텐츠를 검토하고 승인/반려하세요
      </p>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="대기 중"
            value={
              stats.pending.trails +
              stats.pending.spots +
              stats.pending.reviews
            }
            color="text-yellow-600"
          />
          <StatCard
            label="오늘 처리"
            value={stats.today.processed}
            color="text-primary"
          />
          <StatCard
            label="오늘 승인"
            value={stats.today.approved}
            color="text-green-600"
          />
          <StatCard
            label="오늘 반려"
            value={stats.today.rejected}
            color="text-danger"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 bg-danger text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selectedItems.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-accent/10 rounded-lg">
          <span className="text-sm font-medium">{selectedItems.size}개 선택</span>
          <button
            onClick={handleBulkApprove}
            className="px-4 py-1.5 bg-green-600 text-white rounded-button text-sm font-medium"
          >
            일괄 승인
          </button>
          <button
            onClick={() => setSelectedItems(new Set())}
            className="px-4 py-1.5 text-sm text-text-secondary"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* Items */}
      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">
          불러오는 중...
        </div>
      ) : pendingItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-bold">모든 검토가 완료되었습니다</h3>
          <p className="text-text-secondary mt-2">대기 중인 콘텐츠가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingItems.map((item) => {
            const itemKey = `${item._type}-${item.id}`;
            const displayTitle =
              item.title || item.name || item.content?.slice(0, 50) || "제목 없음";
            const typeLabel =
              item._type === "trail"
                ? "코스"
                : item._type === "spot"
                ? "경유지"
                : "리뷰";

            return (
              <div
                key={itemKey}
                className="bg-white rounded-card shadow-soft p-5 flex items-start gap-4"
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(itemKey)}
                  onChange={() => toggleSelect(itemKey)}
                  className="mt-1 w-4 h-4 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-gray-100 text-text-secondary px-2 py-0.5 rounded">
                      {typeLabel}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {new Date(item.created_at).toLocaleDateString("ko")}
                    </span>
                  </div>
                  <h3 className="font-bold truncate">{displayTitle}</h3>
                  {item.author && (
                    <p className="text-xs text-text-secondary mt-1">
                      작성자: {item.author.nickname || item.author_nickname || "알 수 없음"}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      approveMutation.mutate({
                        type: item._type,
                        id: item.id,
                      })
                    }
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-button text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    승인
                  </button>
                  <button
                    onClick={() =>
                      setRejectModal({ type: item._type, id: item.id })
                    }
                    className="px-4 py-2 bg-white border border-danger text-danger rounded-button text-sm font-medium hover:bg-danger/5 transition-colors"
                  >
                    반려
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-card shadow-hover w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">반려 사유</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력해주세요 (필수)"
              rows={4}
              className="input-field resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="px-4 py-2 text-sm text-text-secondary"
              >
                취소
              </button>
              <button
                onClick={() =>
                  rejectMutation.mutate({
                    type: rejectModal.type,
                    id: rejectModal.id,
                    reason: rejectReason,
                  })
                }
                disabled={!rejectReason || rejectMutation.isPending}
                className="px-6 py-2 bg-danger text-white rounded-button text-sm font-medium disabled:opacity-50"
              >
                {rejectMutation.isPending ? "처리 중..." : "반려하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-card shadow-soft p-4 text-center">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`text-2xl font-bold font-en mt-1 ${color}`}>{value}</p>
    </div>
  );
}
