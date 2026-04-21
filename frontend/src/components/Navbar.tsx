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
          {/* Threads Icon */}
          <a
            href="https://www.threads.net/@moruwalk"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Threads"
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.752-.293 1.61-.903 2.878-1.833 3.79-1.208 1.186-2.858 1.814-4.91 1.867h-.036c-1.677-.044-3.063-.588-4.12-1.617-1.108-1.08-1.694-2.58-1.694-4.339 0-3.533 2.49-5.965 6.057-5.965 1.625 0 2.994.474 3.96 1.372.93.865 1.453 2.07 1.513 3.49.004.098.005.198.003.298-.523-.27-1.088-.502-1.694-.69-.009-.076-.015-.152-.026-.226-.132-1.665-1.2-2.776-2.896-2.776h-.044c-1.025.016-1.882.425-2.414 1.152l1.176.696c.329-.467.826-.714 1.4-.714h.027c1.077.016 1.573.76 1.637 1.502.075.866-.052 1.757-.181 2.308-.464-.067-.95-.103-1.456-.103-3.013 0-4.812 1.876-4.812 4.018 0 2.268 1.685 3.86 4.092 3.86h.036c1.66-.044 2.96-.548 3.876-1.498.716-.742 1.17-1.728 1.376-2.994.79.474 1.382 1.08 1.72 1.853.584 1.332.619 3.52-1.135 5.235-1.588 1.553-3.502 2.227-6.38 2.248zM14.97 14.32c.028-.122.134-.63.095-1.384-.087-1.69-1.182-2.593-3.165-2.593-2.67 0-3.94 1.693-3.94 3.848 0 1.727 1.142 2.85 2.91 2.85h.027c2.5-.065 3.87-1.404 4.073-2.72z"/>
            </svg>
          </a>

          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              aria-label="Change language"
              aria-expanded={showLangMenu}
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
              {/* CTA: Add Trail Button */}
              <Link
                href="/trails/new"
                className="px-4 py-2 bg-primary text-white rounded-full text-[13px] font-semibold hover:bg-primary-dark transition-colors shadow-sm"
              >
                {language === "ko" ? "코스 등록" : language === "ja" ? "コース登録" : language === "zh" ? "添加路线" : "Add Trail"}
              </Link>

              {/* User dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-label="User menu"
                  aria-expanded={showUserMenu}
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
            <>
              {/* CTA: Add Trail prompts login */}
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-primary text-white rounded-full text-[13px] font-semibold hover:bg-primary-dark transition-colors shadow-sm"
              >
                {language === "ko" ? "코스 등록" : language === "ja" ? "コース登録" : language === "zh" ? "添加路线" : "Add Trail"}
              </Link>
              <Link
                href="/auth/login"
                className="px-4 py-2.5 bg-bg-secondary hover:bg-border-light rounded-pill text-[13px] font-medium text-text-primary transition-colors"
              >
                {t("common.login")}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
