"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import api from "@/lib/api";

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: "취약", color: "bg-red-400" };
  if (score <= 2) return { level: 2, label: "보통", color: "bg-yellow-400" };
  if (score <= 3) return { level: 3, label: "양호", color: "bg-blue-400" };
  return { level: 4, label: "강력", color: "bg-green-500" };
}

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [form, setForm] = useState({
    email: "",
    nickname: "",
    password1: "",
    password2: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(form.password1), [form.password1]);

  const updateField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.nickname.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }

    if (form.password1.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    if (form.password1 !== form.password2) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/register/", form);
      const { data: user } = await api.get("/auth/me/", {
        headers: { Authorization: `Bearer ${data.access}` },
      });
      login(user, data.access, data.refresh);
      router.push("/");
    } catch (err: any) {
      const errors = err.response?.data;
      if (errors) {
        const firstError = Object.values(errors).flat()[0] as string;
        setError(firstError || "회원가입에 실패했습니다.");
      } else {
        setError("회원가입에 실패했습니다.");
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
            <span className="text-2xl text-white font-bold font-en">R</span>
          </div>
          <h1 className="text-[28px] font-bold text-text-primary tracking-tight">Roami에 합류하세요</h1>
          <p className="text-text-secondary text-[15px] mt-1.5">전 세계 도보여행자들과 함께 걸어요</p>
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="email@example.com"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">
                닉네임 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => updateField("nickname", e.target.value)}
                placeholder="Roami에서 사용할 닉네임"
                required
                maxLength={50}
                className="input-field"
              />
              <p className="text-[11px] text-text-tertiary mt-1.5">다른 여행자에게 보이는 이름이에요</p>
            </div>

            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">비밀번호</label>
              <input
                type="password"
                value={form.password1}
                onChange={(e) => updateField("password1", e.target.value)}
                placeholder="8자 이상, 영문/숫자/특수문자 조합"
                required
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
                    비밀번호 강도: {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-[13px] font-medium text-text-secondary block mb-2">비밀번호 확인</label>
              <input
                type="password"
                value={form.password2}
                onChange={(e) => updateField("password2", e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                required
                className="input-field"
              />
              {form.password2 && form.password1 !== form.password2 && (
                <p className="text-[11px] text-danger mt-1.5">비밀번호가 일치하지 않습니다</p>
              )}
              {form.password2 && form.password1 === form.password2 && (
                <p className="text-[11px] text-green-500 mt-1.5">비밀번호가 일치합니다</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !form.email || !form.nickname || !form.password1 || !form.password2}
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
                  </svg>
                  가입 중...
                </span>
              ) : (
                "가입하기"
              )}
            </button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-light" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[12px] text-text-tertiary">또는</span>
            </div>
          </div>

          <p className="text-center text-[13px] text-text-secondary">
            이미 계정이 있으신가요?{" "}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              로그인
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-text-tertiary mt-6 leading-relaxed">
          가입하면 Roami의{" "}
          <span className="underline cursor-pointer">이용약관</span> 및{" "}
          <span className="underline cursor-pointer">개인정보처리방침</span>에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}
