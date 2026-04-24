"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

type Step = "phone" | "code" | "nickname";

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isValidKoreanPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(digits);
}

export default function PhoneAuthPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const verificationTokenRef = useRef<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on step change
  useEffect(() => {
    setError("");
    if (step === "phone") setTimeout(() => phoneInputRef.current?.focus(), 50);
    else if (step === "code") setTimeout(() => codeInputRef.current?.focus(), 50);
    else if (step === "nickname") setTimeout(() => nicknameInputRef.current?.focus(), 50);
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSendCode = async () => {
    setError("");
    if (!phone.trim()) {
      setError("전화번호를 입력해주세요.");
      return;
    }
    if (!isValidKoreanPhone(phone)) {
      setError("올바른 휴대폰 번호를 입력해주세요. 예: 010-1234-5678");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/phone/otp/send/", { phone_number: phone });
      setCode("");
      setStep("code");
      setResendCooldown(30);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "인증번호 전송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    if (!code.trim() || code.length !== 6) {
      setError("6자리 인증번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      // Step A: verify OTP, get single-use verification token.
      // The server does not reveal user existence here (anti-enumeration).
      const { data } = await api.post("/auth/phone/otp/verify/", {
        phone_number: phone,
        code,
      });
      verificationTokenRef.current = data.verification_token;

      // Step B: try /complete/ without nickname.
      // - Existing user → login succeeds.
      // - New user → 400 with code: "nickname_required" → show nickname step.
      try {
        const { data: loginData } = await api.post("/auth/phone/otp/complete/", {
          verification_token: data.verification_token,
        });
        login(loginData.user, loginData.access, loginData.refresh);
        router.push("/");
      } catch (completeErr: any) {
        if (completeErr?.response?.data?.code === "nickname_required") {
          setStep("nickname");
        } else {
          throw completeErr;
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "인증번호가 일치하지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNickname = async () => {
    setError("");
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError("닉네임은 2자 이상이어야 합니다.");
      return;
    }
    if (trimmed.length > 20) {
      setError("닉네임은 20자 이하여야 합니다.");
      return;
    }
    if (!verificationTokenRef.current) {
      setError("인증이 만료되었습니다. 처음부터 다시 시도해주세요.");
      setStep("phone");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/phone/otp/complete/", {
        verification_token: verificationTokenRef.current,
        nickname: trimmed,
      });
      login(data.user, data.access, data.refresh);
      router.push("/");
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "phone") {
      router.back();
    } else if (step === "code") {
      setStep("phone");
    } else if (step === "nickname") {
      setStep("code");
    }
  };

  return (
    <div className="md:pt-[60px] min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-5 py-4 flex items-center">
        <button onClick={handleBack} className="w-9 h-9 -ml-1 flex items-center justify-center" aria-label="뒤로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-primary)" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      <main className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full">
        {step === "phone" && (
          <>
            <h1 className="text-[26px] font-bold text-gray-900 mb-3">전화번호로 시작하기</h1>
            <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
              가입 또는 로그인을 위해<br />
              전화번호를 입력해주세요.
            </p>

            <div className="mb-5">
              <label className="text-[12px] font-semibold text-gray-400 block mb-2">전화번호</label>
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                placeholder="010-1234-5678"
                maxLength={13}
                className="w-full text-[18px] py-2.5 border-b-[1.5px] border-gray-200 focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            {error && <p className="text-[13px] text-red-500 mb-3">{error}</p>}

            <p className="text-[11px] text-gray-400 leading-relaxed mb-auto">
              계속하면 모루의{" "}
              <Link href="/terms" className="underline">서비스 이용약관</Link> 및{" "}
              <Link href="/privacy" className="underline">개인정보처리방침</Link>에 동의하는 것으로 간주됩니다.
            </p>

            <button
              type="button"
              onClick={handleSendCode}
              disabled={!phone || loading}
              className="bg-primary text-white text-[16px] font-bold py-4 rounded-[14px] mb-6 mt-8 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  전송 중...
                </span>
              ) : (
                "인증번호 받기"
              )}
            </button>
          </>
        )}

        {step === "code" && (
          <>
            <h1 className="text-[26px] font-bold text-gray-900 mb-3">인증번호 입력</h1>
            <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
              {phone}<br />
              로 전송된 6자리 인증번호를 입력해주세요.
            </p>

            <div className="mb-3">
              <label className="text-[12px] font-semibold text-gray-400 block mb-2">인증번호</label>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                placeholder="000000"
                maxLength={6}
                className="w-full text-[24px] py-2.5 text-center tracking-[8px] font-en border-b-[1.5px] border-gray-200 focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            {error && <p className="text-[13px] text-red-500 mb-3">{error}</p>}

            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading || resendCooldown > 0}
              className="text-[13px] text-primary font-semibold disabled:text-gray-400 self-start mb-auto"
            >
              {resendCooldown > 0 ? `다시 받기 (${resendCooldown}초)` : "인증번호 다시 받기"}
            </button>

            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={code.length !== 6 || loading}
              className="bg-primary text-white text-[16px] font-bold py-4 rounded-[14px] mb-6 mt-8 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  확인 중...
                </span>
              ) : (
                "확인"
              )}
            </button>
          </>
        )}

        {step === "nickname" && (
          <>
            <h1 className="text-[26px] font-bold text-gray-900 mb-3">닉네임 설정</h1>
            <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
              모루에서 사용할 닉네임을 입력해주세요.
            </p>

            <div className="mb-5">
              <label className="text-[12px] font-semibold text-gray-400 block mb-2">닉네임</label>
              <input
                ref={nicknameInputRef}
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetNickname()}
                placeholder="2~20자"
                maxLength={20}
                className="w-full text-[18px] py-2.5 border-b-[1.5px] border-gray-200 focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            {error && <p className="text-[13px] text-red-500 mb-3">{error}</p>}

            <div className="mb-auto" />

            <button
              type="button"
              onClick={handleSetNickname}
              disabled={nickname.trim().length < 2 || loading}
              className="bg-primary text-white text-[16px] font-bold py-4 rounded-[14px] mb-6 mt-8 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  가입 중...
                </span>
              ) : (
                "모루 시작하기"
              )}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
