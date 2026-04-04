"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: any) => {
    if (e?.preventDefault) e.preventDefault();
    if (!email || !password) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/email-login/", { email, password });
      login(data.user, data.access, data.refresh);
      router.push("/");
    } catch (err: any) {
      const msg = err.response?.data?.non_field_errors?.[0]
        || err.response?.data?.detail
        || (err.response?.status === 400 ? "이메일 또는 비밀번호를 확인해주세요." : "로그인 중 문제가 발생했습니다.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/social/${provider}/`;
  };

  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/guest-login/");
      login(data.user, data.access, data.refresh);
      router.push("/");
    } catch {
      setError(t("loginPage.guestFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="md:pt-16 min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-bold text-primary tracking-tight" style={{ fontFamily: "'DM Sans', 'Sora', sans-serif" }}>Roami</h1>
          <p className="text-text-secondary text-[15px] mt-1">{t("loginPage.tagline")}</p>
        </div>

        <div className="card p-7">
          <h2 className="text-[20px] font-semibold mb-7 text-center">{t("auth.loginTitle")}</h2>

          {error && (
            <div className="bg-danger/8 text-danger text-[13px] rounded-input p-3.5 mb-5 leading-relaxed">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">
                {t("auth.email")}
              </label>
              <input
                type="text"
                inputMode="email"
                name={"r_" + Date.now()}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                placeholder="email@example.com"
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="input-field"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">
                {t("auth.password")}
              </label>
              <input
                type="text"
                name={"r_" + Date.now()}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="input-field password-mask"
              />
            </div>
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary w-full mt-2">
              {loading ? t("loginPage.loggingIn") : t("auth.loginButton")}
            </button>
          </div>

          <div className="my-7 flex items-center gap-4">
            <div className="flex-1 h-px bg-border-light" />
            <span className="text-[12px] text-text-tertiary">{t("auth.or")}</span>
            <div className="flex-1 h-px bg-border-light" />
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => handleSocialLogin("google")}
              className="w-full py-3.5 border border-border-default rounded-button text-[14px] font-medium hover:bg-bg-secondary transition-colors flex items-center justify-center gap-2.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {t("auth.googleLogin")}
            </button>
            <button
              onClick={() => handleSocialLogin("kakao")}
              className="w-full py-3.5 bg-[#FEE500] text-[#191919] rounded-button text-[14px] font-medium hover:bg-[#FDD835] transition-colors flex items-center justify-center gap-2.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.65 1.74 4.97 4.36 6.33-.14.51-.9 3.27-.93 3.48 0 0-.02.16.08.22.1.06.22.01.22.01.29-.04 3.37-2.2 3.9-2.57.77.11 1.57.17 2.37.17 5.52 0 10-3.36 10-7.5S17.52 3 12 3z" fill="#191919"/></svg>
              {t("auth.kakaoLogin")}
            </button>
          </div>

          {/* Separator */}
          <div className="my-5 flex items-center gap-4">
            <div className="flex-1 h-px bg-border-light" />
            <span className="text-[12px] text-text-tertiary">{t("loginPage.tryIt")}</span>
            <div className="flex-1 h-px bg-border-light" />
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-3.5 border border-dashed border-primary/30 text-primary rounded-button text-[14px] font-medium hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {t("loginPage.guestLogin")}
          </button>

          <p className="text-center text-[13px] text-text-secondary mt-7">
            {t("auth.noAccount")}{" "}
            <Link href="/auth/register" className="text-primary font-semibold">
              {t("common.register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
