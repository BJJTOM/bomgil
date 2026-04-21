"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistance } from "@/lib/utils";
import type { Trail } from "@/types";

interface ExploreMapProps {
  trails: Trail[];
}

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy: { label: "Easy", color: "#2E7D32" },
  moderate: { label: "Moderate", color: "#E65100" },
  hard: { label: "Hard", color: "#C62828" },
};

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

export function ExploreMap({ trails }: ExploreMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markerLayersRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const initializedRef = useRef(false);
  const router = useRouter();

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        leafletRef.current = L;

        // Fix default icon paths
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        const map = L.map(mapRef.current!, {
          center: [37.5665, 126.978], // Seoul default
          zoom: 7,
          zoomControl: false,
          attributionControl: false,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control
          .attribution({ position: "bottomright", prefix: false })
          .addAttribution(TILE_ATTRIBUTION)
          .addTo(map);

        L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);

        mapInstanceRef.current = map;
        setLoaded(true);

        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {}
        }, 200);
      } catch (err) {
        console.error("ExploreMap load error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f9f4;border-radius:16px;">
              <div style="text-align:center;color:#777;">
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
  }, []);

  // Update markers whenever trails change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    // Clear old markers
    markerLayersRef.current.forEach((m: any) => map.removeLayer(m));
    markerLayersRef.current = [];

    // Filter trails with valid coordinates
    const validTrails = trails.filter((t) => {
      const lat = parseFloat(t.start_lat);
      const lng = parseFloat(t.start_lng);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });

    if (validTrails.length === 0) return;

    const bounds: [number, number][] = [];

    validTrails.forEach((trail) => {
      const lat = parseFloat(trail.start_lat);
      const lng = parseFloat(trail.start_lng);
      bounds.push([lat, lng]);

      // Custom green dot marker matching primary color
      const icon = L.divIcon({
        html: `<div style="
          width: 14px;
          height: 14px;
          background: #2D4A2E;
          border-radius: 50%;
          border: 2.5px solid white;
          box-shadow: 0 2px 8px rgba(45,74,46,0.4);
          transition: transform 0.15s ease;
        "></div>`,
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      // Difficulty config
      const diff = DIFFICULTY_LABELS[trail.difficulty] || DIFFICULTY_LABELS.easy;

      // Build popup HTML
      const thumbnailSrc = trail.thumbnail_url || trail.cover_image;
      const thumbnailHtml = thumbnailSrc
        ? `<img src="${thumbnailSrc}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:8px 8px 0 0;display:block;" />`
        : `<div style="width:100%;height:72px;background:linear-gradient(135deg,#d4f5e4,#A8E6CF);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;font-size:28px;">🥾</div>`;

      const popupContent = `
        <div style="width:200px;font-family:'Pretendard Variable','Pretendard',sans-serif;cursor:pointer;" data-trail-id="${trail.id}">
          ${thumbnailHtml}
          <div style="padding:10px 12px 12px;">
            <div style="font-size:14px;font-weight:700;color:#191F28;line-height:1.3;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${trail.title}
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="
                display:inline-block;
                padding:2px 8px;
                border-radius:20px;
                font-size:11px;
                font-weight:600;
                color:${diff.color};
                background:${trail.difficulty === "easy" ? "#E8F5E9" : trail.difficulty === "moderate" ? "#FFF3E0" : "#FFEBEE"};
              ">${diff.label}</span>
              <span style="font-size:12px;color:#8B95A1;font-weight:500;">
                ${formatDistance(trail.distance_km)}
              </span>
              ${trail.region ? `<span style="font-size:12px;color:#B0B8C1;">·</span><span style="font-size:12px;color:#8B95A1;">${trail.region}</span>` : ""}
            </div>
          </div>
        </div>
      `;

      const popup = L.popup({
        closeButton: false,
        offset: [0, -4],
        className: "explore-map-popup",
        maxWidth: 220,
        minWidth: 200,
      }).setContent(popupContent);

      marker.bindPopup(popup);

      // Navigate on popup click
      marker.on("popupopen", () => {
        const popupEl = popup.getElement();
        if (popupEl) {
          const clickTarget = popupEl.querySelector("[data-trail-id]");
          if (clickTarget) {
            (clickTarget as HTMLElement).onclick = () => {
              router.push(`/trails/${trail.id}`);
            };
          }
        }
      });

      // Enlarge marker on hover
      marker.on("mouseover", () => {
        const el = marker.getElement();
        if (el) {
          const dot = el.querySelector("div");
          if (dot) dot.style.transform = "scale(1.4)";
        }
      });
      marker.on("mouseout", () => {
        const el = marker.getElement();
        if (el) {
          const dot = el.querySelector("div");
          if (dot) dot.style.transform = "scale(1)";
        }
      });

      markerLayersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (bounds.length === 1) {
      map.setView(bounds[0], 13, { animate: true });
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
    }
  }, [trails, loaded, router]);

  return (
    <div className="relative w-full h-[60vh] md:h-[500px] rounded-card overflow-hidden shadow-card">
      <div ref={mapRef} className="w-full h-full" />

      {/* Loading state */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-[#f0f4f0] rounded-card">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trail count badge */}
      {loaded && trails.length > 0 && (
        <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-md rounded-pill px-3 py-1.5 shadow-soft">
          <span className="text-[12px] font-semibold text-primary">
            {trails.filter(
              (t) =>
                !isNaN(parseFloat(t.start_lat)) &&
                !isNaN(parseFloat(t.start_lng)) &&
                parseFloat(t.start_lat) !== 0
            ).length}{" "}
            trails
          </span>
        </div>
      )}

      {/* Custom popup styles */}
      <style jsx global>{`
        .explore-map-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          overflow: hidden;
        }
        .explore-map-popup .leaflet-popup-content {
          margin: 0;
          line-height: normal;
        }
        .explore-map-popup .leaflet-popup-tip {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  );
}
