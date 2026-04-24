/**
 * LiveMap — Mapbox GL JS map showing the walker's current position and trail.
 *
 * Loaded via dynamic() in the parent so mapbox-gl's window-dependent code
 * never runs on the server.
 */
"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

interface Props {
  current: {
    lat: number;
    lng: number;
    accuracy: number | null;
    speed_kmh: number | null;
  };
  track: [number, number, number][];
}

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

export default function LiveMap({ current, track }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);
  const initializedRef = useRef(false);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !mapRef.current) return;

      mapboxglRef.current = mapboxgl;
      (mapboxgl as any).accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: [current.lng, current.lat],
        zoom: 16,
        attributionControl: false,
      });

      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "bottom-right"
      );

      map.on("load", () => {
        mapInstanceRef.current = map;
      });
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update trail, marker, and accuracy on data change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl) return;

    // Trail polyline
    if (map.getLayer("live-trail")) map.removeLayer("live-trail");
    if (map.getSource("live-trail-source"))
      map.removeSource("live-trail-source");

    if (track.length > 1) {
      // track items are [lat, lng, timestamp] - convert to [lng, lat]
      const coords = track.map((t) => [t[1], t[0]] as [number, number]);
      map.addSource("live-trail-source", {
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
      map.addLayer({
        id: "live-trail",
        type: "line",
        source: "live-trail-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#2D4A2E",
          "line-width": 5,
          "line-opacity": 0.9,
        },
      });
    }

    // Accuracy circle
    if (map.getLayer("live-accuracy")) map.removeLayer("live-accuracy");
    if (map.getSource("live-accuracy-source"))
      map.removeSource("live-accuracy-source");

    if (current.accuracy && current.accuracy > 0) {
      // Approximate a circle using a GeoJSON polygon
      const steps = 64;
      const km = current.accuracy / 1000;
      const ret: [number, number][] = [];
      const distRadians = km / 6371;
      const centerLat = (current.lat * Math.PI) / 180;
      const centerLng = (current.lng * Math.PI) / 180;
      for (let i = 0; i <= steps; i++) {
        const bearing = (2 * Math.PI * i) / steps;
        const lat = Math.asin(
          Math.sin(centerLat) * Math.cos(distRadians) +
            Math.cos(centerLat) * Math.sin(distRadians) * Math.cos(bearing)
        );
        const lng =
          centerLng +
          Math.atan2(
            Math.sin(bearing) * Math.sin(distRadians) * Math.cos(centerLat),
            Math.cos(distRadians) - Math.sin(centerLat) * Math.sin(lat)
          );
        ret.push([(lng * 180) / Math.PI, (lat * 180) / Math.PI]);
      }
      map.addSource("live-accuracy-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [ret],
          },
        },
      });
      map.addLayer({
        id: "live-accuracy",
        type: "fill",
        source: "live-accuracy-source",
        paint: {
          "fill-color": "#2D4A2E",
          "fill-opacity": 0.1,
        },
      });
    }

    // Walker marker (pulsing dot)
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    const el = document.createElement("div");
    el.style.cssText =
      "width:22px;height:22px;background:#2D4A2E;border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(45,74,46,0.2),0 2px 8px rgba(0,0,0,0.3)";
    markerRef.current = new mapboxgl.Marker({
      element: el,
      anchor: "center",
    })
      .setLngLat([current.lng, current.lat])
      .addTo(map);

    // Pan to current position
    map.easeTo({
      center: [current.lng, current.lat],
      duration: 300,
    });
  }, [current.lat, current.lng, current.accuracy, track]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
}
