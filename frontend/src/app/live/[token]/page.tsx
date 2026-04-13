/**
 * Live Walk Viewer
 *
 * Read-only page that polls the backend's /live-walks/<token>/ endpoint
 * every 10 seconds and shows the walker's current position on a map.
 * Strava-Beacon style — friends/family open this URL to see where
 * someone is during their walk.
 *
 * Auto-refreshes; no auth required (the token IS the credential).
 */
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false });

interface LiveData {
  owner_nickname: string;
  started_at: number;
  last_update: number;
  current: {
    lat: number;
    lng: number;
    accuracy: number | null;
    speed_kmh: number | null;
  } | null;
  track: [number, number, number][]; // [lat, lng, ts]
  distance_km: number;
  duration_seconds: number;
  is_live: boolean;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'https://api.moruwalk.com/api/v1';
const POLL_INTERVAL_MS = 10_000;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LiveWalkPage() {
  const params = useParams();
  const token = (params?.token as string) || '';
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`${API_BASE}/live-walks/${token}/`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setError('이 공유는 만료되었거나 존재하지 않습니다.');
            return;
          }
          if (!cancelled) setError(`서버 오류 (${res.status})`);
          return;
        }
        const json = (await res.json()) as LiveData;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError('네트워크 연결을 확인해주세요.');
      }
    };

    fetchOnce();
    timerRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">공유가 종료되었어요</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {data.owner_nickname}님의 실시간 위치
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.is_live ? (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  실시간 추적 중
                </span>
              ) : (
                <span className="text-gray-400">오프라인 — 마지막 업데이트 {Math.round((Date.now() / 1000 - data.last_update) / 60)}분 전</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">{data.distance_km.toFixed(2)} km</div>
            <div className="text-xs text-gray-500">{formatDuration(data.duration_seconds)}</div>
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        {data.current ? (
          <LiveMap
            current={data.current}
            track={data.track}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            첫 위치 업데이트를 기다리는 중...
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 px-5 py-3 text-center">
        <p className="text-[11px] text-gray-400">
          모루(moruwalk.com) · 안전 공유는 마지막 업데이트로부터 2시간 후 자동 종료됩니다
        </p>
      </footer>
    </div>
  );
}
