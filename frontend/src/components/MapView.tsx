"use client";

import { useEffect, useRef } from "react";

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
  zoom = 12,
  markers = [],
  pathCoordinates,
  onMarkerClick,
  className = "w-full h-full min-h-[400px]",
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;

    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (country === "KR" && kakaoKey) {
      loadKakaoMap(kakaoKey);
    } else if (country !== "KR" && mapboxToken) {
      loadMapboxMap(mapboxToken);
    } else {
      renderFallback();
    }
  }, [country, center?.lat, center?.lng, markers.length]);

  const loadKakaoMap = (apiKey: string) => {
    if ((window as any).kakao?.maps) {
      initKakaoMap();
      return;
    }
    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.onload = () => {
      (window as any).kakao.maps.load(initKakaoMap);
    };
    script.onerror = renderFallback;
    document.head.appendChild(script);
  };

  const initKakaoMap = () => {
    if (!mapRef.current) return;
    const kakao = (window as any).kakao;
    const map = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.978),
      level: zoom > 10 ? 8 : zoom > 5 ? 5 : 3,
    });

    markers.forEach((m) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(m.lat, m.lng),
        map,
      });
      if (onMarkerClick) {
        kakao.maps.event.addListener(marker, "click", () => onMarkerClick(m.id));
      }
    });

    if (pathCoordinates && pathCoordinates.length > 0) {
      const path = pathCoordinates.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
      new kakao.maps.Polyline({
        map, path, strokeWeight: 4, strokeColor: "#2D4A2E", strokeOpacity: 0.8,
      });
    }
  };

  const loadMapboxMap = async (token: string) => {
    try {
      const mapboxgl = await import("mapbox-gl");
      await import("mapbox-gl/dist/mapbox-gl.css");
      (mapboxgl as any).accessToken = token;
      if (!mapRef.current) return;

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: [center?.lng || 139.7, center?.lat || 35.68],
        zoom,
      });

      markers.forEach((m) => {
        const el = document.createElement("div");
        el.textContent = m.emoji || "📍";
        el.style.fontSize = "24px";
        el.style.cursor = "pointer";
        new mapboxgl.Marker(el).setLngLat([m.lng, m.lat]).addTo(map);
        if (onMarkerClick) {
          el.addEventListener("click", () => onMarkerClick(m.id));
        }
      });

      if (pathCoordinates && pathCoordinates.length > 0) {
        map.on("load", () => {
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: pathCoordinates },
            },
          });
          map.addLayer({
            id: "route", type: "line", source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#2D4A2E", "line-width": 4 },
          });
        });
      }
    } catch {
      renderFallback();
    }
  };

  const renderFallback = () => {
    if (!mapRef.current) return;
    mapRef.current.innerHTML = `
      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f9f4;border-radius:16px;">
        <div style="text-align:center;color:#777;">
          <div style="font-size:48px;margin-bottom:8px;">🗺️</div>
          <p style="font-size:14px;">지도 미리보기</p>
          <p style="font-size:12px;margin-top:4px;color:#aaa;">API 키 설정 시 지도가 표시됩니다</p>
        </div>
      </div>
    `;
  };

  return <div ref={mapRef} className={className} />;
}
