"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { useLanguageStore, LANGUAGES, useT } from "@/stores/language";
import api from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPhotoMenu, setShowPhotoMenu] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("profile_image", file);
    try {
      const { data } = await api.patch("/auth/me/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(data);
    } catch {}
    setShowPhotoMenu(false);
  };

  const handlePhotoDelete = async () => {
    try {
      const { data } = await api.patch("/auth/me/", { profile_image: null });
      setUser(data);
    } catch {}
    setShowPhotoMenu(false);
  };
  const { language, setLanguage } = useLanguageStore();
  const { t } = useT();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = () => {
    setLoggingOut(true);
    setTimeout(() => {
      logout();
      setShowLogoutModal(false);
      setLoggingOut(false);
      router.push("/");
    }, 800);
  };

  const sections = [
    {
      title: language === "ko" ? "계정" : "Account",
      items: [
        ...(isAuthenticated ? [
          { label: language === "ko" ? "프로필 수정" : "Edit Profile", href: "/profile/edit", icon: "👤" },
          { label: language === "ko" ? "내 활동 기록" : "My Activities", href: "/activities", icon: "📊" },
          { label: language === "ko" ? "내 코스 관리" : "My Trails", href: `/profile/${user?.nickname}`, icon: "🗺" },
          { label: language === "ko" ? "좋아요한 코스" : "Liked Trails", href: "/likes", icon: "❤️" },
          { label: language === "ko" ? "저장한 코스" : "Saved Trails", href: "/saved", icon: "📥" },
        ] : [
          { label: language === "ko" ? "로그인" : "Login", href: "/auth/login", icon: "🔑" },
          { label: language === "ko" ? "회원가입" : "Sign Up", href: "/auth/register", icon: "✨" },
        ]),
      ],
    },
    {
      title: language === "ko" ? "앱 설정" : "App Settings",
      items: [
        { label: language === "ko" ? "언어 설정" : "Language", value: LANGUAGES.find(l => l.code === language)?.label, icon: "🌐", action: "language" },
        { label: language === "ko" ? "알림 설정" : "Notifications", href: "/notifications", icon: "🔔" },
        { label: language === "ko" ? "공지사항" : "Notices", href: "/notices", icon: "📢" },
      ],
    },
    {
      title: language === "ko" ? "정보" : "Information",
      items: [
        { label: language === "ko" ? "서비스 이용약관" : "Terms of Service", href: "/terms", icon: "📋" },
        { label: language === "ko" ? "개인정보처리방침" : "Privacy Policy", href: "/privacy", icon: "🔒" },
        { label: language === "ko" ? "오픈소스 라이선스" : "Open Source", href: "/licenses", icon: "📄" },
        { label: language === "ko" ? "버전 정보" : "Version", value: "1.0.0", icon: "ℹ️" },
      ],
    },
  ];

  return (
    <div className="md:pt-[60px] min-h-screen bg-warm pb-24">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="px-5 pt-14 md:pt-6 pb-4">
          <h1 className="text-[22px] font-bold">{language === "ko" ? "설정" : "Settings"}</h1>
        </div>

        {/* User card (if logged in) */}
        {isAuthenticated && user && (
          <div className="mx-5 mb-4 card-hover p-4 flex items-center gap-3.5">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <div className="relative">
              <button onClick={() => setShowPhotoMenu(!showPhotoMenu)} className="relative w-14 h-14 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                {user.profile_image ? (
                  <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-white">
                  <span className="text-[8px]">📷</span>
                </div>
              </button>
              {showPhotoMenu && (
                <div className="absolute top-16 left-0 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[130px]">
                  <button onClick={() => { setShowPhotoMenu(false); fileInputRef.current?.click(); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50">사진 변경</button>
                  {user.profile_image && (
                    <button onClick={handlePhotoDelete} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50">사진 삭제</button>
                  )}
                  <button onClick={() => setShowPhotoMenu(false)} className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50">취소</button>
                </div>
              )}
            </div>
            <Link href={`/profile/${user.nickname}`} className="flex-1">
              <p className="font-bold text-[16px]">{user.nickname}</p>
              <p className="text-[12px] text-text-tertiary">{user.email}</p>
            </Link>
            <Link href={`/profile/${user.nickname}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          </div>
        )}

        {/* Sections */}
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-5 text-[12px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">{section.title}</p>
            <div className="mx-5 bg-white rounded-card shadow-soft overflow-hidden divide-y divide-border-light">
              {section.items.map((item: any) => {
                const content = (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span className="text-[18px] w-7 text-center">{item.icon}</span>
                    <span className="flex-1 text-[14px] font-medium">{item.label}</span>
                    {item.value && <span className="text-[13px] text-text-tertiary">{item.value}</span>}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                );

                if (item.href) {
                  return <Link key={item.label} href={item.href} className="block hover:bg-bg-secondary transition-colors">{content}</Link>;
                }
                if (item.action === "language") {
                  return <div key={item.label} onClick={() => setShowLangModal(true)} className="hover:bg-bg-secondary transition-colors cursor-pointer">{content}</div>;
                }
                return <div key={item.label} className="hover:bg-bg-secondary transition-colors cursor-pointer">{content}</div>;
              })}
            </div>
          </div>
        ))}

        {/* Logout */}
        {isAuthenticated && (
          <div className="mx-5 mb-8">
            <button
              onClick={handleLogout}
              className="w-full py-3.5 bg-white rounded-card shadow-soft text-danger text-[14px] font-medium hover:bg-red-50 transition-colors"
            >
              {language === "ko" ? "로그아웃" : "Logout"}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-[11px] text-text-tertiary">© 2026 Moru. All rights reserved.</p>
        </div>
      </div>

      {/* Language Modal */}
      {showLangModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-10" onClick={() => setShowLangModal(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-[320px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold text-center mb-4">{language === "ko" ? "언어 설정" : "Language"}</h3>
            {([
              { code: "ko" as const, label: "한국어", flag: "🇰🇷" },
              { code: "en" as const, label: "English", flag: "🇺🇸" },
              { code: "ja" as const, label: "日本語", flag: "🇯🇵" },
              { code: "zh" as const, label: "中文", flag: "🇨🇳" },
            ]).map((lang) => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang.code); setShowLangModal(false); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl mb-1 transition-colors ${language === lang.code ? "bg-primary/10" : "hover:bg-bg-secondary"}`}
              >
                <span className="text-[22px]">{lang.flag}</span>
                <span className="text-[15px] font-medium flex-1 text-left">{lang.label}</span>
                {language === lang.code && <span className="text-primary font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-10">
          <div className="bg-white rounded-[20px] p-7 w-full max-w-[320px] text-center">
            {loggingOut ? (
              <div className="py-6">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[15px] text-text-secondary">{language === "ko" ? "로그아웃 중..." : "Logging out..."}</p>
              </div>
            ) : (
              <>
                <div className="text-[36px] mb-3">👋</div>
                <h3 className="text-[18px] font-bold text-text-primary mb-1.5">
                  {language === "ko" ? "로그아웃 하시겠습니까?" : "Log out?"}
                </h3>
                <p className="text-[13px] text-text-tertiary mb-6">
                  {language === "ko" ? "다시 로그인하면 기록을 이어갈 수 있어요" : "You can continue your records after logging in again"}
                </p>
                <button
                  onClick={confirmLogout}
                  className="w-full py-3.5 bg-danger text-white rounded-[14px] text-[15px] font-semibold mb-2.5"
                >
                  {language === "ko" ? "로그아웃" : "Log out"}
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="w-full py-3 text-text-secondary text-[15px]"
                >
                  {language === "ko" ? "취소" : "Cancel"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
