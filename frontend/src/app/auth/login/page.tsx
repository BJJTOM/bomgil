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
  const [showPassword, setShowPassword] = useState(false);

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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name={"r_" + Date.now()}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  className="input-field pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  {showPassword ? "숨기기" : "보기"}
                </button>
              </div>
            </div>
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary w-full mt-2">
              {loading ? t("loginPage.loggingIn") : t("auth.loginButton")}
            </button>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border-light" />
              <span className="text-[12px] text-text-tertiary">또는</span>
              <div className="flex-1 h-px bg-border-light" />
            </div>
            <Link
              href="/auth/phone"
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary rounded-button text-[14px] font-bold hover:bg-primary/15 transition-colors"
            >
              <span className="text-[16px]">📱</span>
              전화번호로 시작하기
            </Link>
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full mt-2 py-2.5 border border-border-default rounded-button text-[14px] font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              게스트로 둘러보기
            </button>
          </div>

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
