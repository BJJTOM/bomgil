"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

const NAV_LINKS = [
  { href: "/explore", label: "코스 탐색" },
  { href: "/community", label: "커뮤니티" },
  { href: "/activities", label: "활동 기록" },
  { href: "/rankings", label: "랭킹" },
];

export function Navbar() {
  const { user, isAuthenticated } = useAuthStore();
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border-light">
      <div className="max-w-7xl mx-auto w-full px-6 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[22px] font-bold text-primary tracking-tight">봄길</span>
            <span className="text-[10px] font-semibold text-primary/50 bg-primary/5 px-1.5 py-0.5 rounded">GLOBAL</span>
          </Link>

          <div className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-button text-[14px] font-medium transition-all ${
                    isActive
                      ? "bg-primary-50 text-primary"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link
                href="/trails/new"
                className="px-4 py-2 bg-accent text-primary rounded-button text-[13px] font-semibold hover:bg-accent-dark transition-colors"
              >
                + 코스 등록
              </Link>
              <Link
                href={`/profile/${user?.nickname}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-pill bg-bg-secondary hover:bg-border-light transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center overflow-hidden text-xs">
                  {user?.profile_image ? (
                    <img
                      src={user.profile_image}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    "👤"
                  )}
                </div>
                <span className="text-[13px] font-medium text-text-primary">
                  {user?.nickname}
                </span>
              </Link>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="btn-primary !py-2.5 !px-5 !text-[13px]"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
