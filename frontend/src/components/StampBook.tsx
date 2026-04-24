"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export interface StampPoint {
  id: number;
  trail: number;
  name: string;
  lat: string;
  lng: string;
  radius_meters: number;
  description: string;
  emoji: string;
  order: number;
  is_collected: boolean;
}

function useTrailStamps(trailId: number) {
  return useQuery<StampPoint[]>({
    queryKey: ["trail-stamps", trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/stamps/`, {
        _silent: true,
      } as any);
      return data;
    },
    enabled: Number.isFinite(trailId) && trailId > 0,
    retry: false,
  });
}

function useCollectStamp(trailId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stampId,
      lat,
      lng,
    }: {
      stampId: number;
      lat: number;
      lng: number;
    }) => {
      const { data } = await api.post(
        `/trails/${trailId}/stamps/${stampId}/collect/`,
        { lat, lng }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trail-stamps", trailId] });
    },
  });
}

/** Public — used by the Live Walk overlay to fetch + watch stamps. */
export function useTrailStampsPublic(trailId: number) {
  return useTrailStamps(trailId);
}

interface StampBookProps {
  trailId: number;
  /** Called when user clicks the "GPS로 자동 수집 시작" button. */
  onStartLiveWalk?: () => void;
}

export function StampBook({ trailId, onStartLiveWalk }: StampBookProps) {
  const { data: stamps = [], isLoading } = useTrailStamps(trailId);
  const { isAuthenticated } = useAuthStore();
  const collectStamp = useCollectStamp(trailId);

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="h-6 w-40 bg-bg-secondary rounded animate-pulse mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl bg-bg-secondary animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (stamps.length === 0) return null;

  const collectedCount = stamps.filter((s) => s.is_collected).length;
  const totalCount = stamps.length;

  const handleCollect = async (stamp: StampPoint) => {
    if (stamp.is_collected || !isAuthenticated) return;

    if (!navigator.geolocation) {
      alert("GPS를 사용할 수 없습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await collectStamp.mutateAsync({
            stampId: stamp.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        } catch (err: any) {
          const detail =
            err?.response?.data?.detail || "스탬프 수집에 실패했습니다.";
          alert(detail);
        }
      },
      () => {
        alert("위치 정보를 가져올 수 없습니다. GPS를 확인해주세요.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-[17px] font-bold text-text-primary">
          스탬프북
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-text-secondary whitespace-nowrap">
            {collectedCount}/{totalCount}
          </span>
          {onStartLiveWalk && isAuthenticated && collectedCount < totalCount && (
            <button
              onClick={onStartLiveWalk}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[11.5px] font-semibold active:scale-95 transition-transform"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
              </span>
              <span>GPS 자동 수집</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-bg-secondary rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{
            width: `${totalCount > 0 ? (collectedCount / totalCount) * 100 : 0}%`,
          }}
        />
      </div>

      {/* Stamp grid */}
      <div className="grid grid-cols-4 gap-3">
        {stamps.map((stamp) => (
          <button
            key={stamp.id}
            onClick={() => handleCollect(stamp)}
            disabled={stamp.is_collected || collectStamp.isPending}
            className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
              stamp.is_collected
                ? "bg-[#f0f7f0] border-primary/30"
                : "bg-bg-secondary border-transparent opacity-40 grayscale"
            } ${
              !stamp.is_collected && isAuthenticated
                ? "hover:opacity-70 hover:grayscale-0 cursor-pointer"
                : ""
            }`}
            title={stamp.description || stamp.name}
          >
            <span className="text-2xl mb-1">{stamp.emoji}</span>
            <span
              className={`text-[11px] font-medium text-center leading-tight line-clamp-2 ${
                stamp.is_collected ? "text-text-primary" : "text-text-tertiary"
              }`}
            >
              {stamp.name}
            </span>
            {stamp.is_collected && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>

      {/* All collected celebration */}
      {collectedCount === totalCount && totalCount > 0 && (
        <div className="mt-4 p-4 bg-[#f0f7f0] rounded-2xl text-center">
          <span className="text-2xl">🎉</span>
          <p className="text-[14px] font-semibold text-primary mt-1">
            모든 스탬프를 수집했어요!
          </p>
        </div>
      )}
    </div>
  );
}
