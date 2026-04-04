"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { useLanguageStore, LANGUAGES, useT } from "@/stores/language";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { t } = useT();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const sections = [
    {
      title: language === "ko" ? "계정" : "Account",
      items: [
        ...(isAuthenticated ? [
          { label: language === "ko" ? "프로필 수정" : "Edit Profile", href: "/profile/edit", icon: "👤" },
          { label: language === "ko" ? "내 활동 기록" : "My Activities", href: "/activities", icon: "📊" },
          { label: language === "ko" ? "좋아요한 코스" : "Liked Trails", href: "/likes", icon: "❤️" },
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
          <div className="mx-5 mb-4">
            <Link href={`/profile/${user.nickname}`} className="card-hover p-4 flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
                {user.profile_image ? (
                  <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-[16px]">{user.nickname}</p>
                <p className="text-[12px] text-text-tertiary">{user.email}</p>
              </div>
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
          <p className="text-[11px] text-text-tertiary">© 2026 Roami. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
