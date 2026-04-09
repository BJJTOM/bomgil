/**
 * LiveMap — Leaflet map showing the walker's current position and trail.
 *
 * Loaded via dynamic() in the parent so leaflet's window-dependent code
 * never runs on the server.
 */
'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface Props {
  current: {
    lat: number;
    lng: number;
    accuracy: number | null;
    speed_kmh: number | null;
  };
  track: [number, number, number][];
}

export default function LiveMap({ current, track }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const accuracyRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;

      // Init map once
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [current.lat, current.lng],
          zoom: 16,
          zoomControl: true,
          attributionControl: false,
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      }
      const map = mapInstanceRef.current;

      // Trail polyline
      if (polylineRef.current) map.removeLayer(polylineRef.current);
      if (track.length > 1) {
        const coords = track.map((t) => [t[0], t[1]]) as [number, number][];
        polylineRef.current = L.polyline(coords, {
          color: '#2D4A2E',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
      }

      // Accuracy circle
      if (accuracyRef.current) map.removeLayer(accuracyRef.current);
      if (current.accuracy && current.accuracy > 0) {
        accuracyRef.current = L.circle([current.lat, current.lng], {
          radius: current.accuracy,
          color: '#2D4A2E',
          fillColor: '#2D4A2E',
          fillOpacity: 0.1,
          weight: 1,
        }).addTo(map);
      }

      // Walker marker (pulsing dot)
      if (markerRef.current) map.removeLayer(markerRef.current);
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 22px; height: 22px;
          background: #2D4A2E;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 8px rgba(45,74,46,0.2),
                      0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      markerRef.current = L.marker([current.lat, current.lng], { icon }).addTo(map);

      // Pan to current position
      map.setView([current.lat, current.lng], map.getZoom() || 16);
    })();
    return () => { cancelled = true; };
  }, [current.lat, current.lng, current.accuracy, track]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}
