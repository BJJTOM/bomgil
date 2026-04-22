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

// ─── Config type interfaces ───
interface SpotTypeEntry {
  label: string;
  icon: string;
  color: string;
}

interface DifficultyEntry {
  label: string;
  color: string;
  hex: string;
}

interface TrailTypeEntry {
  label: string;
  emoji: string;
  icon: string;
  color: string;
}

// Primary spot type config with SVG icon names and theme colors
export const SPOT_TYPE_CONFIG: Record<string, SpotTypeEntry> = {
  start: { label: "출발", icon: "flag", color: "#2D4A2E" },
  end: { label: "도착", icon: "flag-checkered", color: "#2D4A2E" },
  restaurant: { label: "맛집", icon: "utensils", color: "#E65100" },
  cafe: { label: "카페", icon: "coffee", color: "#6D4C41" },
  photo: { label: "포토스팟", icon: "camera", color: "#7B1FA2" },
  rest: { label: "쉼터", icon: "home", color: "#00897B" },
  view: { label: "전망대", icon: "eye", color: "#1565C0" },
  danger: { label: "주의", icon: "alert-triangle", color: "#C62828" },
  market: { label: "시장/마켓", icon: "shopping-bag", color: "#EF6C00" },
  gallery: { label: "문화공간", icon: "palette", color: "#AD1457" },
  temple: { label: "절/사찰", icon: "landmark", color: "#5D4037" },
  accommodation: { label: "숙소", icon: "bed", color: "#1565C0" },
  transport: { label: "교통편", icon: "bus", color: "#0277BD" },
  tip: { label: "꿀팁", icon: "lightbulb", color: "#F9A825" },
  toilet: { label: "화장실", icon: "droplet", color: "#0288D1" },
  water: { label: "식수대", icon: "droplets", color: "#0288D1" },
  store: { label: "편의점/매점", icon: "store", color: "#558B2F" },
  pharmacy: { label: "약국", icon: "pill", color: "#D32F2F" },
  hospital: { label: "병원/의원", icon: "cross", color: "#D32F2F" },
  police: { label: "경찰서", icon: "shield", color: "#1565C0" },
  parking: { label: "주차장", icon: "parking", color: "#455A64" },
};

// SVG path data for spot type icons (16x16 viewBox assumed, stroke-based)
export const SPOT_ICON_PATHS: Record<string, string> = {
  flag: "M4 15s1-1 4-1 5 2 8 2 1-1V3s-3 1-4-1-5 2-8 2z M4 22V2",
  "flag-checkered": "M4 15s1-1 4-1 5 2 8 2 1-1V3s-3 1-4-1-5 2-8 2z M4 22V2",
  utensils: "M3 2v7c0 1.1.9 2 2 2h2a2 2 0 002-2V2 M7 2v20 M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7",
  coffee: "M17 8h1a4 4 0 110 8h-1 M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z M6 2v3 M10 2v3 M14 2v3",
  camera: "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z",
  home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z",
  "alert-triangle": "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01",
  "shopping-bag": "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0",
  palette: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z",
  landmark: "M6 22V12h4v10 M14 22V12h4v10 M2 22h20 M12 2l10 7H2z M12 7v5",
  bed: "M2 4v16 M2 8h18a2 2 0 012 2v10 M2 17h20 M6 8v4",
  bus: "M4 6a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M4 10h16 M8 22v-4 M16 22v-4 M8 6v4 M16 6v4",
  lightbulb: "M9 21h6 M12 3a6 6 0 00-4 10.5V17h8v-3.5A6 6 0 0012 3z",
  droplet: "M12 2.69l5.66 5.66a8 8 0 11-11.31 0z",
  droplets: "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z M16.7 19.36c3.18 0 5.76-2.65 5.76-5.87 0-1.68-.82-3.27-2.47-4.63-1.66-1.35-2.68-2.87-3.1-4.56-.41 1.69-1.56 3.22-3.29 4.56-1.73 1.35-2.66 2.95-2.66 4.63 0 3.22 2.6 5.87 5.76 5.87z",
  store: "M2 7l2-4h16l2 4 M2 7h20v15H2z M6 11v6h5v-6z M15 11v2h4v-2z",
  pill: "M10.5 1.5l-8 8a4.95 4.95 0 007 7l8-8a4.95 4.95 0 00-7-7z M6.5 10.5l7-7",
  cross: "M12 2v20 M18 6H6v12h12z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  parking: "M3 22V2h7a5 5 0 010 10H3",
};

// Backward-compatible alias so components importing SPOT_TYPE_LABELS still work
// (e.g. trails/[id]/page.tsx reads .emoji — we map it to the label text)
export const SPOT_TYPE_LABELS: Record<string, { label: string; emoji: string }> =
  Object.fromEntries(
    Object.entries(SPOT_TYPE_CONFIG).map(([key, { label }]) => [
      key,
      { label, emoji: label },
    ])
  );

export const DIFFICULTY_CONFIG: Record<string, DifficultyEntry> = {
  easy: { label: "쉬움", color: "bg-green-100 text-green-700", hex: "#22C55E" },
  moderate: { label: "보통", color: "bg-amber-100 text-amber-700", hex: "#F59E0B" },
  hard: { label: "어려움", color: "bg-red-100 text-red-700", hex: "#EF4444" },
};

export const TRAIL_TYPE_CONFIG: Record<string, TrailTypeEntry> = {
  urban: { label: "도심산책", emoji: "", icon: "building", color: "#6B7280" },
  coastal: { label: "해안길", emoji: "", icon: "waves", color: "#0EA5E9" },
  village: { label: "마을길", emoji: "", icon: "home", color: "#D97706" },
  cultural: { label: "문화탐방", emoji: "", icon: "landmark", color: "#8B5CF6" },
  nature: { label: "자연길", emoji: "", icon: "leaf", color: "#22C55E" },
  mixed: { label: "복합", emoji: "", icon: "compass", color: "#2D4A2E" },
};

// SVG path data for trail type icons (24x24 viewBox, stroke-based)
export const TRAIL_TYPE_ICON_PATHS: Record<string, string> = {
  building: "M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16",
  waves: "M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.4 2 5 2c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.4 2 5 2c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
  home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  landmark: "M6 22V12h4v10 M14 22V12h4v10 M2 22h20 M12 2l10 7H2z M12 7v5",
  leaf: "M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75",
  compass: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z",
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
