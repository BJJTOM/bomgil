"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

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
}

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

const MAP_STYLES = {
  light: "mapbox://styles/mapbox/outdoors-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
};

export function MapView({
  country = "KR",
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
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const posMarkerRef = useRef<any>(null);
  const popupsRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const initializedRef = useRef(false);

  const isDark = theme === "dark";

  // Initialize map once
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
          style: MAP_STYLES[theme],
          center: [defaultCenter.lng, defaultCenter.lat],
          zoom,
          attributionControl: false,
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
          setLoaded(true);
        });
      } catch (err) {
        console.error("Map load error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${isDark ? "#1a1a2e" : "#f0f9f4"};border-radius:16px;">
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
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [theme]);

  // Update center
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !center) return;
    map.easeTo({ center: [center.lng, center.lat], duration: 500 });
  }, [center?.lat, center?.lng]);

  // Update path + markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let mapboxgl: any;
    (async () => {
      mapboxgl = (await import("mapbox-gl")).default;

      // ----- Clear old markers -----
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];

      if (posMarkerRef.current) {
        posMarkerRef.current.remove();
        posMarkerRef.current = null;
      }

      // ----- Draw path -----
      // Remove old path layers and source
      ["path-glow", "path-border", "path-main"].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource("path-source")) map.removeSource("path-source");
      // Remove old start marker layer/source
      if (map.getLayer("start-marker-layer")) map.removeLayer("start-marker-layer");
      if (map.getSource("start-marker")) map.removeSource("start-marker");

      if (pathCoordinates && pathCoordinates.length > 0) {
        // pathCoordinates are [lng, lat] already
        const coords = pathCoordinates;

        map.addSource("path-source", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: coords,
            },
          },
        });

        // Glow layer
        map.addLayer({
          id: "path-glow",
          type: "line",
          source: "path-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": isDark ? "#A8E6CF" : "#2D4A2E",
            "line-width": 10,
            "line-opacity": isDark ? 0.2 : 0.12,
          },
        });

        // Border layer (dark mode extra glow)
        if (isDark) {
          map.addLayer({
            id: "path-border",
            type: "line",
            source: "path-source",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#56D89B",
              "line-width": 6,
              "line-opacity": 0.3,
            },
          });
        }

        // Main line
        map.addLayer({
          id: "path-main",
          type: "line",
          source: "path-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": isDark ? "#A8E6CF" : "#2D4A2E",
            "line-width": isDark ? 3.5 : 4,
            "line-opacity": 0.9,
          },
        });

        // Start marker (green dot)
        if (coords.length > 1) {
          const startEl = document.createElement("div");
          startEl.style.cssText =
            "width:14px;height:14px;background:#34C759;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(52,199,89,0.5)";
          const startMarker = new mapboxgl.Marker({
            element: startEl,
            anchor: "center",
          })
            .setLngLat(coords[0] as [number, number])
            .addTo(map);
          markersRef.current.push(startMarker);

          // End marker (red dot)
          const endEl = document.createElement("div");
          endEl.style.cssText =
            "width:14px;height:14px;background:#FF3B30;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(255,59,48,0.5)";
          const endMarker = new mapboxgl.Marker({
            element: endEl,
            anchor: "center",
          })
            .setLngLat(coords[coords.length - 1] as [number, number])
            .addTo(map);
          markersRef.current.push(endMarker);
        }

        // Fit bounds to path
        try {
          const bounds = new mapboxgl.LngLatBounds();
          coords.forEach((c: [number, number]) => bounds.extend(c));
          map.fitBounds(bounds, { padding: 40, duration: 0 });
        } catch {}
      }

      // ----- Current position marker (pulsing green dot) -----
      if (center) {
        const posEl = document.createElement("div");
        posEl.style.cssText =
          "position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px";
        posEl.innerHTML = `
          <div style="width:16px;height:16px;background:#4ADE80;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(74,222,128,0.6);z-index:2;position:absolute"></div>
          <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(74,222,128,0.2);animation:pulse 2s infinite"></div>
        `;
        posMarkerRef.current = new mapboxgl.Marker({
          element: posEl,
          anchor: "center",
        })
          .setLngLat([center.lng, center.lat])
          .addTo(map);
      }

      // ----- Spot markers -----
      markers.forEach((m) => {
        const el = document.createElement("div");

        if (m.emoji) {
          el.style.cssText = `width:36px;height:36px;background:${isDark ? "rgba(30,30,30,0.9)" : "white"};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px ${isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)"};border:2px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)"};font-size:18px;backdrop-filter:blur(8px);cursor:pointer`;
          el.innerHTML = `<span>${m.emoji}</span>`;
        } else {
          el.style.cssText = `width:12px;height:12px;background:${isDark ? "#A8E6CF" : "#2D4A2E"};border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.2);cursor:pointer`;
        }

        // Popup
        const popupHtml = `<div style="font-family:'Pretendard Variable',sans-serif;font-size:13px;font-weight:600;padding:2px 4px;color:${isDark ? "#fff" : "#191F28"}">${m.title}</div>`;
        const popup = new mapboxgl.Popup({
          closeButton: false,
          offset: [0, m.emoji ? -20 : -8],
          className: isDark ? "mapbox-popup-dark" : "mapbox-popup-clean",
        }).setHTML(popupHtml);
        popupsRef.current.push(popup);

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
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
  }, [loaded, pathCoordinates?.length, markers.length, center?.lat, center?.lng]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: isDark ? "#1a1a2e" : "#f0f4f0" }}
    >
      <div ref={mapRef} className="w-full h-full" />
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
