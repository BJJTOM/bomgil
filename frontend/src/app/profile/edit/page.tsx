"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { WALKING_STYLE_LABELS } from "@/lib/utils";
import api from "@/lib/api";

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, setUser, isAuthenticated } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    nickname: "",
    bio: "",
    one_liner: "",
    age_range: "",
    walking_style: "",
    preferred_language: "ko",
  });

  useEffect(() => {
    if (user) {
      setForm({
        nickname: user.nickname || "",
        bio: (user as any).bio || "",
        one_liner: (user as any).one_liner || "",
        age_range: (user as any).age_range || "",
        walking_style: (user as any).walking_style || "",
        preferred_language: (user as any).preferred_language || "ko",
      });
    }
  }, [user]);

  if (!isAuthenticated) {
    return (
      <div className="md:pt-[60px] flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-text-secondary">로그인이 필요합니다</p>
        </div>
      </div>
    );
  }

  const updateField = (key: string, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const { data } = await api.patch("/auth/me/", form);
      setUser(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const AGE_OPTIONS = [
    { value: "", label: "선택 안 함" },
    { value: "20s", label: "20대" },
    { value: "30s", label: "30대" },
    { value: "40s", label: "40대" },
    { value: "50s_plus", label: "50대 이상" },
  ];

  return (
    <div className="md:pt-[60px] max-w-lg mx-auto px-5 py-8">
      <h1 className="text-[22px] font-bold tracking-tight mb-8">프로필 수정</h1>

      <div className="space-y-6">
        {/* Profile image placeholder */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-accent/30 flex items-center justify-center text-4xl relative">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              "👤"
            )}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm shadow-card cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[13px] font-medium text-text-secondary block mb-2">닉네임</label>
          <input
            type="text"
            value={form.nickname}
            onChange={(e) => updateField("nickname", e.target.value)}
            maxLength={50}
            className="input-field"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-text-secondary block mb-2">한줄 소개</label>
          <input
            type="text"
            value={form.one_liner}
            onChange={(e) => updateField("one_liner", e.target.value)}
            placeholder="커피와 골목을 좋아하는 30대"
            maxLength={100}
            className="input-field"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-text-secondary block mb-2">자기소개</label>
          <textarea
            value={form.bio}
            onChange={(e) => updateField("bio", e.target.value)}
            placeholder="나를 소개해주세요"
            rows={3}
            maxLength={300}
            className="input-field resize-none"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-text-secondary block mb-2">나이대</label>
          <select
            value={form.age_range}
            onChange={(e) => updateField("age_range", e.target.value)}
            className="input-field"
          >
            {AGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[13px] font-medium text-text-secondary block mb-3">걷기 스타일</label>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(WALKING_STYLE_LABELS).map(([key, { label, emoji }]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateField("walking_style", key)}
                className={`p-3.5 rounded-button text-left transition-all ${
                  form.walking_style === key
                    ? "bg-primary-50 border-2 border-primary"
                    : "bg-bg-secondary border-2 border-transparent hover:border-border-default"
                }`}
              >
                <span className="text-lg">{emoji}</span>
                <p className={`text-[13px] mt-1 font-medium ${
                  form.walking_style === key ? "text-primary" : "text-text-secondary"
                }`}>
                  {label}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? "저장 중..." : success ? "저장 완료!" : "저장하기"}
          </button>
          <button
            onClick={() => router.back()}
            className="btn-secondary w-full"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
