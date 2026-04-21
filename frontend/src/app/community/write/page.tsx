"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/stores/language";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { Trail } from "@/types";

export default function CommunityWritePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { t } = useT();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("happy");
  const [trailId, setTrailId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const MOODS = [
    { value: "happy", emoji: "😊", labelKey: "community.moodHappy" },
    { value: "peaceful", emoji: "☮️", labelKey: "community.moodPeaceful" },
    { value: "exciting", emoji: "🤩", labelKey: "community.moodExciting" },
    { value: "touching", emoji: "🥹", labelKey: "community.moodTouching" },
    { value: "funny", emoji: "😄", labelKey: "community.moodFunny" },
  ];

  const { data: trails = [] } = useQuery<Trail[]>({
    queryKey: ["my-trails-for-story"],
    queryFn: async () => {
      const { data } = await api.get("/trails/");
      return data.results ?? data;
    },
  });

  const selectedTrail = trails.find((tr: Trail) => tr.id === trailId);

  const handleAiGenerate = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setError("");
    try {
      const { data } = await api.post("/stories/ai/generate/", {
        trail_title: selectedTrail?.title || "",
        distance_km: selectedTrail?.distance_km || 0,
        mood,
        user_notes: content.trim(),
        language: "ko",
        photo_count: 0,
      });
      if (data.content) {
        setContent(data.content);
      }
      if (data.title_suggestion && !title.trim()) {
        setTitle(data.title_suggestion);
      }
    } catch (err: any) {
      const msg =
        err?.response?.status === 429
          ? "AI 사용 횟수를 초과했어요. 잠시 후 다시 시도해주세요."
          : "AI 이야기 생성에 실패했어요. 다시 시도해주세요.";
      setError(msg);
    } finally {
      setAiLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-warm flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-semibold">{t("community.loginRequired")}</p>
          <a href="/auth/login" className="btn-primary mt-4 inline-block">{t("common.login")}</a>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError(t("community.contentRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/stories/create/", {
        title: title.trim(),
        content: content.trim(),
        mood,
        trail: trailId,
        is_public: true,
      });
      router.push("/community");
    } catch (err: any) {
      setError(err.response?.data?.detail || t("community.postFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm pb-24 pt-14 md:pt-20">
      <div className="max-w-2xl mx-auto px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="text-text-secondary text-[14px] flex items-center gap-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            {t("community.cancel")}
          </button>
          <h1 className="text-[17px] font-bold">{t("community.write")}</h1>
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="text-primary font-semibold text-[14px] disabled:text-text-tertiary"
          >
            {submitting ? t("community.posting") : t("community.writePost")}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 text-[13px] rounded-card p-3 mb-4">{error}</div>
        )}

        {/* Title */}
        <div className="card p-4 mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("community.titlePlaceholder")}
            maxLength={100}
            className="w-full text-[17px] font-bold bg-transparent border-none outline-none placeholder:text-text-tertiary"
          />
        </div>

        {/* Content */}
        <div className="card p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              {aiLoading ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <span>&#10024;</span>
              )}
              {aiLoading ? "AI가 이야기를 작성하고 있어요..." : "AI 도움받기"}
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("community.contentPlaceholder")}
            rows={10}
            maxLength={2000}
            className="w-full text-[14px] bg-transparent border-none outline-none resize-none placeholder:text-text-tertiary leading-relaxed"
          />
          <div className="text-right text-[11px] text-text-tertiary mt-2">{content.length}/2000</div>
        </div>

        {/* Mood selection */}
        <div className="card p-4 mb-3">
          <label className="text-[13px] font-semibold text-text-secondary mb-3 block">{t("community.moodQuestion")}</label>
          <div className="flex gap-2 flex-wrap">
            {MOODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMood(m.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[12px] font-medium transition-all ${
                  mood === m.value
                    ? "bg-primary text-white"
                    : "bg-bg-secondary text-text-secondary hover:bg-border-light"
                }`}
              >
                <span>{m.emoji}</span>
                {t(m.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Trail selection (optional) */}
        <div className="card p-4 mb-4">
          <label className="text-[13px] font-semibold text-text-secondary mb-2 block">{t("community.trailQuestion")}</label>
          <select
            value={trailId || ""}
            onChange={(e) => setTrailId(e.target.value ? Number(e.target.value) : null)}
            className="input-field text-[14px]"
          >
            <option value="">{t("community.noTrailSelected")}</option>
            {trails.map((tr: Trail) => (
              <option key={tr.id} value={tr.id}>{tr.title} — {tr.region}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
