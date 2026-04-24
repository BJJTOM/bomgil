"use client";

/**
 * MoruMap — Komoot 스타일 지도 컴포넌트.
 *
 * Mapbox GL JS 기반. 다크 베이스맵(dark-v11) 위에 아래 레이어를 얹어 Komoot 수준의
 * 시각적 퀄리티를 냄:
 *   - Hillshade (mapbox-terrain-dem-v1)
 *   - 3D Terrain (선택 토글, 모바일 기본 OFF)
 *   - Contour (mapbox-terrain-v2 의 vector 등고선, 반투명 그린)
 *   - 강화된 트레일 라인 (outline → glow → main → 진행방향 arrows)
 *   - 산봉우리 라벨 (이름 + 고도 표시)
 *   - i18n 로케일에 따라 한/영/일/중 라벨 전환
 *
 * 기존 트레일 데이터 fetch 로직은 건드리지 않는다. 이 컴포넌트는 시각화 레이어만
 * 담당하며, 부모로부터 pathCoordinates / markers / center 를 prop 으로 받는다.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  addPeakElevationOverlay,
  addTrailDistanceMarkers,
  apply3DBuildings,
  applyHikingPathsLayer,
  applyMoruAtmosphere,
  applyMoruBaseLayers,
  applyMoruLabelLocale,
  cleanupMoruLayers,
  drawMoruTrailLine,
  enhanceMapLabels,
  type MoruMapLocale,
} from "./moruMapLayers";

interface MapViewProps {
  country?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: {
    id: number;
    lat: number;
    lng: number;
    title: string;
    emoji?: string;
  }[];
  pathCoordinates?: [number, number][];
  onMarkerClick?: (id: number) => void;
  className?: string;
  theme?: "dark" | "light";
  showStats?: boolean;
  distance?: string;
  duration?: string;
  /** 다국어 라벨 (기본 'ko'). 'zh' 는 간체(zh-Hans). */
  locale?: MoruMapLocale;
  /** 3D pitch 지형. 모바일에선 성능 이슈로 기본 false. */
  terrain3D?: boolean;
  /** 줌인 시 등고선 표시 (기본 true). */
  showContours?: boolean;
  /** 산봉우리 강조 라벨 (기본 true). */
  peakLabels?: boolean;
  /** 우상단 3D 토글 버튼 노출 여부 (기본 true). */
  showTerrainToggle?: boolean;
  /** 도로/동네/POI 라벨 가독성 강화 (기본 true). */
  enhanceLabels?: boolean;
  /** POI 라벨 밀도 ('default' | 'dense', 기본 'dense'). */
  labelDensity?: "default" | "dense";
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// 스타일 URL — 환경변수로 커스텀 Studio 스타일 주입 가능. 비워두면 dark-v11.
const CUSTOM_STYLE_URL = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || "";

const MAP_STYLES = {
  light: "mapbox://styles/mapbox/outdoors-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
};

function getStyleURL(theme: "dark" | "light") {
  if (CUSTOM_STYLE_URL) return CUSTOM_STYLE_URL;
  return MAP_STYLES[theme];
}

// 모바일 뷰포트 감지 — SSR 안전. Terrain 기본 상태를 결정할 때 사용.
function detectIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  // 768px 기준 (Tailwind md). pointer:coarse 까지 고려
  return window.matchMedia("(max-width: 768px)").matches;
}

