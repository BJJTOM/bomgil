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
  /** 줌/내비 컨트롤 표시 (기본 false — fullscreen 모드에서만 true). */
  showNavigationControl?: boolean;
  /** 스크롤 줌 활성화 (기본 false — fullscreen 모드에서만 true). */
  enableScrollZoom?: boolean;
  /** 맵 인스턴스가 준비되면 호출되는 콜백. 외부에서 map 을 제어할 수 있음. */
  onMapReady?: (map: any) => void;
  /** 원본 좌표 (고도 포함 [lng, lat, ele]). 트레일 클릭 고도 팝업에 사용. */
  rawCoordinates?: number[][];
  /** 총 거리 표시 문자열 (도착 마커 뱃지용, 예: "13.2km") */
  totalDistance?: string;
  /** 총 소요시간 분 단위 (도착 마커 뱃지용) */
  totalDuration?: number;
  /** POI(스팟) 마커 표시 여부 (기본 true). false 면 마커 렌더링 스킵. */
  showPOIMarkers?: boolean;
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
  showNavigationControl = false,
  enableScrollZoom = false,
  onMapReady,
  rawCoordinates,
  totalDistance,
  totalDuration,
  showPOIMarkers = true,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const posMarkerRef = useRef<any>(null);
  const elevPopupRef = useRef<any>(null);
  const elevMarkerRef = useRef<any>(null);
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
          dragRotate: false,
          touchZoomRotate: true, // zoom 허용, rotation 은 아래에서 비활성
          scrollZoom: enableScrollZoom, // 인라인 맵에선 false, fullscreen 에서만 true
          // 무료 티어 보호 — 전 세계 줌 범위는 그대로 두되 로우레벨 조작 최소화
        });

        // touchZoomRotate 는 pinch zoom + rotation 둘 다 포함. zoom 만 남기고 rotation 비활성.
        map.touchZoomRotate.disableRotation();

        // NavigationControl 은 fullscreen 모드에서만 표시
        if (showNavigationControl) {
          map.addControl(
            new mapboxgl.NavigationControl({ showCompass: false }),
            "bottom-right"
          );
        }
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
          if (onMapReady) onMapReady(map);
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

        // ── Feature 1: 트레일 라인 클릭 시 고도 팝업 ──
        if (elevPopupRef.current) { try { elevPopupRef.current.remove(); } catch {} elevPopupRef.current = null; }
        if (elevMarkerRef.current) { try { elevMarkerRef.current.remove(); } catch {} elevMarkerRef.current = null; }

        const rawCoordsForClick = rawCoordinates && rawCoordinates.length === pathCoordinates.length
          ? rawCoordinates
          : pathCoordinates.map(c => [c[0], c[1]]);

        const R_EARTH = 6371;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const haversine = (a: number[], b: number[]) => {
          const dLat = toRad(b[1] - a[1]);
          const dLng = toRad(b[0] - a[0]);
          const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
          return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
        };

        const cumDist: number[] = [0];
        for (let i = 1; i < pathCoordinates.length; i++) {
          cumDist.push(cumDist[i - 1] + haversine(pathCoordinates[i - 1], pathCoordinates[i]));
        }
        const totalPathDist = cumDist[cumDist.length - 1];

        const trailClickHandler = (e: any) => {
          const clickLng = e.lngLat.lng;
          const clickLat = e.lngLat.lat;
          let minD = Infinity;
          let nearestIdx = 0;
          for (let i = 0; i < pathCoordinates.length; i++) {
            const dx = pathCoordinates[i][0] - clickLng;
            const dy = pathCoordinates[i][1] - clickLat;
            const d = dx * dx + dy * dy;
            if (d < minD) { minD = d; nearestIdx = i; }
          }

          const coord = pathCoordinates[nearestIdx];
          const rawCoord = rawCoordsForClick[nearestIdx];
          const elevation = rawCoord.length >= 3 ? Math.round(rawCoord[2]) : null;
          const distFromStart = cumDist[nearestIdx];
          const pctOfTotal = totalPathDist > 0 ? Math.round((distFromStart / totalPathDist) * 100) : 0;

          let grade = "";
          if (rawCoord.length >= 3 && nearestIdx > 0) {
            const prevRaw = rawCoordsForClick[nearestIdx - 1];
            if (prevRaw.length >= 3) {
              const segDist = haversine(pathCoordinates[nearestIdx - 1], pathCoordinates[nearestIdx]) * 1000;
              if (segDist > 0) {
                const elevDiff = rawCoord[2] - prevRaw[2];
                const gradeVal = (elevDiff / segDist) * 100;
                grade = `${gradeVal >= 0 ? "+" : ""}${gradeVal.toFixed(1)}%`;
              }
            }
          }

          const elevText = elevation != null ? `고도 ${elevation}m` : "";
          const distText = `출발점에서 ${distFromStart.toFixed(1)}km \u00B7 전체의 ${pctOfTotal}%`;
          const popupContent = `<div style="font-family:'Pretendard Variable',system-ui,sans-serif;padding:4px 2px;">
            ${elevText ? `<div style="font-size:14px;font-weight:700;color:white;line-height:1.3">${elevText}${grade ? ` <span style="font-size:11px;font-weight:500;opacity:0.7">${grade}</span>` : ""}</div>` : ""}
            <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px;line-height:1.3">${distText}</div>
          </div>`;

          if (elevPopupRef.current) { try { elevPopupRef.current.remove(); } catch {} }
          if (elevMarkerRef.current) { try { elevMarkerRef.current.remove(); } catch {} }

          const dotEl = document.createElement("div");
          dotEl.style.cssText = "width:10px;height:10px;background:#FF3B30;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);pointer-events:none";
          elevMarkerRef.current = new mapboxgl.Marker({ element: dotEl, anchor: "center" })
            .setLngLat(coord)
            .addTo(map);

          elevPopupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: true,
            offset: 12,
            className: "moru-elev-popup",
            maxWidth: "220px",
          })
            .setLngLat(coord)
            .setHTML(popupContent)
            .addTo(map);

          elevPopupRef.current.on("close", () => {
            if (elevMarkerRef.current) { try { elevMarkerRef.current.remove(); } catch {} elevMarkerRef.current = null; }
          });
        };

        if (map.getLayer("moru-trail-main")) {
          map.on("click", "moru-trail-main", trailClickHandler);
          map.on("mouseenter", "moru-trail-main", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "moru-trail-main", () => { map.getCanvas().style.cursor = ""; });
        }

        map.on("click", (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: map.getLayer("moru-trail-main") ? ["moru-trail-main"] : [] });
          if (!features || features.length === 0) {
            if (elevPopupRef.current) { try { elevPopupRef.current.remove(); } catch {} elevPopupRef.current = null; }
            if (elevMarkerRef.current) { try { elevMarkerRef.current.remove(); } catch {} elevMarkerRef.current = null; }
          }
        });

        // 시작/종료 마커 (라벨 + pulse 애니메이션 포함)
        if (pathCoordinates.length > 1) {
          // ── Start marker ──
          const startEl = document.createElement("div");
          startEl.style.cssText =
            "position:relative;display:flex;flex-direction:column;align-items:center;z-index:10;pointer-events:none";
          startEl.innerHTML = `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px">
              <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(52,199,89,0.25);animation:moru-pulse 2s ease-out infinite"></div>
              <div style="width:20px;height:20px;background:#34C759;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(52,199,89,0.5);display:flex;align-items:center;justify-content:center;z-index:2">
                <span style="color:white;font-size:10px;font-weight:800;line-height:1">S</span>
              </div>
            </div>
            <div style="margin-top:2px;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;white-space:nowrap;letter-spacing:0.02em">출발</div>
          `;
          const startMarker = new mapboxgl.Marker({ element: startEl, anchor: "center" })
            .setLngLat(pathCoordinates[0] as [number, number])
            .addTo(map);
          markersRef.current.push(startMarker);

          // ── End marker (Feature 3: 총 거리/시간 뱃지 포함) ──
          const endEl = document.createElement("div");
          endEl.style.cssText =
            "position:relative;display:flex;flex-direction:column;align-items:center;z-index:10;pointer-events:none";

          let endBadgeHtml = "";
          if (totalDistance || totalDuration) {
            const distPart = totalDistance || "";
            let durPart = "";
            if (totalDuration != null) {
              const h = Math.floor(totalDuration / 60);
              const mn = totalDuration % 60;
              durPart = h > 0 ? `${h}h${mn > 0 ? String(mn).padStart(2, "0") + "m" : ""}` : `${mn}m`;
            }
            const badgeParts = [distPart, durPart].filter(Boolean).join(" \u00B7 ");
            if (badgeParts) {
              endBadgeHtml = `<div style="margin-top:1px;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);color:white;font-size:9px;font-weight:600;padding:1px 8px;border-radius:6px;white-space:nowrap;letter-spacing:0.02em">${badgeParts}</div>`;
            }
          }

          endEl.innerHTML = `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px">
              <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(255,59,48,0.25);animation:moru-pulse 2s ease-out infinite 0.5s"></div>
              <div style="width:20px;height:20px;background:#FF3B30;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(255,59,48,0.5);display:flex;align-items:center;justify-content:center;z-index:2">
                <span style="color:white;font-size:10px;font-weight:800;line-height:1">E</span>
              </div>
            </div>
            <div style="margin-top:2px;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;white-space:nowrap;letter-spacing:0.02em">도착</div>
            ${endBadgeHtml}
          `;
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

      // 스팟(POI) 마커 — Feature 2: 번호 매긴 원형 마커 (줌 >= 13 시 번호 표시)
      // showPOIMarkers === false 이면 마커 렌더링 스킵
      if (!showPOIMarkers) return;
      const currentZoom = map.getZoom();
      markers.forEach((m, idx) => {
        // Wrapper는 **항상 24×24 고정**. 내부 dot 크기가 줌에 따라
        // 바뀌어도 Mapbox가 앵커로 계산하는 박스가 그대로라 좌표가
        // 드리프트하지 않는다. 이름 라벨도 absolute라 박스에 영향 없음.
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:relative;width:24px;height:24px;cursor:pointer;pointer-events:auto";

        // 번호 표시 여부: 줌 13 이상
        const showNumber = currentZoom >= 13;
        const spotNum = idx + 1;
        const isFirst = idx === 0;
        const isLast = idx === markers.length - 1;
        const bgColor = isFirst ? "#34C759" : isLast ? "#FF3B30" : (isDark ? "#A8E6CF" : "#2D4A2E");
        const textColor = (isFirst || isLast) ? "white" : (isDark ? "#0a1a10" : "white");
        const dotSize = showNumber ? 16 : 12;

        const el = document.createElement("div");
        el.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${dotSize}px;height:${dotSize}px;background:${bgColor};border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.2);transition:width 0.15s ease,height 0.15s ease;display:flex;align-items:center;justify-content:center`;
        if (showNumber) {
          el.innerHTML = `<span style="color:${textColor};font-size:9px;font-weight:700;line-height:1;pointer-events:none">${spotNum}</span>`;
        }

        // 줌 변경 시 번호 표시/숨김 업데이트 (size 변화는 absolute
        // 트랜스폼으로 중앙 고정되므로 wrapper 박스·지리 좌표에 영향 없음)
        const zoomHandler = () => {
          const z = map.getZoom();
          if (z >= 13) {
            el.style.width = "16px";
            el.style.height = "16px";
            el.innerHTML = `<span style="color:${textColor};font-size:9px;font-weight:700;line-height:1;pointer-events:none">${spotNum}</span>`;
          } else {
            el.style.width = "12px";
            el.style.height = "12px";
            el.innerHTML = "";
          }
        };
        map.on("zoom", zoomHandler);

        // Hover name label (appears on hover, not popup).
        // bottom:100% + marginBottom 로 dot 기준 위쪽에 고정 배치.
        // wrapper 가 24×24 고정이므로 어떤 줌이든 동일한 위치.
        const nameLabel = document.createElement("div");
        nameLabel.style.cssText = `
          position:absolute;bottom:100%;left:50%;transform:translateX(-50%);
          margin-bottom:4px;white-space:nowrap;
          background:${isDark ? "rgba(20,20,20,0.9)" : "rgba(255,255,255,0.95)"};
          color:${isDark ? "#fff" : "#191F28"};
          font-family:'Pretendard Variable',system-ui,sans-serif;
          font-size:11px;font-weight:600;
          padding:3px 8px;border-radius:8px;
          box-shadow:0 2px 8px rgba(0,0,0,${isDark ? "0.4" : "0.12"});
          border:1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"};
          backdrop-filter:blur(6px);
          pointer-events:none;opacity:0;transition:opacity 0.15s ease;
          z-index:20;
        `;
        nameLabel.textContent = m.title;

        wrapper.appendChild(nameLabel);
        wrapper.appendChild(el);

        wrapper.addEventListener("mouseenter", () => {
          nameLabel.style.opacity = "1";
          el.style.transform = "scale(1.12)";
        });
        wrapper.addEventListener("mouseleave", () => {
          nameLabel.style.opacity = "0";
          el.style.transform = "scale(1)";
        });

        const popupHtml = `<div style="font-family:'Pretendard Variable',sans-serif;font-size:13px;font-weight:600;padding:2px 4px;color:${
          isDark ? "#fff" : "#191F28"
        }">${m.title}</div>`;
        const popup = new mapboxgl.Popup({
          closeButton: false,
          offset: [0, m.emoji ? -24 : -12],
          className: isDark ? "mapbox-popup-dark" : "mapbox-popup-clean",
        }).setHTML(popupHtml);
        popupsRef.current.push(popup);

        const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
          .setLngLat([m.lng, m.lat])
          .setPopup(popup)
          .addTo(map);

        wrapper.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onMarkerClick) onMarkerClick(m.id);
        });

        markersRef.current.push(marker);
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pathCoordinates?.length, markers.length, center?.lat, center?.lng, theme, showPOIMarkers, rawCoordinates?.length, totalDistance, totalDuration]);

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
        @keyframes moru-pulse {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          70% {
            transform: scale(1.8);
            opacity: 0;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
        /* Feature 1: 고도 클릭 팝업 스타일 */
        .moru-elev-popup .mapboxgl-popup-content {
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(8px);
          border-radius: 10px;
          padding: 8px 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .moru-elev-popup .mapboxgl-popup-tip {
          border-top-color: rgba(0, 0, 0, 0.78);
        }
        .moru-elev-popup .mapboxgl-popup-close-button {
          display: none;
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
