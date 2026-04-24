/** @type {import('next').NextConfig} */

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Allow geolocation (core feature) + camera (photo upload) on self
    // only; deny everything else to shrink the attack surface.
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=(self)",
      "display-capture=()",
      "fullscreen=(self)",
      "geolocation=(self)",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=()",
      "sync-xhr=(self)",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Content-Security-Policy: permissive enough to load our real
    // third-party deps (Firebase, Google Analytics, Leaflet/Mapbox tiles,
    // Pretendard font CDN) but still blocks arbitrary origins.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.googleapis.com https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
      "img-src 'self' data: blob: https: http://tong.visitkorea.or.kr",
      "connect-src 'self' https: wss: ws://localhost:* http://localhost:*",
      "frame-src 'self' https://*.firebaseapp.com https://vercel.live",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  // DRF requires trailing slashes; keep them so /api/v1/foo/ doesn't get
  // 308'd to /api/v1/foo and break the upstream rewrite.
  skipTrailingSlashRedirect: true,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8001" },
      { protocol: "https", hostname: "**.onrender.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.cloudflare.com" },
      { protocol: "https", hostname: "tong.visitkorea.or.kr" },
      // Our own backend (profile uploads / custom covers)
      { protocol: "https", hostname: "api.moruwalk.com" },
      { protocol: "https", hostname: "moruwalk.com" },
      // Social-login profile images
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
      { protocol: "https", hostname: "img1.kakaocdn.net" },
      { protocol: "https", hostname: "t1.kakaocdn.net" },
      { protocol: "https", hostname: "phinf.pstatic.net" },
      // Stock images referenced by any legacy seed data
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async rewrites() {
    // Dev-only proxy: serves the API under the same origin so the browser
    // never makes a cross-origin request and CORS is not involved at all.
    // Provide both with-slash and without-slash sources because DRF requires
    // trailing slashes and Next.js doesn't preserve them through :path*.
    if (process.env.NODE_ENV === "development") {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";
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
