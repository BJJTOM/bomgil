"use client";

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
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [loading, setLoading] = useState(false);
  const [routingEnabled, setRoutingEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Notify parent on change
  useEffect(() => {
    onChange?.({ waypoints, routeCoords, distanceKm, durationMin });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, routeCoords, distanceKm, durationMin]);

  // Init Mapbox map
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

        map.on("click", (e: any) => {
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          setWaypoints((prev) => [...prev, [lng, lat]]);
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
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan to initialCenter when it changes (after first load)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !initialCenter) return;
    map.easeTo({
      center: [initialCenter.lng, initialCenter.lat],
      duration: 500,
    });
  }, [initialCenter?.lat, initialCenter?.lng]);

  // Compute haversine distance for fallback
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

  // Fetch route from OSRM whenever waypoints change
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
        // Fallback: straight lines
        let total = 0;
        for (let i = 1; i < waypoints.length; i++) {
          total += haversineKm(waypoints[i - 1], waypoints[i]);
        }
        setRouteCoords([...waypoints]);
        setDistanceKm(total);
        setDurationMin(Math.round((total / 4.5) * 60)); // 4.5 km/h walking
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
    return () => {
      cancelled = true;
    };
  }, [waypoints, routingEnabled]);

  // Render waypoint markers
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
      el.style.cssText = `width:26px;height:26px;background:${bg};color:white;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700`;
      el.textContent = label;

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat(wp as [number, number])
        .addTo(map);
      waypointMarkersRef.current.push(marker);
    });
  }, [waypoints, loaded]);

  // Render route line
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old route line
    if (map.getLayer("draw-route")) map.removeLayer("draw-route");
    if (map.getSource("draw-route-source")) map.removeSource("draw-route-source");

    if (routeCoords.length >= 2) {
      map.addSource("draw-route-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: routeCoords,
          },
        },
      });

      map.addLayer({
        id: "draw-route",
        type: "line",
        source: "draw-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#2D4A2E",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });
    }
  }, [routeCoords, loaded]);

  const undo = useCallback(() => {
    setWaypoints((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    if (waypoints.length === 0) return;
    if (window.confirm("모든 경유지를 삭제할까요?")) {
      setWaypoints([]);
    }
  }, [waypoints.length]);

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
            <div className="text-[11px] text-white/60 uppercase tracking-wider">
              거리
            </div>
            <div className="text-[15px] font-bold leading-tight">
              {distanceKm < 1
                ? `${Math.round(distanceKm * 1000)}m`
                : `${distanceKm.toFixed(2)}km`}
            </div>
          </div>
          <div className="w-px h-7 bg-white/20" />
          <div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider">
              시간
            </div>
            <div className="text-[15px] font-bold leading-tight">
              {durationMin >= 60
                ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                : `${durationMin}분`}
            </div>
          </div>
          <div className="w-px h-7 bg-white/20" />
          <div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider">
              지점
            </div>
            <div className="text-[15px] font-bold leading-tight">
              {waypoints.length}
            </div>
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
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            className="bg-white/95 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-white"
            title="내 위치"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2D4A2E"
              strokeWidth="2"
            >
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
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2D4A2E"
              strokeWidth="2"
            >
              <path d="M3 3h6M3 3v6M21 3h-6M21 3v6M3 21h6M3 21v-6M21 21h-6M21 21v-6" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={waypoints.length === 0}
            className="bg-white/95 backdrop-blur-md rounded-full px-4 h-10 flex items-center gap-1.5 shadow-md hover:bg-white disabled:opacity-40 text-[13px] font-semibold text-gray-800"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M3 7v6h6M21 17a9 9 0 00-15-6.7L3 13" />
            </svg>
            실행취소
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

      {waypoints.length === 0 && loaded && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[999] pointer-events-none">
          <div className="bg-black/70 backdrop-blur-md text-white text-[12px] px-4 py-2 rounded-full">
            지도를 탭하여 경유지를 추가하세요
          </div>
        </div>
      )}
    </div>
  );
}
