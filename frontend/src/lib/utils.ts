import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(km: string | number): string {
  const d = typeof km === "string" ? parseFloat(km) : km;
  if (d < 1) return `${Math.round(d * 1000)}m`;
  return `${d.toFixed(1)}km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export function getCurrencySymbol(country: string): string {
  const map: Record<string, string> = { KR: "₩", JP: "¥", US: "$", CN: "¥" };
  return map[country] || "$";
}

export const SPOT_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  start: { label: "출발", emoji: "🚩" },
  restaurant: { label: "맛집", emoji: "🍽️" },
  cafe: { label: "카페", emoji: "☕" },
  photo: { label: "포토스팟", emoji: "📸" },
  rest: { label: "휴식", emoji: "🪑" },
  view: { label: "전망", emoji: "🌄" },
  danger: { label: "주의", emoji: "⚠️" },
  market: { label: "시장/마켓", emoji: "🏪" },
  gallery: { label: "문화공간", emoji: "🎨" },
  temple: { label: "절/사찰", emoji: "🏛️" },
  accommodation: { label: "숙소", emoji: "🏨" },
  transport: { label: "교통편", emoji: "🚌" },
  tip: { label: "꿀팁", emoji: "💡" },
  toilet: { label: "화장실", emoji: "🚻" },
  water: { label: "식수대", emoji: "🚰" },
  store: { label: "편의점/매점", emoji: "🛒" },
  pharmacy: { label: "약국", emoji: "💊" },
  hospital: { label: "병원/의원", emoji: "🏥" },
  police: { label: "경찰서", emoji: "👮" },
  parking: { label: "주차장", emoji: "🅿️" },
  end: { label: "도착", emoji: "🏁" },
};

export const DIFFICULTY_CONFIG = {
  easy: { label: "여유롭게", emoji: "🚶", color: "bg-green-100 text-green-700" },
  moderate: { label: "보통", emoji: "🚶‍♂️", color: "bg-yellow-100 text-yellow-700" },
  hard: { label: "도전적", emoji: "🏃", color: "bg-red-100 text-red-700" },
} as const;

export const TRAIL_TYPE_CONFIG: Record<string, { label: string; emoji: string }> = {
  urban: { label: "도심산책", emoji: "🏙️" },
  coastal: { label: "해안길", emoji: "🌊" },
  village: { label: "마을길", emoji: "🏘️" },
  cultural: { label: "문화탐방", emoji: "🏛️" },
  nature: { label: "자연길", emoji: "🌿" },
  mixed: { label: "복합", emoji: "🥾" },
};

export const SEASON_LABELS: Record<string, string> = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
  all: "사계절",
  rainy_ok: "우천 가능",
};

export const PACE_LABELS: Record<string, { label: string; emoji: string }> = {
  slow: { label: "느긋하게", emoji: "🐢" },
  moderate: { label: "보통", emoji: "🚶" },
  fast: { label: "빠르게", emoji: "🏃" },
};

export const WALKING_STYLE_LABELS: Record<string, { label: string; emoji: string }> = {
  explorer: { label: "탐험가", emoji: "🧭" },
  foodie: { label: "맛집러", emoji: "🍜" },
  photographer: { label: "사진러", emoji: "📷" },
  talker: { label: "수다쟁이", emoji: "💬" },
  silent: { label: "조용한 산책", emoji: "🤫" },
};
