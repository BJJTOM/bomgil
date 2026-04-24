"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistance } from "@/lib/utils";
import type { Trail } from "@/types";
import "mapbox-gl/dist/mapbox-gl.css";

interface ExploreMapProps {
  trails: Trail[];
}

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy: { label: "Easy", color: "#2E7D32" },
  moderate: { label: "Moderate", color: "#E65100" },
  hard: { label: "Hard", color: "#C62828" },
};

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

export function ExploreMap({ trails }: ExploreMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupsRef = useRef<any[]>([]);
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
        const mapboxgl = (await import("mapbox-gl")).default;

        (mapboxgl as any).accessToken = MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
          container: mapRef.current!,
          style: "mapbox://styles/mapbox/outdoors-v12",
          center: [126.978, 37.5665], // Seoul default
          zoom: 7,
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
        console.error("ExploreMap load error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f9f4;border-radius:16px;">
              <div style="text-align:center;color:#777;">
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
  }, []);

  // Update markers whenever trails change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let mapboxgl: any;
    (async () => {
      mapboxgl = (await import("mapbox-gl")).default;

      // Clear old markers and popups
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];

      // Filter trails with valid coordinates
      const validTrails = trails.filter((t) => {
        const lat = parseFloat(t.start_lat);
        const lng = parseFloat(t.start_lng);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });

      if (validTrails.length === 0) return;

      const bounds = new mapboxgl.LngLatBounds();

      validTrails.forEach((trail) => {
        const lat = parseFloat(trail.start_lat);
        const lng = parseFloat(trail.start_lng);
        bounds.extend([lng, lat]);

        // Custom green dot marker
        const el = document.createElement("div");
        el.style.cssText =
          "width:14px;height:14px;background:#2D4A2E;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(45,74,46,0.4);transition:transform 0.15s ease;cursor:pointer";

        // Hover effect
        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.4)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
        });

        // Difficulty config
        const diff =
          DIFFICULTY_LABELS[trail.difficulty] || DIFFICULTY_LABELS.easy;

        // Build popup HTML
        const thumbnailSrc = trail.thumbnail_url || trail.cover_image;
        const thumbnailHtml = thumbnailSrc
          ? `<img src="${thumbnailSrc}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:8px 8px 0 0;display:block;" />`
          : `<div style="width:100%;height:72px;background:linear-gradient(135deg,#d4f5e4,#A8E6CF);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;font-size:28px;">&#x1f97e;</div>`;

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
                ${trail.region ? `<span style="font-size:12px;color:#B0B8C1;">&#183;</span><span style="font-size:12px;color:#8B95A1;">${trail.region}</span>` : ""}
              </div>
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          closeButton: false,
          offset: [0, -10],
          className: "explore-map-popup",
          maxWidth: "220px",
        }).setHTML(popupContent);

        // Navigate on popup click
        popup.on("open", () => {
          const popupEl = popup.getElement();
          if (popupEl) {
            const clickTarget = popupEl.querySelector(
              "[data-trail-id]"
            ) as HTMLElement;
            if (clickTarget) {
              clickTarget.onclick = () => {
                router.push(`/trails/${trail.id}`);
              };
            }
          }
        });

        popupsRef.current.push(popup);

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });

      // Fit bounds to show all markers
      if (validTrails.length === 1) {
        const lat = parseFloat(validTrails[0].start_lat);
        const lng = parseFloat(validTrails[0].start_lng);
        map.easeTo({ center: [lng, lat], zoom: 13, duration: 500 });
      } else {
        map.fitBounds(bounds, {
          padding: 40,
          maxZoom: 14,
          duration: 500,
        });
      }
    })();
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
        .explore-map-popup .mapboxgl-popup-content {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          overflow: hidden;
        }
        .explore-map-popup .mapboxgl-popup-tip {
          border-top-color: white;
        }
      `}</style>
    </div>
  );
}
