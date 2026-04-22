/** @type {import('next').NextConfig} */
const nextConfig = {
  // DRF requires trailing slashes; keep them so /api/v1/foo/ doesn't get
  // 308'd to /api/v1/foo and break the upstream rewrite.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8001",
      },
      {
        protocol: "https",
        hostname: "**.onrender.com",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudflare.com",
      },
      {
        protocol: "https",
        hostname: "tong.visitkorea.or.kr",
      },
    ],
  },
  async rewrites() {
    // Dev-only proxy: serves the API under the same origin so the browser
    // never makes a cross-origin request and CORS is not involved at all.
    // Provide both with-slash and without-slash sources because DRF requires
    // trailing slashes and Next.js doesn't preserve them through :path*.
    if (process.env.NODE_ENV === "development") {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";
      const upstreamOrigin = apiUrl.replace(/\/api\/v1\/?$/, "");
      return [
        {
          source: "/api/:path*/",
          destination: `${upstreamOrigin}/api/:path*/`,
        },
        {
          source: "/api/:path*",
          destination: `${upstreamOrigin}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
