"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import api from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { t } = useT();
  const [form, setForm] = useState({
    email: "",
    nickname: "",
    password1: "",
    password2: "",
  });
  const [agreements, setAgreements] = useState({
    age_14: false,
    terms: false,
    privacy: false,
    location_terms: false,
    location_privacy: false,
    marketing: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requiredAllChecked =
    agreements.age_14 &&
    agreements.terms &&
    agreements.privacy &&
    agreements.location_terms &&
    agreements.location_privacy;
  const everyChecked = requiredAllChecked && agreements.marketing;

  const toggleAll = () => {
    const next = !everyChecked;
    setAgreements({
      age_14: next,
      terms: next,
      privacy: next,
      location_terms: next,
      location_privacy: next,
      marketing: next,
    });
  };

  function getPasswordStrength(password: string): { level: number; label: string; color: string } {
    if (!password) return { level: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: t("register.strengthWeak"), color: "bg-red-400" };
    if (score <= 2) return { level: 2, label: t("register.strengthFair"), color: "bg-yellow-400" };
    if (score <= 3) return { level: 3, label: t("register.strengthGood"), color: "bg-blue-400" };
    return { level: 4, label: t("register.strengthStrong"), color: "bg-green-500" };
  }

  const passwordStrength = useMemo(() => getPasswordStrength(form.password1), [form.password1, t]);

  const updateField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(e);

  const handleSubmit = async () => {
    setError("");

    if (!isValidEmail(form.email)) {
      setError("올바른 이메일 주소를 입력해주세요");
      return;
    }
    if (!form.nickname.trim()) {
      setError(t("register.nicknameRequired"));
      return;
    }

    if (form.password1.length < 8) {
      setError(t("register.passwordMinLength"));
      return;
    }

    if (form.password1 !== form.password2) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    if (!requiredAllChecked) {
      setError("필수 약관에 모두 동의해주세요.");
      return;
    }

    setLoading(true);
    try {
      const username = form.email.split("@")[0] + "_" + Date.now().toString(36);
      const { data } = await api.post(
        "/auth/register/",
        {
          ...form,
          username,
          agree_age_14: agreements.age_14,
          agree_terms: agreements.terms,
          agree_privacy: agreements.privacy,
          agree_location_terms: agreements.location_terms,
          agree_location_privacy: agreements.location_privacy,
          agree_marketing: agreements.marketing,
        },
        { _silent: true } as any,
      );
      const { data: user } = await api.get("/auth/me/", {
        headers: { Authorization: `Bearer ${data.access}` },
      });
      login(user, data.access, data.refresh);
      router.push("/");
    } catch (err: any) {
      const errors = err.response?.data;
      if (errors) {
        const firstError = Object.values(errors).flat()[0] as string;
        setError(firstError || t("auth.registerFailed"));
      } else {
        setError(t("auth.registerFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="md:pt-16 min-h-screen flex items-center justify-center px-5 bg-warm">
      <div className="w-full max-w-[400px]">
        {/* Brand header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-[20px] mb-4">
            <span className="text-2xl text-white font-bold font-en">M</span>
          </div>
          <h1 className="text-[28px] font-bold text-text-primary tracking-tight">{t("register.joinTitle")}</h1>
          <p className="text-text-secondary text-[15px] mt-1.5">{t("register.joinSubtitle")}</p>
        </div>

        <div className="card p-7">
          {error && (
            <div className="bg-danger/8 text-danger text-[13px] rounded-input p-3.5 mb-5 leading-relaxed flex items-start gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 mt-0.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">{t("auth.email")}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="email@example.com"
                required
                autoComplete="off"
                className="input-field"
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">
                {t("auth.nickname")} <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => updateField("nickname", e.target.value)}
                placeholder={t("auth.nicknamePlaceholder")}
                required
                maxLength={50}
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="input-field"
              />
              <p className="text-[11px] text-text-tertiary mt-1.5">{t("register.nicknameHelp")}</p>
            </div>

            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">{t("auth.password")}</label>
              <input
                type="password"
                value={form.password1}
                onChange={(e) => updateField("password1", e.target.value)}
                placeholder={t("register.passwordPlaceholder")}
                required
                autoComplete="off"
                className="input-field"
              />
              {/* Password strength indicator */}
              {form.password1 && (
                <div className="mt-2.5">
                  <div className="flex gap-1.5 mb-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                          i <= passwordStrength.level ? passwordStrength.color : "bg-border-light"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-[11px] font-medium ${
                    passwordStrength.level <= 1 ? "text-red-400" :
                    passwordStrength.level <= 2 ? "text-yellow-500" :
                    passwordStrength.level <= 3 ? "text-blue-400" :
                    "text-green-500"
                  }`}>
                    {t("register.passwordStrength")}: {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">{t("auth.passwordConfirm")}</label>
              <input
                type="password"
                value={form.password2}
                onChange={(e) => updateField("password2", e.target.value)}
                placeholder={t("register.passwordConfirmPlaceholder")}
                required
                autoComplete="off"
                className="input-field"
              />
              {form.password2 && form.password1 !== form.password2 && (
                <p className="text-[11px] text-danger mt-1.5">{t("auth.passwordMismatch")}</p>
              )}
              {form.password2 && form.password1 === form.password2 && (
                <p className="text-[11px] text-green-500 mt-1.5">{t("register.passwordMatch")}</p>
              )}
            </div>

            {/* Consent block (Korean-standard signup flow) */}
            <div className="mt-3 rounded-[14px] border border-gray-200 bg-white/60 p-4 space-y-2 text-[13px]">
              <label className="flex items-center gap-3 pb-2 border-b border-gray-100 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={everyChecked}
                  onChange={toggleAll}
                />
                <span className="font-semibold text-text-primary">전체 동의</span>
              </label>
              <ConsentRow
                label="만 14세 이상입니다"
                required
                checked={agreements.age_14}
                onChange={(v) => setAgreements((a) => ({ ...a, age_14: v }))}
              />
              <ConsentRow
                label="이용약관 동의"
                required
                href="/terms"
                checked={agreements.terms}
                onChange={(v) => setAgreements((a) => ({ ...a, terms: v }))}
              />
              <ConsentRow
                label="개인정보처리방침 동의"
                required
                href="/privacy"
                checked={agreements.privacy}
                onChange={(v) => setAgreements((a) => ({ ...a, privacy: v }))}
              />
              <ConsentRow
                label="위치기반서비스 이용약관 동의"
                required
                href="/terms/location"
                checked={agreements.location_terms}
                onChange={(v) => setAgreements((a) => ({ ...a, location_terms: v }))}
              />
              <ConsentRow
                label="개인위치정보 처리방침 동의"
                required
                href="/privacy/location"
                checked={agreements.location_privacy}
                onChange={(v) => setAgreements((a) => ({ ...a, location_privacy: v }))}
              />
              <ConsentRow
                label="마케팅 정보 수신 동의"
                href="/terms/marketing"
                checked={agreements.marketing}
                onChange={(v) => setAgreements((a) => ({ ...a, marketing: v }))}
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                loading ||
                !form.email ||
                !form.nickname ||
                !form.password1 ||
                !form.password2 ||
                !requiredAllChecked
              }
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
                  </svg>
                  {t("register.submitting")}
                </span>
              ) : (
                t("auth.registerButton")
              )}
            </button>
          </div>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-light" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[12px] text-text-tertiary">{t("auth.or")}</span>
            </div>
          </div>

          <p className="text-center text-[13px] text-text-secondary">
            {t("auth.hasAccount")}{" "}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              {t("common.login")}
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-text-tertiary mt-6 leading-relaxed">
          가입 완료 시 위 동의 내역은 감사 로그에 기록됩니다.
        </p>
      </div>
    </div>
  );
}

function ConsentRow({
  label,
  required,
  href,
  checked,
  onChange,
}: {
  label: string;
  required?: boolean;
  href?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
        <input
          type="checkbox"
          className="w-4 h-4 accent-primary shrink-0"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="truncate">
          <span
            className={`text-[11px] font-semibold mr-1.5 ${
              required ? "text-danger" : "text-text-tertiary"
            }`}
          >
            [{required ? "필수" : "선택"}]
          </span>
          <span className="text-text-secondary">{label}</span>
        </span>
      </label>
      {href && (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-text-tertiary underline shrink-0"
        >
          보기
        </Link>
      )}
    </div>
  );
}
