import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { FirebaseInit } from "@/components/FirebaseInit";
import { ThemeInit } from "@/components/ThemeInit";
import { GlobalErrorHandlers } from "@/components/GlobalErrorHandlers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Inline script runs before React hydrates so there is no light-mode
// flash when the persisted theme is dark. Reads the same localStorage
// key that the Zustand persist middleware writes to.
const THEME_BOOTSTRAP_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('moru-theme');
    var mode = 'light';
    if (saved) {
      try { mode = (JSON.parse(saved).state || {}).mode || 'light'; } catch (e) {}
    }
    var isDark = mode === 'dark';
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

const SITE_URL = "https://moruwalk.com";
const SITE_TITLE = "Moru — 걸으면 보이는 것들";
const SITE_DESCRIPTION =
  "전 세계 도보여행 코스를 발견하고, 나만의 길을 기록하고 공유하세요. GPS 산책 기록, 동행 매칭, AI 코스 추천까지 — 걷는 즐거움을 위한 모든 것.";
const SITE_OG_IMAGE = `${SITE_URL}/icon-512.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — Moru",
  },
  description: SITE_DESCRIPTION,
  manifest: "/manifest.json",
  themeColor: "#2D4A2E",
  applicationName: "Moru",
  keywords: [
    "도보여행", "산책", "트레일", "코스", "동행", "산책앱",
    "walking", "hiking", "trails", "Korea",
  ],
  authors: [{ name: "Moru" }],
  creator: "Moru",
  publisher: "Moru",
  alternates: {
    canonical: "/",
    languages: {
      "ko-KR": "/",
      "en-US": "/",
      "ja-JP": "/",
      "zh-CN": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    siteName: "Moru",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "ko_KR",
    images: [
      {
        url: SITE_OG_IMAGE,
        width: 512,
        height: 512,
        alt: "Moru — 걸으면 보이는 것들",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Moru",
  },
  formatDetection: {
    telephone: false,
  },
};

const JSON_LD_ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Moru",
  url: SITE_URL,
  logo: SITE_OG_IMAGE,
  description: SITE_DESCRIPTION,
  sameAs: [],
};

const JSON_LD_WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Moru",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/explore?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#2D4A2E" />
        <link rel="canonical" href={SITE_URL} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_ORGANIZATION) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_WEBSITE) }}
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="bg-warm text-text-primary min-h-screen antialiased">
        <Providers>
          <ThemeInit />
          <FirebaseInit />
          <GlobalErrorHandlers />
          <Navbar />
          <main className="pb-24 md:pb-0">{children}</main>
          <BottomNav />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
