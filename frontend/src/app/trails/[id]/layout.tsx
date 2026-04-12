/**
 * Trail detail layout — runs on the server so search engines see
 * descriptive title/description/og tags without having to execute
 * the client-side React tree.
 *
 * The existing page.tsx is still a "use client" component (the
 * detail UI is interactive), so we just add this server-side layout
 * to supply the metadata. ISR is achieved through the `revalidate`
 * export — Next.js re-generates the page at most once per 15 minutes
 * so trail edits on the admin propagate automatically.
 */
import type { Metadata } from "next";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.moruwalk.com/api/v1";

// Revalidate at most every 15 minutes per trail.
export const revalidate = 900;

type RouteParams = { id: string };

async function fetchTrail(id: string) {
  try {
    const res = await fetch(`${API_BASE}/trails/${id}/`, {
      next: { revalidate: 900, tags: [`trail-${id}`] },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<RouteParams> }
): Promise<Metadata> {
  const { id } = await params;
  const trail = await fetchTrail(id);
  if (!trail) {
    return {
      title: "Moru — 코스 상세",
      description: "한국의 걷기 코스를 발견하고 기록하세요.",
    };
  }

  const title = trail.title || "Moru 코스";
  const region = trail.region || "";
  const distance =
    trail.distance_km != null ? `${Number(trail.distance_km).toFixed(1)}km` : "";
  const description =
    trail.description?.slice(0, 160) ||
    `${region} ${distance} 걷기 코스. Moru에서 확인하세요.`;
  const image = trail.cover_image || trail.thumbnail_url || undefined;
  const ogImage = image
    ? [{ url: image, width: 1200, height: 630, alt: title }]
    : undefined;

  return {
    title: `${title} · ${region} · Moru`,
    description,
    openGraph: {
      title: `${title} · Moru`,
      description,
      type: "article",
      images: ogImage,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
    alternates: {
      canonical: `https://moruwalk.com/trails/${id}`,
    },
  };
}

export default function TrailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
