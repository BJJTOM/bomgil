/**
 * Robots configuration — generated as `/robots.txt` by Next.js.
 *
 * Allow indexing of public discovery pages, disallow private user
 * areas (settings, my activities, drafts) and the API namespace.
 */
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/settings",
          "/me/",
          "/auth/",
          "/admin/",
          "/likes",
          "/notifications",
          "/chat",
          "/companions",
        ],
      },
    ],
    sitemap: "https://moruwalk.com/sitemap.xml",
    host: "https://moruwalk.com",
  };
}
