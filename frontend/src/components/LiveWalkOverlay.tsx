"use client";

import { useEffect, useRef, useState } from "react";
import { MapView } from "./MapView";
import type { StampPoint } from "./StampBook";
import {
  formatElapsed,
  formatMetres,
  useLiveWalk,
  type AwardedStamp,
} from "@/hooks/useLiveWalk";
import { globalToast } from "@/lib/globalToast";

interface Props {
  open: boolean;
  onClose: () => void;
  trailId: number;
  trailTitle: string;
  pathCoordinates: [number, number][];
  stamps: StampPoint[];
  mapCenter: { lat: number; lng: number };
}

/**
 * Full-screen live walk overlay. Drives continuous GPS, auto-awards
 * stamps, and shows live HUD (elapsed / walked km / next stamp).
 */
export function LiveWalkOverlay({
  open,
  onClose,
  trailId,
  trailTitle,
  pathCoordinates,
  stamps,
  mapCenter,
}: Props) {
  const [mapInstance, setMapInstance] = useState<any>(null);
  const positionMarkerRef = useRef<any>(null);
  const [celebration, setCelebration] = useState<AwardedStamp | null>(null);
  const [ended, setEnded] = useState(false);

  const walk = useLiveWalk({
    trailId,
    stamps,
    active: open && !ended,
    onStampAwarded: (stamp) => {
      setCelebration({ stamp, awardedAt: Date.now() });
      globalToast(
        `${stamp.emoji || "✨"} "${stamp.name}" 스탬프 획득!`,
        "success",
      );
    },
    onError: (msg) => globalToast(msg, "error"),
  });

  // Auto-hide celebration after 3s
  useEffect(() => {
    if (!celebration) return;
    const id = setTimeout(() => setCelebration(null), 2800);
    return () => clearTimeout(id);
  }, [celebration]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setEnded(false);
      setCelebration(null);
      positionMarkerRef.current?.remove?.();
      positionMarkerRef.current = null;
    }
  }, [open]);

  // Live position dot on map
  useEffect(() => {
    if (!mapInstance || !walk.position) return;
    let disposed = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (disposed) return;
      const lngLat: [number, number] = [walk.position!.lng, walk.position!.lat];

      if (positionMarkerRef.current) {
        positionMarkerRef.current.setLngLat(lngLat);
      } else {
        const el = document.createElement("div");
        el.className = "moru-live-dot";
        el.innerHTML = `
          <span class="moru-live-dot-pulse"></span>
          <span class="moru-live-dot-core"></span>
        `;
        positionMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat(lngLat)
          .addTo(mapInstance);
      }
      // Gently recenter only when user is off-screen (avoid constant pan)
      const pt = mapInstance.project(lngLat);
      const c = mapInstance.getContainer();
      const margin = 80;
      if (
        pt.x < margin ||
        pt.y < margin ||
        pt.x > c.clientWidth - margin ||
        pt.y > c.clientHeight - margin
      ) {
        mapInstance.easeTo({ center: lngLat, duration: 700 });
      }
    })();
    return () => {
      disposed = true;
    };
  }, [mapInstance, walk.position]);

  if (!open) return null;

  const progressStamps = stamps.length;
  const collectedCount =
    stamps.filter((s) => s.is_collected).length + walk.awarded.length;
  const progressPct = progressStamps > 0 ? (collectedCount / progressStamps) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      {/* Map */}
      <div className="absolute inset-0">
        <MapView
          pathCoordinates={pathCoordinates}
          center={mapCenter}
          zoom={16}
          theme="light"
          className="w-full h-full"
          showNavigationControl={false}
          enableScrollZoom
          onMapReady={setMapInstance}
          showPOIMarkers
          markers={stamps.map((s, i) => ({
            id: -(1000 + i),
            lat: parseFloat(s.lat),
            lng: parseFloat(s.lng),
            title: s.name,
            emoji: s.emoji || "📍",
          }))}
        />
      </div>

      {/* Top HUD bar */}
      <div
        className="absolute top-0 left-0 right-0 z-[10000] bg-gradient-to-b from-black/75 via-black/50 to-transparent"
        style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      >
        <div className="flex items-center gap-3 px-4 pt-3 pb-10">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white active:scale-95 transition-transform"
            aria-label="닫기"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-white/70 font-medium uppercase tracking-wider">
              LIVE
            </div>
            <div className="text-[14px] text-white font-semibold truncate">
              {trailTitle}
            </div>
          </div>
          {walk.permissionStatus === "granted" && walk.position && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-400/30 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
              </span>
              <span className="text-[11px] font-semibold text-green-200">GPS</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD */}
      <div
        className="absolute left-0 right-0 bottom-0 z-[10000] bg-gradient-to-t from-black/85 via-black/60 to-transparent"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="px-4 pt-16 pb-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="경과" value={formatElapsed(walk.elapsedMs)} />
            <Stat label="걸은 거리" value={formatMetres(walk.distanceWalkedM)} />
            <Stat
              label="스탬프"
              value={`${collectedCount}/${progressStamps}`}
            />
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/15 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-[#34C759] via-[#FFB770] to-[#FF6B35] transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Next stamp hint */}
          {walk.nextStamp ? (
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-3 py-2.5 mb-3">
              <span className="text-[22px] leading-none flex-shrink-0">
                {walk.nextStamp.stamp.emoji || "📍"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-white/60 uppercase tracking-wider">
                  다음 스탬프
                </div>
                <div className="text-[13.5px] text-white font-semibold truncate">
                  {walk.nextStamp.stamp.name}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[15px] font-bold font-en text-white">
                  {formatMetres(walk.nextStamp.distanceM)}
                </div>
                <div className="text-[9.5px] text-white/60 uppercase">
                  남음
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2.5 mb-3 text-center text-[13px] text-white/90 font-medium">
              🎉 모든 스탬프를 모았어요!
            </div>
          )}

          {/* End walk button */}
          <button
            onClick={() => {
              setEnded(true);
              onClose();
            }}
            className="w-full py-3.5 rounded-2xl bg-white text-black text-[14.5px] font-bold active:scale-[0.98] transition-transform"
          >
            걷기 종료
          </button>
        </div>
      </div>

      {/* Permission / Loading states */}
      {walk.permissionStatus === "idle" && !walk.position && (
        <div className="absolute inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
          <div className="px-5 py-4 rounded-2xl bg-white/95 text-center shadow-2xl">
            <div className="text-[30px] mb-2">📡</div>
            <div className="text-[13px] font-semibold text-gray-900">
              GPS 신호를 가져오는 중…
            </div>
            <div className="text-[11.5px] text-gray-500 mt-1">
              위치 권한을 허용해 주세요
            </div>
          </div>
        </div>
      )}

      {walk.permissionStatus === "denied" && (
        <div className="absolute inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
          <div className="px-5 py-4 rounded-2xl bg-white text-center shadow-2xl max-w-sm">
            <div className="text-[30px] mb-2">📍</div>
            <div className="text-[14px] font-bold text-gray-900 mb-1">
              위치 권한이 필요해요
            </div>
            <div className="text-[12.5px] text-gray-600 mb-3 leading-relaxed">
              스탬프를 자동 지급하려면 현재 위치를 계속 확인할 수 있어야 해요.
              브라우저 주소창 왼쪽 자물쇠 아이콘에서 위치 권한을 허용한 뒤
              다시 시도해 주세요.
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-semibold"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Stamp celebration overlay */}
      {celebration && (
        <div className="absolute inset-0 z-[10002] flex items-center justify-center pointer-events-none">
          <div className="moru-stamp-celebrate rounded-3xl bg-white/95 backdrop-blur-xl px-8 py-6 shadow-2xl text-center">
            <div className="text-[64px] leading-none mb-2">
              {celebration.stamp.emoji || "✨"}
            </div>
            <div className="text-[11px] font-semibold tracking-widest text-primary uppercase">
              STAMP UNLOCKED
            </div>
            <div className="text-[18px] font-extrabold text-gray-900 mt-1">
              {celebration.stamp.name}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .moru-live-dot {
          position: relative;
          width: 22px;
          height: 22px;
          pointer-events: none;
        }
        .moru-live-dot-core {
          position: absolute;
          inset: 4px;
          background: #1d9bf0;
          border: 2.5px solid #fff;
          border-radius: 999px;
          box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.15), 0 4px 14px rgba(29, 155, 240, 0.45);
        }
        .moru-live-dot-pulse {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: rgba(29, 155, 240, 0.35);
          animation: moru-live-pulse 1.6s ease-out infinite;
        }
        @keyframes moru-live-pulse {
          0% { transform: scale(0.6); opacity: 0.8; }
          80% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .moru-stamp-celebrate {
          animation: moru-stamp-pop 420ms cubic-bezier(0.175, 0.885, 0.32, 1.35);
        }
        @keyframes moru-stamp-pop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-3 py-2 text-center">
      <div className="text-[9.5px] text-white/60 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-[15px] font-bold font-en text-white tabular-nums">
        {value}
      </div>
    </div>
  );
}
