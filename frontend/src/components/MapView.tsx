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
}

export function MapView({
  country = "KR",
  center,
  zoom = 13,
  markers = [],
  pathCoordinates,
  onMarkerClick,
  className = "w-full h-full min-h-[400px]",
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

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
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        const defaultCenter = center || { lat: 37.5665, lng: 126.978 };

        const map = L.map(mapRef.current!, {
          center: [defaultCenter.lat, defaultCenter.lng],
          zoom,
          zoomControl: true,
          attributionControl: true,
        });

        // OpenStreetMap tile layer (free, no API key)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Add markers
        markers.forEach((m) => {
          const marker = L.marker([m.lat, m.lng]);
          if (m.emoji) {
            const icon = L.divIcon({
              html: `<span style="font-size:24px">${m.emoji}</span>`,
              className: "bg-transparent border-none",
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            });
            marker.setIcon(icon);
          }
          marker.addTo(map).bindPopup(m.title);
          if (onMarkerClick) {
            marker.on("click", () => onMarkerClick(m.id));
          }
        });

        // Draw path/polyline
        if (pathCoordinates && pathCoordinates.length > 0) {
          // pathCoordinates are [lng, lat] (GeoJSON format), Leaflet needs [lat, lng]
          const latLngs = pathCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
          const polyline = L.polyline(latLngs, {
            color: "#2D4A2E",
            weight: 4,
            opacity: 0.8,
          }).addTo(map);
          map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        } else if (markers.length > 1) {
          // Fit to markers
          const group = L.featureGroup(
            markers.map((m) => L.marker([m.lat, m.lng]))
          );
          map.fitBounds(group.getBounds(), { padding: [30, 30] });
        }

        mapInstanceRef.current = map;
        setLoaded(true);

        // Fix map render after container resize
        setTimeout(() => map.invalidateSize(), 100);
      } catch (err) {
        console.error("Map load error:", err);
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
      }
    };
  }, [center?.lat, center?.lng, markers.length, pathCoordinates?.length, zoom]);

  return <div ref={mapRef} className={className} />;
}
