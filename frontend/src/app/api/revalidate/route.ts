/**
 * On-demand ISR revalidation endpoint.
 *
 * POST /api/revalidate?tag=trail-series&secret=...
 *
 * Called by the Django backend whenever a Trail, TrailSeries, or
 * TrailSeriesTrail row is saved/deleted. Next.js looks up the
 * cached entries tagged with that tag and marks them stale so the
 * next visitor gets a fresh build without waiting for the
 * time-based `revalidate` window.
 *
 * Security: shared secret via env var. Mismatch → 401. The secret
 * is also sent from the backend via a header.
 */
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "";

export async function POST(req: NextRequest) {
  // Reject if secret is not configured — prevents accidental
  // unauthenticated revalidation on a misconfigured deploy.
  if (!REVALIDATE_SECRET) {
    return NextResponse.json(
      { ok: false, error: "REVALIDATE_SECRET not configured" },
      { status: 500 },
    );
  }

  const headerSecret = req.headers.get("x-revalidate-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const provided = headerSecret || querySecret;

  if (provided !== REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Accept either a single tag or a comma-separated list.
  // Accept also a JSON body `{ tags: [...] }`.
  const tagsFromQuery = req.nextUrl.searchParams.get("tag");
  let tags: string[] = [];

  if (tagsFromQuery) {
    tags = tagsFromQuery.split(",").map((t) => t.trim()).filter(Boolean);
  } else {
    try {
      const body = await req.json();
      if (Array.isArray(body?.tags)) {
        tags = body.tags.filter((t: unknown) => typeof t === "string");
      }
    } catch {
      // no body — ignore
    }
  }

  if (tags.length === 0) {
    console.warn("[revalidate] no tags provided", {
      url: req.nextUrl.pathname + req.nextUrl.search,
    });
    return NextResponse.json(
      { ok: false, error: "no tags provided" },
      { status: 400 },
    );
  }

  try {
    for (const tag of tags) {
      revalidateTag(tag);
    }
    console.log("[revalidate] ok", { tags, at: new Date().toISOString() });
  } catch (err) {
    console.error("[revalidate] failed", { tags, err: String(err) });
    return NextResponse.json(
      { ok: false, error: "revalidation failed", detail: String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    revalidated: tags,
    now: Date.now(),
  });
}

// Also allow GET for quick manual testing:
//   curl "https://moruwalk.com/api/revalidate?tag=trail-series&secret=..."
export async function GET(req: NextRequest) {
  return POST(req);
}