export function MapView({
  country: _country = "KR",
  center,
  zoom = 13,
  markers = [],
  pathCoordinates,
  onMarkerClick,
  className = "w-full h-full min-h-[400px]",
  theme = "light",
  showStats = false,
  distance,
  duration,
  locale = "ko",
  terrain3D,
  showContours = true,
  peakLabels = true,
  showTerrainToggle = true,
  enhanceLabels = true,
  labelDensity = "dense",
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const posMarkerRef = useRef<any>(null);
  const popupsRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const initializedRef = useRef(false);

  const isDark = theme === "dark";

  // 3D 지형 상태. prop 이 주어지면 controlled, 아니면 모바일 감지 후 자동.
  const [terrain3DState, setTerrain3DState] = useState<boolean>(() =>
    typeof terrain3D === "boolean" ? terrain3D : !detectIsMobile()
  );
  useEffect(() => {
    if (typeof terrain3D === "boolean") setTerrain3DState(terrain3D);
  }, [terrain3D]);

  // ── Map 초기화 (1회) ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initMap = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        (mapboxgl as any).accessToken = MAPBOX_TOKEN;

        const defaultCenter = center || { lat: 37.5665, lng: 126.978 };

        const map = new mapboxgl.Map({
          container: mapRef.current!,
          style: getStyleURL(theme),
          center: [defaultCenter.lng, defaultCenter.lat],
          zoom,
          pitch: 0, // 3D 토글 시 setPitch 로 변경
          attributionControl: false,
          // 무료 티어 보호 — 전 세계 줌 범위는 그대로 두되 로우레벨 조작 최소화
        });

        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "bottom-right"
        );
        map.addControl(
          new mapboxgl.AttributionControl({ compact: true }),
          "bottom-right"
        );

        map.on("load", () => {
          mapInstanceRef.current = map;
          applyMoruBaseLayers(map, {
            hillshade: true,
            contours: showContours,
            terrain3D: terrain3DState,
            terrainExaggeration: 1.3,
            theme,
          });
          // Atmosphere 는 3D 모드에서만 — 2D pitch 에선 효과가 없고 프레임 비용만 발생
          if (terrain3DState) applyMoruAtmosphere(map, theme);
          applyHikingPathsLayer(map, theme);
          if (enhanceLabels) enhanceMapLabels(map, theme, { density: labelDensity });
          applyMoruLabelLocale(map, locale);
          setTimeout(() => applyMoruLabelLocale(map, locale), 300);
          if (terrain3DState) map.easeTo({ pitch: 55, duration: 400 });
          setLoaded(true);
        });

        // styledata — 1.5s 쿨다운 타임스로틀.
        // 이전엔 매 styledata 마다 applyMoruLabelLocale + enhanceMapLabels 둘 다
        // 실행했는데, setLayoutProperty / setFilter 가 또 styledata 를 트리거
        // 하면서 과부하가 발생. 여기선 최소한만.
        let _lastLocaleApply = 0;
        map.on("styledata", () => {
          if (!map.isStyleLoaded()) return;
          const now = Date.now();
          if (now - _lastLocaleApply < 1500) return;
          _lastLocaleApply = now;
          applyMoruLabelLocale(map, locale);
        });

        // ── idle: 디바운스 + 줌/위치 변화 임계치 + 중복 실행 방지 ──
        // 이전엔 매 idle 마다 label+peak 재적용 → setLayoutProperty 가 repaint 를
        // 유발 → 또 idle → 무한 루프에 가까운 부하 발생.
        // 여기선 쿨다운(2.5s) + 의미있는 변화가 있을 때만 재샘플링.
        let _lastIdleRun = 0;
        let _lastZoom = -1;
        let _lastCenterKey = '';
        map.on("idle", () => {
          if (!map.isStyleLoaded()) return;
          const now = Date.now();
          if (now - _lastIdleRun < 2500) return;
          const z = Math.round(map.getZoom() * 10) / 10;
          const c = map.getCenter();
          const ck = `${c.lng.toFixed(3)}|${c.lat.toFixed(3)}`;
          if (z === _lastZoom && ck === _lastCenterKey) return;
          _lastIdleRun = now;
          _lastZoom = z;
          _lastCenterKey = ck;
          if (peakLabels) addPeakElevationOverlay(map, theme);
        });
      } catch (err) {
        console.error("Map load error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${
              isDark ? "#1a1a2e" : "#f0f9f4"
            };border-radius:16px;">
              <div style="text-align:center;color:${isDark ? "#555" : "#777"};">
                <div style="font-size:48px;margin-bottom:8px;">&#x1f5fa;&#xfe0f;</div>
                <p style="font-size:14px;">지도를 불러올 수 없습니다</p>
              </div>
            </div>
          `;
        }
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        try { cleanupMoruLayers(mapInstanceRef.current); } catch {}
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // ── center 업데이트 (smooth pan) ────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !center) return;
    map.easeTo({ center: [center.lng, center.lat], duration: 500 });
  }, [center?.lat, center?.lng]);

  // ── terrain3D / contours / locale 변경 시 재적용 ────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !loaded) return;
    applyMoruBaseLayers(map, {
      hillshade: true,
      contours: showContours,
      terrain3D: terrain3DState,
      terrainExaggeration: 1.3,
      theme,
    });
    // Atmosphere 는 3D 모드일 때만. 2D 로 내려오면 fog/sky 비활성화 (GPU 비용 절감)
    if (terrain3DState) {
      applyMoruAtmosphere(map, theme);
    } else {
      try { map.setFog(null as any); } catch {}
      if (map.getLayer('moru-sky')) { try { map.removeLayer('moru-sky'); } catch {} }
    }
    map.easeTo({ pitch: terrain3DState ? 55 : 0, duration: 500 });
  }, [loaded, terrain3DState, showContours, theme]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !loaded) return;
    applyMoruLabelLocale(map, locale);
  }, [loaded, locale]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !loaded || !peakLabels) return;
    addPeakElevationOverlay(map, theme);
  }, [loaded, peakLabels, theme]);

  // 라벨 가독성 강화 — theme/density 변경 시 재적용
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !loaded || !enhanceLabels) return;
    enhanceMapLabels(map, theme, { density: labelDensity });
  }, [loaded, enhanceLabels, labelDensity, theme]);

  // ── Path & Markers 그리기 (기존 로직 유지 + 라인만 Komoot 버전으로) ─
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let mapboxgl: any;
    (async () => {
      mapboxgl = (await import("mapbox-gl")).default;

      // 기존 마커 정리
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];
      if (posMarkerRef.current) {
        posMarkerRef.current.remove();
        posMarkerRef.current = null;
      }

      // 트레일 라인 (Komoot 스타일 앰버 톤)
      if (pathCoordinates && pathCoordinates.length > 0) {
        drawMoruTrailLine(map, pathCoordinates, {
          theme,
          showArrows: true,
          // Komoot 의 시그니처 컬러: 따뜻한 오렌지 앰버
          color: isDark ? "#FFB770" : "#E8563D",
        });
        // 1km 마다 거리 마커
        addTrailDistanceMarkers(map, pathCoordinates, theme);

        // 시작/종료 마커 (작고 또렷한 점)
        if (pathCoordinates.length > 1) {
          const startEl = document.createElement("div");
          startEl.style.cssText =
            "width:14px;height:14px;background:#34C759;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(52,199,89,0.5);z-index:5";
          const startMarker = new mapboxgl.Marker({ element: startEl, anchor: "center" })
            .setLngLat(pathCoordinates[0] as [number, number])
            .addTo(map);
          markersRef.current.push(startMarker);

          const endEl = document.createElement("div");
          endEl.style.cssText =
            "width:14px;height:14px;background:#FF3B30;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(255,59,48,0.5);z-index:5";
          const endMarker = new mapboxgl.Marker({ element: endEl, anchor: "center" })
            .setLngLat(pathCoordinates[pathCoordinates.length - 1] as [number, number])
            .addTo(map);
          markersRef.current.push(endMarker);
        }

        // 경로 전체가 보이도록 fit
        try {
          const bounds = new mapboxgl.LngLatBounds();
          pathCoordinates.forEach((c: [number, number]) => bounds.extend(c));
          map.fitBounds(bounds, { padding: 60, duration: 0 });
        } catch {
          // 범위 계산 실패는 무시
        }
      } else {
        drawMoruTrailLine(map, null);
        addTrailDistanceMarkers(map, null, theme);
      }

      // 현재 위치 마커 (pulse)
      if (center) {
        const posEl = document.createElement("div");
        posEl.style.cssText =
          "position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px";
        posEl.innerHTML = `
          <div style="width:16px;height:16px;background:#4ADE80;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(74,222,128,0.6);z-index:2;position:absolute"></div>
          <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(74,222,128,0.2);animation:pulse 2s infinite"></div>
        `;
        posMarkerRef.current = new mapboxgl.Marker({ element: posEl, anchor: "center" })
          .setLngLat([center.lng, center.lat])
          .addTo(map);
      }

      // 스팟(POI) 마커
      markers.forEach((m) => {
        const el = document.createElement("div");
        if (m.emoji) {
          el.style.cssText = `width:36px;height:36px;background:${
            isDark ? "rgba(30,30,30,0.9)" : "white"
          };border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px ${
            isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)"
          };border:2px solid ${
            isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)"
          };font-size:18px;backdrop-filter:blur(8px);cursor:pointer`;
          el.innerHTML = `<span>${m.emoji}</span>`;
        } else {
          el.style.cssText = `width:12px;height:12px;background:${
            isDark ? "#A8E6CF" : "#2D4A2E"
          };border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.2);cursor:pointer`;
        }

        const popupHtml = `<div style="font-family:'Pretendard Variable',sans-serif;font-size:13px;font-weight:600;padding:2px 4px;color:${
          isDark ? "#fff" : "#191F28"
        }">${m.title}</div>`;
        const popup = new mapboxgl.Popup({
          closeButton: false,
          offset: [0, m.emoji ? -20 : -8],
          className: isDark ? "mapbox-popup-dark" : "mapbox-popup-clean",
        }).setHTML(popupHtml);
        popupsRef.current.push(popup);

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([m.lng, m.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onMarkerClick) onMarkerClick(m.id);
        });

        markersRef.current.push(marker);
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pathCoordinates?.length, markers.length, center?.lat, center?.lng, theme]);

  const toggle3D = useCallback(() => {
    setTerrain3DState((v) => !v);
  }, []);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: isDark ? "#1a1a2e" : "#f0f4f0" }}
    >
      <div ref={mapRef} className="w-full h-full" />

      {/* 3D 토글 버튼 */}
      {showTerrainToggle && loaded && (
        <button
          type="button"
          onClick={toggle3D}
          className="absolute top-3 right-3 z-[1000] select-none"
          style={{
            padding: "6px 12px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            background: terrain3DState
              ? isDark
                ? "rgba(168,230,207,0.95)"
                : "rgba(45,74,46,0.95)"
              : isDark
                ? "rgba(30,30,30,0.85)"
                : "rgba(255,255,255,0.95)",
            color: terrain3DState ? (isDark ? "#0a1a10" : "#fff") : isDark ? "#fff" : "#191F28",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
          aria-pressed={terrain3DState}
          aria-label="3D 지형 토글"
        >
          {terrain3DState ? "3D" : "2D"}
        </button>
      )}

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  background: isDark ? "#4ADE80" : "#2D4A2E",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>

      {showStats && (distance || duration) && (
        <div className="absolute bottom-4 left-4 z-[1000] flex items-end gap-3">
          {distance && (
            <div className="bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 text-white border border-white/10">
              <div className="text-[24px] font-bold font-en leading-none tracking-tight">
                {parseFloat(distance).toFixed(1)}
              </div>
              <div className="text-[11px] text-white/50 mt-0.5 uppercase tracking-wider">
                km
              </div>
            </div>
          )}
          {duration && (
            <div className="bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 text-white border border-white/10">
              <div className="text-[24px] font-bold font-en leading-none tracking-tight">
                {Number(duration) >= 60
                  ? `${Math.floor(Number(duration) / 60)}:${String(Number(duration) % 60).padStart(2, "0")}`
                  : duration}
              </div>
              <div className="text-[11px] text-white/50 mt-0.5 uppercase tracking-wider">
                {Number(duration) >= 60 ? "hr" : "min"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
