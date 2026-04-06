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

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(e);

  const handleSubmit = async (e?: any) => {
    if (e?.preventDefault) e.preventDefault();
    if (!email || !password) return;
    if (!isValidEmail(email)) { setError("올바른 이메일 주소를 입력해주세요"); setLoading(false); return; }
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
          <h1 className="text-[28px] font-bold text-primary tracking-tight" style={{ fontFamily: "'DM Sans', 'Sora', sans-serif" }}>Moru</h1>
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
                type="password"
                name={"r_" + Date.now()}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="input-field"
              />
            </div>
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary w-full mt-2">
              {loading ? t("loginPage.loggingIn") : t("auth.loginButton")}
            </button>
          </div>

          <div className="my-7 flex items-center gap-4">
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
