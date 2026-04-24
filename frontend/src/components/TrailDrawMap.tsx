"use client";

/**
 * TrailDrawMap — 코스 등록용 지도 편집기 (Komoot 플래너 스타일)
 *
 * 지원 인터랙션:
 *  - 지도 클릭 → 끝에 경유지 추가
 *  - 라인 클릭 → 클릭한 세그먼트 중간에 경유지 삽입 (Komoot 의 파란선 편집)
 *  - 마커 클릭 → 해당 경유지 삭제 (팝오버 확인 없음, 실수해도 redo 로 복구)
 *  - 실행취소/다시실행 스택 (상한 50)
 *  - 방향 반전 (reverse)
 *  - 경로 보정 토글 (OSRM foot profile)
 *
 * 모든 편집은 `waypoints` 상태 한 곳을 업데이트 → 렌더링은 상태 변화에 따라 자동.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

interface TrailDrawMapProps {
  initialCenter?: { lat: number; lng: number };
  zoom?: number;
  onChange?: (data: {
    waypoints: [number, number][]; // [lng, lat]
    routeCoords: [number, number][]; // [lng, lat]
    distanceKm: number;
    durationMin: number;
  }) => void;
  className?: string;
}

const FALLBACK_CENTER = { lat: 37.5665, lng: 126.978 };
const UNDO_LIMIT = 50;

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

export function TrailDrawMap({
  initialCenter,
  zoom = 14,
  onChange,
  className = "w-full h-full",
}: TrailDrawMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);
  const waypointMarkersRef = useRef<any[]>([]);
  const initializedRef = useRef(false);

  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  // undo / redo 이력 — 각 스택은 과거 waypoints 배열의 스냅샷
  const [undoStack, setUndoStack] = useState<[number, number][][]>([]);
  const [redoStack, setRedoStack] = useState<[number, number][][]>([]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [loading, setLoading] = useState(false);
  const [routingEnabled, setRoutingEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // 편집 전 상태를 undo 에 push, redo 비우기. 모든 편집이 이것을 통과.
  const pushHistory = useCallback(
    (prev: [number, number][], next: [number, number][]) => {
      setUndoStack((s) => {
        const pushed = [...s, prev];
        return pushed.length > UNDO_LIMIT ? pushed.slice(-UNDO_LIMIT) : pushed;
      });
      setRedoStack([]);
      setWaypoints(next);
    },
    []
  );

  // Notify parent on change
  useEffect(() => {
    onChange?.({ waypoints, routeCoords, distanceKm, durationMin });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, routeCoords, distanceKm, durationMin]);

  // ── 가장 가까운 라인 세그먼트 찾기 (라인 클릭 후 삽입 위치 결정) ──
  // 투영 공간 거리로 충분 (정밀한 geodesic 불필요).
  // 반환: waypoints 배열에 삽입해야 할 인덱스 i (새 점이 i-1 번 세그먼트에
  // 들어간다 = new waypoints = [...wp.slice(0,i), click, ...wp.slice(i)])
  const findInsertIndex = useCallback(
    (click: [number, number], wps: [number, number][]) => {
      if (wps.length < 2) return wps.length;
      let bestI = wps.length; // 기본은 맨 끝
      let bestDist = Infinity;
      for (let i = 0; i < wps.length - 1; i++) {
        const d = pointToSegmentDist(click, wps[i], wps[i + 1]);
        if (d < bestDist) {
          bestDist = d;
          bestI = i + 1;
        }
      }
      return bestI;
    },
    []
  );

  // ── Mapbox 초기화 (1회) ───────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled) return;

        mapboxglRef.current = mapboxgl;
        (mapboxgl as any).accessToken = MAPBOX_TOKEN;

        const center = initialCenter || FALLBACK_CENTER;
        const map = new mapboxgl.Map({
          container: mapRef.current!,
          style: "mapbox://styles/mapbox/outdoors-v12",
          center: [center.lng, center.lat],
          zoom,
          attributionControl: false,
        });

        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "bottom-right"
        );

        // 전역 클릭: 끝에 추가. 라인 위 클릭은 `draw-route-hitbox` 핸들러가 선처리.
        map.on("click", (e: any) => {
          // 라인 hitbox 핸들러가 이미 처리했으면 여기 도달 안 함 (e._handled 체크)
          if ((e as any)._handled) return;
          const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          setWaypoints((prev) => {
            const next = [...prev, coord];
            setUndoStack((s) => {
              const pushed = [...s, prev];
              return pushed.length > UNDO_LIMIT ? pushed.slice(-UNDO_LIMIT) : pushed;
            });
            setRedoStack([]);
            return next;
          });
        });

        map.on("load", () => {
          mapInstanceRef.current = map;
          setLoaded(true);
        });
      } catch (err) {
        console.error("TrailDrawMap init error:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch {}
        mapInstanceRef.current = null;
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── initialCenter 변경 시 팬 ───────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !initialCenter) return;
    map.easeTo({ center: [initialCenter.lng, initialCenter.lat], duration: 500 });
  }, [initialCenter?.lat, initialCenter?.lng]);

  // ── 거리 계산 helper ──────────────────────────────────────
  const haversineKm = (a: [number, number], b: [number, number]) => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const la1 = toRad(a[1]);
    const la2 = toRad(b[1]);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  // ── OSRM 라우팅: waypoints 변경 시 경로 재계산 ──────────
  useEffect(() => {
    if (waypoints.length < 2) {
      setRouteCoords([]);
      setDistanceKm(0);
      setDurationMin(0);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        if (routingEnabled) {
          const coordStr = waypoints.map((p) => `${p[0]},${p[1]}`).join(";");
          const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordStr}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("OSRM failed");
          const data = await res.json();
          if (cancelled) return;
          if (data.routes?.[0]) {
            setRouteCoords(data.routes[0].geometry.coordinates);
            setDistanceKm(data.routes[0].distance / 1000);
            setDurationMin(Math.round(data.routes[0].duration / 60));
            return;
          }
        }
        let total = 0;
        for (let i = 1; i < waypoints.length; i++) {
          total += haversineKm(waypoints[i - 1], waypoints[i]);
        }
        setRouteCoords([...waypoints]);
        setDistanceKm(total);
        setDurationMin(Math.round((total / 4.5) * 60));
      } catch {
        if (cancelled) return;
        let total = 0;
        for (let i = 1; i < waypoints.length; i++) {
          total += haversineKm(waypoints[i - 1], waypoints[i]);
        }
        setRouteCoords([...waypoints]);
        setDistanceKm(total);
        setDurationMin(Math.round((total / 4.5) * 60));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [waypoints, routingEnabled]);

  // ── 마커 렌더 + 마커 클릭으로 개별 삭제 ────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl) return;

    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];

    waypoints.forEach((wp, i) => {
      const isStart = i === 0;
      const isEnd = i === waypoints.length - 1 && waypoints.length > 1;
      const bg = isStart ? "#34C759" : isEnd ? "#FF3B30" : "#2D4A2E";
      const label = isStart ? "S" : isEnd ? "E" : String(i + 1);

      const el = document.createElement("div");
      el.style.cssText =
        `width:28px;height:28px;background:${bg};color:white;border-radius:50%;` +
        `border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;` +
        `align-items:center;justify-content:center;font-size:11px;font-weight:700;` +
        `cursor:pointer;transition:transform .1s`;
      el.textContent = label;
      el.title = `클릭하면 이 지점(${label}) 삭제`;

      // 마커 클릭: 해당 경유지 제거 (undo/redo 스택에 기록)
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setWaypoints((prev) => {
          if (i >= prev.length) return prev;
          const next = prev.filter((_, idx) => idx !== i);
          setUndoStack((s) => {
            const pushed = [...s, prev];
            return pushed.length > UNDO_LIMIT ? pushed.slice(-UNDO_LIMIT) : pushed;
          });
          setRedoStack([]);
          return next;
        });
      });
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.12)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(wp as [number, number])
        .addTo(map);
      waypointMarkersRef.current.push(marker);
    });
  }, [waypoints, loaded]);

  // ── 경로 라인 + 라인 클릭 hitbox (중간 삽입) ──────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 기존 라인 제거
    for (const id of ["draw-route-hitbox", "draw-route", "draw-route-casing"]) {
      if (map.getLayer(id)) { try { map.removeLayer(id); } catch {} }
    }
    if (map.getSource("draw-route-source")) {
      try { map.removeSource("draw-route-source"); } catch {}
    }

    if (routeCoords.length >= 2) {
      map.addSource("draw-route-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: routeCoords },
        },
      });

      // 흰 외곽선
      map.addLayer({
        id: "draw-route-casing",
        type: "line",
        source: "draw-route-source",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 9,
          "line-opacity": 0.85,
        },
      });
      // 메인 라인
      map.addLayer({
        id: "draw-route",
        type: "line",
        source: "draw-route-source",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#2D4A2E",
          "line-width": 5,
          "line-opacity": 0.92,
        },
      });
      // 투명 hitbox — 굵게 해서 터치 hit rate 높임
      map.addLayer({
        id: "draw-route-hitbox",
        type: "line",
        source: "draw-route-source",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#000",
          "line-opacity": 0.001,
          "line-width": 22,
        },
      });

      // 라인 위 클릭 → 가장 가까운 waypoint 세그먼트에 삽입
      const onLineClick = (e: any) => {
        // 전역 클릭 핸들러가 또 동작하지 않도록 마킹
        (e as any)._handled = true;
        e.preventDefault?.();
        const click: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setWaypoints((prev) => {
          const insertAt = findInsertIndex(click, prev);
          const next = [...prev.slice(0, insertAt), click, ...prev.slice(insertAt)];
          setUndoStack((s) => {
            const pushed = [...s, prev];
            return pushed.length > UNDO_LIMIT ? pushed.slice(-UNDO_LIMIT) : pushed;
          });
          setRedoStack([]);
          return next;
        });
      };
      map.on("click", "draw-route-hitbox", onLineClick);
      // 커서 힌트
      map.on("mouseenter", "draw-route-hitbox", () => {
        map.getCanvas().style.cursor = "copy";
      });
      map.on("mouseleave", "draw-route-hitbox", () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }, [routeCoords, loaded, findInsertIndex]);

  // ── 버튼 핸들러 ───────────────────────────────────────────
  const undo = useCallback(() => {
    setUndoStack((s) => {
      if (s.length === 0) return s;
      const prevState = s[s.length - 1];
      setRedoStack((r) => [...r, waypoints]);
      setWaypoints(prevState);
      return s.slice(0, -1);
    });
  }, [waypoints]);

  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const nextState = r[r.length - 1];
      setUndoStack((s) => [...s, waypoints]);
      setWaypoints(nextState);
      return r.slice(0, -1);
    });
  }, [waypoints]);

  const reverse = useCallback(() => {
    setWaypoints((prev) => {
      if (prev.length < 2) return prev;
      const next = [...prev].reverse();
      setUndoStack((s) => {
        const pushed = [...s, prev];
        return pushed.length > UNDO_LIMIT ? pushed.slice(-UNDO_LIMIT) : pushed;
      });
      setRedoStack([]);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    if (waypoints.length === 0) return;
    if (window.confirm("모든 경유지를 삭제할까요?")) {
      setUndoStack((s) => [...s, waypoints]);
      setRedoStack([]);
      setWaypoints([]);
    }
  }, [waypoints]);

  const fitToRoute = useCallback(() => {
    const map = mapInstanceRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl || waypoints.length < 2) return;
    const bounds = new mapboxgl.LngLatBounds();
    waypoints.forEach((wp) => bounds.extend(wp as [number, number]));
    map.fitBounds(bounds, { padding: 40, duration: 500 });
  }, [waypoints]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapInstanceRef.current;
        if (map) {
          map.easeTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 16,
            duration: 500,
          });
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: "#f0f4f0" }}
    >
      <div ref={mapRef} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#2D4A2E] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top stats bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between gap-2">
        <div className="bg-black/75 backdrop-blur-md rounded-2xl px-3.5 py-2 text-white flex items-center gap-3">
          <div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider">거리</div>
            <div className="text-[15px] font-bold leading-tight">
              {distanceKm < 1
                ? `${Math.round(distanceKm * 1000)}m`
                : `${distanceKm.toFixed(2)}km`}
            </div>
          </div>
          <div className="w-px h-7 bg-white/20" />
          <div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider">시간</div>
            <div className="text-[15px] font-bold leading-tight">
              {durationMin >= 60
                ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                : `${durationMin}분`}
            </div>
          </div>
          <div className="w-px h-7 bg-white/20" />
          <div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider">지점</div>
            <div className="text-[15px] font-bold leading-tight">{waypoints.length}</div>
          </div>
          {loading && (
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin ml-1" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setRoutingEnabled((v) => !v)}
          className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold backdrop-blur-md ${
            routingEnabled
              ? "bg-emerald-600/90 text-white"
              : "bg-white/85 text-gray-700 border border-gray-200"
          }`}
          title="경로 보정 켜기/끄기"
        >
          {routingEnabled ? "보정 ON" : "보정 OFF"}
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            className="bg-white/95 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-white"
            title="내 위치"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="#2D4A2E" />
            </svg>
          </button>
          <button
            type="button"
            onClick={fitToRoute}
            disabled={waypoints.length < 2}
            className="bg-white/95 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-white disabled:opacity-40"
            title="경로에 맞추기"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D4A2E" strokeWidth="2">
              <path d="M3 3h6M3 3v6M21 3h-6M21 3v6M3 21h6M3 21v-6M21 21h-6M21 21v-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={reverse}
            disabled={waypoints.length < 2}
            className="bg-white/95 backdrop-blur-md rounded-full px-3 h-10 flex items-center gap-1 shadow-md hover:bg-white disabled:opacity-40 text-[12px] font-semibold text-gray-800"
            title="출발/도착 방향 반전"
          >
            ⇄ 방향 반전
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="bg-white/95 backdrop-blur-md rounded-full px-3.5 h-10 flex items-center gap-1.5 shadow-md hover:bg-white disabled:opacity-40 text-[13px] font-semibold text-gray-800"
            title={`실행취소${canUndo ? ` (${undoStack.length})` : ""}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 7v6h6M21 17a9 9 0 00-15-6.7L3 13" />
            </svg>
            되돌리기
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="bg-white/95 backdrop-blur-md rounded-full px-3.5 h-10 flex items-center gap-1.5 shadow-md hover:bg-white disabled:opacity-40 text-[13px] font-semibold text-gray-800"
            title={`다시실행${canRedo ? ` (${redoStack.length})` : ""}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 7v6h-6M3 17a9 9 0 0115-6.7L21 13" />
            </svg>
            다시실행
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={waypoints.length === 0}
            className="bg-white/95 backdrop-blur-md rounded-full px-4 h-10 flex items-center gap-1.5 shadow-md hover:bg-white disabled:opacity-40 text-[13px] font-semibold text-red-600"
          >
            전체 삭제
          </button>
        </div>
      </div>

      {/* 빈 상태 힌트 */}
      {waypoints.length === 0 && loaded && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[999] pointer-events-none">
          <div className="bg-black/75 backdrop-blur-md text-white text-[12px] px-4 py-2 rounded-full leading-snug text-center">
            지도를 탭하여 출발지를 추가하세요
            <br />
            <span className="text-white/60 text-[11px]">
              라인을 탭하면 중간에 경유지가 삽입돼요
            </span>
          </div>
        </div>
      )}

      {/* 조작 힌트 — 경유지가 1개 이상일 때 */}
      {waypoints.length > 0 && loaded && (
        <div className="absolute top-[74px] left-3 z-[999] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md text-gray-700 text-[11px] px-2.5 py-1.5 rounded-full shadow-sm border border-gray-200">
            {waypoints.length === 1
              ? "다음 지점을 탭하세요"
              : "라인 탭=중간 삽입 · 마커 탭=삭제"}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Utility: 점과 세그먼트 사이 거리 (투영 공간)
// ────────────────────────────────────────────────────────────
// 위경도 그대로 사용해도 좁은 범위에선 왜곡 영향 無. Komoot "가장 가까운
// 세그먼트" 판정 용도로 충분.
function pointToSegmentDist(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ddx = px - ax;
    const ddy = py - ay;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ddx = px - projX;
  const ddy = py - projY;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}
