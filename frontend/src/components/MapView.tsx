"use client";

import { useEffect, useRef, useState } from "react";

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

const TILE_LAYERS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
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
  const leafletRef = useRef<any>(null);
  const pathLayerRef = useRef<any>(null);
  const markerLayersRef = useRef<any[]>([]);
  const posMarkerRef = useRef<any>(null);
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
        const L = (await import("leaflet")).default;
        leafletRef.current = L;

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        const defaultCenter = center || { lat: 37.5665, lng: 126.978 };
        const tile = TILE_LAYERS[theme];

        const map = L.map(mapRef.current!, {
          center: [defaultCenter.lat, defaultCenter.lng],
          zoom,
          zoomControl: false,
          attributionControl: false,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control.attribution({ position: "bottomright", prefix: false })
          .addAttribution(tile.attribution).addTo(map);

        L.tileLayer(tile.url, { maxZoom: 19 }).addTo(map);

        mapInstanceRef.current = map;
        setLoaded(true);

        setTimeout(() => {
          try { map.invalidateSize(); } catch {}
        }, 200);
      } catch (err) {
        console.error("Map load error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${isDark ? "#1a1a2e" : "#f0f9f4"};border-radius:16px;">
              <div style="text-align:center;color:${isDark ? "#555" : "#777"};">
                <div style="font-size:48px;margin-bottom:8px;">🗺️</div>
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
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center?.lat, center?.lng]);

  // Update path + markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    // Clear old path
    if (pathLayerRef.current) {
      pathLayerRef.current.forEach((l: any) => map.removeLayer(l));
      pathLayerRef.current = null;
    }

    // Clear old markers
    markerLayersRef.current.forEach((l: any) => map.removeLayer(l));
    markerLayersRef.current = [];

    // Clear position marker
    if (posMarkerRef.current) {
      map.removeLayer(posMarkerRef.current);
      posMarkerRef.current = null;
    }

    // Draw route
    if (pathCoordinates && pathCoordinates.length > 0) {
      const latLngs = pathCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      const layers: any[] = [];

      // Glow
      layers.push(L.polyline(latLngs, {
        color: isDark ? "#A8E6CF" : "#2D4A2E", weight: 10,
        opacity: isDark ? 0.2 : 0.12, lineCap: "round", lineJoin: "round",
      }).addTo(map));

      if (isDark) {
        layers.push(L.polyline(latLngs, {
          color: "#56D89B", weight: 6, opacity: 0.3, lineCap: "round", lineJoin: "round",
        }).addTo(map));
      }

      // Main line
      layers.push(L.polyline(latLngs, {
        color: isDark ? "#A8E6CF" : "#2D4A2E", weight: isDark ? 3.5 : 4,
        opacity: 0.9, lineCap: "round", lineJoin: "round",
      }).addTo(map));

      // Start marker
      if (latLngs.length > 1) {
        const startIcon = L.divIcon({
          html: `<div style="width:14px;height:14px;background:#34C759;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(52,199,89,0.5)"></div>`,
          className: "", iconSize: [14, 14], iconAnchor: [7, 7],
        });
        layers.push(L.marker(latLngs[0], { icon: startIcon, interactive: false }).addTo(map));
      }

      pathLayerRef.current = layers;

      // Always fit bounds when path exists so the full route is visible
      try {
        map.fitBounds(L.polyline(latLngs).getBounds(), { padding: [40, 40] });
      } catch {}

    }

    // Current position marker (pulsing green dot)
    if (center) {
      const posIcon = L.divIcon({
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
          <div style="width:16px;height:16px;background:#4ADE80;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(74,222,128,0.6);z-index:2"></div>
          <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(74,222,128,0.2);animation:pulse 2s infinite"></div>
        </div>`,
        className: "", iconSize: [28, 28], iconAnchor: [14, 14],
      });
      posMarkerRef.current = L.marker([center.lat, center.lng], { icon: posIcon, interactive: false }).addTo(map);
    }

    // Spot markers
    markers.forEach((m) => {
      const icon = m.emoji
        ? L.divIcon({
            html: `<div style="width:36px;height:36px;background:${isDark ? "rgba(30,30,30,0.9)" : "white"};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px ${isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)"};border:2px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)"};font-size:18px;backdrop-filter:blur(8px)"><span>${m.emoji}</span></div>`,
            className: "", iconSize: [36, 36], iconAnchor: [18, 18],
          })
        : L.divIcon({
            html: `<div style="width:12px;height:12px;background:${isDark ? "#A8E6CF" : "#2D4A2E"};border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.2)"></div>`,
            className: "", iconSize: [12, 12], iconAnchor: [6, 6],
          });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      marker.bindPopup(
        `<div style="font-family:'Pretendard Variable',sans-serif;font-size:13px;font-weight:600;padding:2px 0;color:${isDark ? "#fff" : "#191F28"}">${m.title}</div>`,
        { className: isDark ? "leaflet-popup-dark" : "leaflet-popup-clean", closeButton: false, offset: [0, -4] }
      );
      if (onMarkerClick) marker.on("click", () => onMarkerClick(m.id));
      markerLayersRef.current.push(marker);
    });
  }, [pathCoordinates?.length, markers.length, center?.lat, center?.lng]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: isDark ? "#1a1a2e" : "#f0f4f0" }}>
      <div ref={mapRef} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: isDark ? "#4ADE80" : "#2D4A2E", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>

      {showStats && (distance || duration) && (
        <div className="absolute bottom-4 left-4 z-[1000] flex items-end gap-3">
          {distance && (
            <div className="bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 text-white border border-white/10">
              <div className="text-[24px] font-bold font-en leading-none tracking-tight">{parseFloat(distance).toFixed(1)}</div>
              <div className="text-[11px] text-white/50 mt-0.5 uppercase tracking-wider">km</div>
            </div>
          )}
          {duration && (
            <div className="bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 text-white border border-white/10">
              <div className="text-[24px] font-bold font-en leading-none tracking-tight">
                {Number(duration) >= 60 ? `${Math.floor(Number(duration) / 60)}:${String(Number(duration) % 60).padStart(2, "0")}` : duration}
              </div>
              <div className="text-[11px] text-white/50 mt-0.5 uppercase tracking-wider">{Number(duration) >= 60 ? "hr" : "min"}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
