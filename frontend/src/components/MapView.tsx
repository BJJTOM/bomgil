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
  const [loaded, setLoaded] = useState(false);

  const isDark = theme === "dark";

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;

        // Fix default marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        const defaultCenter = center || { lat: 37.5665, lng: 126.978 };
        const tile = TILE_LAYERS[theme];

        const map = L.map(mapRef.current!, {
          center: [defaultCenter.lat, defaultCenter.lng],
          zoom,
          zoomControl: false,
          attributionControl: false,
        });

        // Add zoom control to bottom-right for cleaner look
        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Minimal attribution
        L.control
          .attribution({ position: "bottomright", prefix: false })
          .addAttribution(tile.attribution)
          .addTo(map);

        // Tile layer
        L.tileLayer(tile.url, {
          maxZoom: 19,
        }).addTo(map);

        // --- Draw route with glow effect ---
        if (pathCoordinates && pathCoordinates.length > 0) {
          // pathCoordinates are [lng, lat] (GeoJSON format), Leaflet needs [lat, lng]
          const latLngs = pathCoordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );

          // Outer glow layer
          L.polyline(latLngs, {
            color: isDark ? "#A8E6CF" : "#2D4A2E",
            weight: 10,
            opacity: isDark ? 0.2 : 0.12,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);

          // Mid glow layer (only on dark theme for extra neon feel)
          if (isDark) {
            L.polyline(latLngs, {
              color: "#56D89B",
              weight: 6,
              opacity: 0.3,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
          }

          // Main route line
          L.polyline(latLngs, {
            color: isDark ? "#A8E6CF" : "#2D4A2E",
            weight: isDark ? 3.5 : 4,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);

          // --- Start marker (pulsing green) ---
          const startLatLng = latLngs[0];
          const startIcon = L.divIcon({
            html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
              <div style="width:14px;height:14px;background:#34C759;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(52,199,89,0.5);position:relative;z-index:2"></div>
              <div class="leaflet-ping" style="position:absolute;top:-5px;left:-5px;width:24px;height:24px;border-radius:50%;border:2px solid #34C759;opacity:0.6"></div>
            </div>`,
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker(startLatLng, { icon: startIcon, interactive: false }).addTo(
            map
          );

          // --- End marker (red) ---
          const endLatLng = latLngs[latLngs.length - 1];
          const endIcon = L.divIcon({
            html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
              <div style="width:14px;height:14px;background:#FF3B30;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(255,59,48,0.5);position:relative;z-index:2"></div>
            </div>`,
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker(endLatLng, { icon: endIcon, interactive: false }).addTo(map);

          // Fit bounds to route
          const polylineBounds = L.polyline(latLngs);
          map.fitBounds(polylineBounds.getBounds(), { padding: [40, 40] });
        } else if (markers.length > 1) {
          const group = L.featureGroup(
            markers.map((m) => L.marker([m.lat, m.lng]))
          );
          map.fitBounds(group.getBounds(), { padding: [30, 30] });
        }

        // --- Add spot markers ---
        markers.forEach((m) => {
          if (m.emoji) {
            // Premium emoji marker: white circle + emoji + shadow
            const icon = L.divIcon({
              html: `<div style="
                width:36px;height:36px;
                background:${isDark ? "rgba(30,30,30,0.9)" : "white"};
                border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                box-shadow:0 2px 12px ${isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)"};
                border:2px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)"};
                font-size:18px;
                backdrop-filter:blur(8px);
              "><span>${m.emoji}</span></div>`,
              className: "",
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            });
            const marker = L.marker([m.lat, m.lng], { icon });
            marker.addTo(map);
            if (onMarkerClick) {
              marker.on("click", () => onMarkerClick(m.id));
            }
            // Clean minimal popup
            marker.bindPopup(
              `<div style="
                font-family:'Pretendard Variable',sans-serif;
                font-size:13px;font-weight:600;
                padding:2px 0;
                color:${isDark ? "#fff" : "#191F28"};
              ">${m.title}</div>`,
              {
                className: isDark
                  ? "leaflet-popup-dark"
                  : "leaflet-popup-clean",
                closeButton: false,
                offset: [0, -4],
              }
            );
          } else {
            // Default styled marker
            const icon = L.divIcon({
              html: `<div style="
                width:12px;height:12px;
                background:${isDark ? "#A8E6CF" : "#2D4A2E"};
                border-radius:50%;
                border:2px solid white;
                box-shadow:0 1px 6px rgba(0,0,0,0.2);
              "></div>`,
              className: "",
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            });
            const marker = L.marker([m.lat, m.lng], { icon });
            marker.addTo(map).bindPopup(m.title);
            if (onMarkerClick) {
              marker.on("click", () => onMarkerClick(m.id));
            }
          }
        });

        mapInstanceRef.current = map;
        setLoaded(true);

        setTimeout(() => {
          try { if (mapInstanceRef.current) map.invalidateSize(); } catch {}
        }, 100);
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
      }
    };
  }, [
    center?.lat,
    center?.lng,
    markers.length,
    pathCoordinates?.length,
    zoom,
    theme,
  ]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full" />

      {/* Stats overlay — Strava / Nike Run style */}
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
