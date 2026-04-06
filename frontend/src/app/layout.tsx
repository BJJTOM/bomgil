import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Moru — 걸으면 보이는 것들",
  description:
    "Discover walking trails worldwide. Record your journey, share hidden gems. 전 세계 도보여행 코스를 발견하고, 나만의 길을 공유하세요.",
  manifest: "/manifest.json",
  themeColor: "#2D4A2E",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Moru",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-warm text-text-primary min-h-screen antialiased" style={{ backgroundColor: "#FAFAFA" }}>
        <Providers>
          <Navbar />
          <main className="pb-24 md:pb-0">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
