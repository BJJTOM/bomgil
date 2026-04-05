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
    <div className="md:pt-[60px] min-h-screen pb-24" style={{ backgroundColor: "#FAFAFA" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="px-5 pt-14 md:pt-6 pb-3">
          <h1 className="text-[22px] font-bold text-[#191F28]">{language === "ko" ? "설정" : "Settings"}</h1>
        </div>

        {/* User card */}
        {isAuthenticated && user && (
          <div className="mx-5 mb-5">
            <Link href={`/profile/${user.nickname}`} className="bg-white rounded-[16px] border border-[#E5E8EB] p-4 flex items-center gap-3.5 block hover:bg-[#F7F8FA] transition-colors">
              <div className="w-14 h-14 rounded-full bg-[#A8E6CF]/30 flex items-center justify-center overflow-hidden">
                {user.profile_image ? (
                  <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-[16px] text-[#191F28]">{user.nickname}</p>
                <p className="text-[12px] text-[#B0B8C1]">{user.email}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          </div>
        )}

        {/* Grouped sections — Apple Settings style */}
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="px-5 text-[12px] font-medium text-[#B0B8C1] uppercase tracking-wider mb-1.5">{section.title}</p>
            <div className="mx-5 bg-white rounded-[16px] overflow-hidden">
              {section.items.map((item: any, idx: number) => {
                const content = (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-[18px] w-7 text-center">{item.icon}</span>
                    <span className="flex-1 text-[14px] font-medium text-[#191F28]">{item.label}</span>
                    {item.value && <span className="text-[13px] text-[#B0B8C1]">{item.value}</span>}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                );

                const isLast = idx === section.items.length - 1;

                if (item.href) {
                  return (
                    <div key={item.label}>
                      <Link href={item.href} className="block hover:bg-[#F7F8FA] transition-colors">{content}</Link>
                      {!isLast && <div className="h-px bg-[#F2F4F6] ml-[52px]" />}
                    </div>
                  );
                }
                return (
                  <div key={item.label}>
                    <div className="hover:bg-[#F7F8FA] transition-colors cursor-pointer">{content}</div>
                    {!isLast && <div className="h-px bg-[#F2F4F6] ml-[52px]" />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Logout */}
        {isAuthenticated && (
          <div className="mx-5 mb-6">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-white rounded-[16px] text-danger text-[14px] font-medium hover:bg-red-50 transition-colors"
            >
              {language === "ko" ? "로그아웃" : "Logout"}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-[11px] text-[#B0B8C1]">&copy; 2026 Roami. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
