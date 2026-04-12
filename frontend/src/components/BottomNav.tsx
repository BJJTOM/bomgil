"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguageStore } from "@/stores/language";
import { useAuthStore } from "@/stores/auth";

export function BottomNav() {
  const pathname = usePathname();
  const { language } = useLanguageStore();
  const { user, isAuthenticated } = useAuthStore();
  const profileHref = isAuthenticated && user?.nickname ? `/profile/${user.nickname}` : "/auth/login";

  const labels: Record<string, Record<string, string>> = {
    "/": { ko: "홈", en: "Home", ja: "ホーム", zh: "首页" },
    "/explore": { ko: "탐색", en: "Explore", ja: "探索", zh: "探索" },
    "/community": { ko: "커뮤니티", en: "Community", ja: "コミュニティ", zh: "社区" },
    "/activities": { ko: "내 기록", en: "Records", ja: "記録", zh: "记录" },
    "/profile": { ko: "MY", en: "MY", ja: "MY", zh: "MY" },
  };

  const navItems = [
    {
      href: "/",
      label: labels["/"][language] ?? "Home",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#2D4A2E" : "none"} stroke={active ? "#2D4A2E" : "#B0B8C1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      href: "/explore",
      label: labels["/explore"][language] ?? "Explore",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#2D4A2E" : "#B0B8C1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      href: "/community",
      label: labels["/community"][language] ?? "Community",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#2D4A2E" : "none"} stroke={active ? "#2D4A2E" : "#B0B8C1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
    },
    {
      href: "/activities",
      label: labels["/activities"][language] ?? "Activity",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#2D4A2E" : "#B0B8C1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
    },
    {
      href: "/settings",
      label: labels["/profile"][language] ?? "MY",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#2D4A2E" : "#B0B8C1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-[60] flex justify-center pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <nav className="bg-white/90 backdrop-blur-xl shadow-float rounded-[28px] border border-white/50 mx-4 w-full max-w-[380px] pointer-events-auto mb-2">
        <div className="flex items-center justify-around h-[64px] px-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && !item.href.startsWith("/auth") && pathname.startsWith(item.href)) ||
              (item.href === "/settings" && (pathname.startsWith("/settings") || pathname.startsWith("/profile")));

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center gap-[3px] w-14 h-full active:scale-90 transition-all duration-200"
              >
                <div
                  className={`transition-all duration-200 ${
                    isActive ? "scale-110" : "opacity-70"
                  }`}
                >
                  {item.icon(isActive)}
                </div>
                <span
                  className={`text-[10px] leading-none font-semibold transition-all duration-200 ${
                    isActive ? "text-primary" : "text-text-secondary"
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="block w-1 h-1 rounded-full bg-primary animate-fade-in" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
