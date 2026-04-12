"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useLanguageStore, useT, LANGUAGES } from "@/stores/language";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const pathname = usePathname();
  const { language, setLanguage } = useLanguageStore();
  const { t } = useT();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const NAV_LINKS = [
    { href: "/explore", label: t("nav.explore") },
    { href: "/series", label: language === "ko" ? "시리즈" : language === "ja" ? "シリーズ" : language === "zh" ? "系列" : "Series" },
    { href: "/community", label: language === "ko" ? "커뮤니티" : language === "ja" ? "コミュニティ" : language === "zh" ? "社区" : "Community" },
    { href: "/activities", label: language === "ko" ? "내 기록" : language === "ja" ? "マイ記録" : language === "zh" ? "我的记录" : "My Records" },
    { href: "/rankings", label: language === "ko" ? "랭킹" : language === "ja" ? "ランキング" : language === "zh" ? "排行榜" : "Rankings" },
  ];

  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border-light">
      <div className="max-w-7xl mx-auto w-full px-6 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="text-[20px]">🌿</span>
            <span className="text-[22px] font-bold text-primary tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.02em" }}>Moru</span>
          </Link>

          <div className="flex items-center gap-0.5 lg:gap-1">
            {NAV_LINKS.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 lg:px-4 py-2 rounded-button text-[13px] lg:text-[14px] font-medium transition-all ${
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
          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-bg-secondary hover:bg-border-light transition-colors text-[13px]"
            >
              <span>{LANGUAGES.find(l => l.code === language)?.flag}</span>
              <span className="hidden lg:inline text-text-secondary font-medium">{LANGUAGES.find(l => l.code === language)?.label}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className="absolute top-full right-0 mt-1 bg-white rounded-card shadow-card border border-border-light py-1 min-w-[140px] z-50">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => { setLanguage(l.code); setShowLangMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] hover:bg-bg-secondary transition-colors ${
                        language === l.code ? "text-primary font-semibold bg-primary-50" : "text-text-primary"
                      }`}
                    >
                      <span>{l.flag}</span>
                      <span>{l.label}</span>
                      {language === l.code && <span className="ml-auto text-primary">{"\u2713"}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {isAuthenticated ? (
            <>
              <Link
                href="/trails/new"
                className="px-3 lg:px-4 py-2 bg-accent text-primary rounded-button text-[13px] font-semibold hover:bg-accent-dark transition-colors"
              >
                <span className="lg:hidden">+</span>
                <span className="hidden lg:inline">+ {t("common.createTrail")}</span>
              </Link>

              {/* User dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-pill bg-bg-secondary hover:bg-border-light transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center overflow-hidden text-xs">
                    {user?.profile_image ? (
                      <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      "\uD83D\uDC64"
                    )}
                  </div>
                  <span className="text-[13px] font-medium text-text-primary">{user?.nickname}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute top-full right-0 mt-1.5 bg-white rounded-[16px] shadow-card border border-border-light py-2 w-[220px] z-50">
                      {/* Profile header */}
                      <Link
                        href={`/profile/${user?.nickname}`}
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-accent/40 flex items-center justify-center overflow-hidden">
                          {user?.profile_image ? (
                            <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg">{"\uD83D\uDC64"}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold">{user?.nickname}</p>
                          <p className="text-[11px] text-text-tertiary">{language === "ko" ? "\uD504\uB85C\uD544 \uBCF4\uAE30" : "View profile"}</p>
                        </div>
                      </Link>

                      <div className="h-px bg-border-light mx-3 my-1" />

                      {/* Menu items */}
                      {[
                        { href: "/settings", icon: "\u2699\uFE0F", label: language === "ko" ? "\uC124\uC815" : "Settings" },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary transition-colors text-[13px] font-medium text-text-primary"
                        >
                          <span className="w-5 text-center">{item.icon}</span>
                          {item.label}
                        </Link>
                      ))}

                      <div className="h-px bg-border-light mx-3 my-1" />

                      <button
                        onClick={() => { setShowUserMenu(false); logout(); window.location.href = "/"; }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors text-[13px] font-medium text-red-500"
                      >
                        <span className="w-5 text-center">{"\uD83D\uDC4B"}</span>
                        {language === "ko" ? "\uB85C\uADF8\uC544\uC6C3" : "Logout"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="btn-primary !py-2.5 !px-5 !text-[13px]"
            >
              {t("common.login")}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
