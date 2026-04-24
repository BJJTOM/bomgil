"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { globalToast, extractApiErrorMessage } from "@/lib/globalToast";

type Category = "bug" | "feature" | "ux" | "content" | "other";

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "bug", label: "버그", hint: "작동하지 않거나 이상한 동작" },
  { value: "feature", label: "기능제안", hint: "있으면 좋겠어요" },
  { value: "ux", label: "사용성", hint: "불편하거나 헷갈린 부분" },
  { value: "content", label: "코스/정보 오류", hint: "거리·좌표·설명 오류" },
  { value: "other", label: "기타", hint: "자유 의견" },
];

export default function FeedbackPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      globalToast("내용을 5자 이상 작성해 주세요.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const url =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "";
      await api.post("/community/feedback/", {
        category,
        message: message.trim(),
        email: isAuthenticated ? "" : email.trim(),
        url,
      });
      setSubmitted(true);
      setMessage("");
      setEmail("");
      globalToast("의견이 전달됐어요. 감사합니다!", "success");
    } catch (err) {
      globalToast(
        extractApiErrorMessage(err) || "전송에 실패했어요. 잠시 후 다시 시도해주세요.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="max-w-xl mx-auto px-5 py-12 min-h-[70vh]">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-border-light p-8 text-center">
          <div className="text-[48px] leading-none mb-3 select-none">💌</div>
          <h1 className="text-[20px] font-bold text-text-primary mb-2">
            의견이 전달됐어요
          </h1>
          <p className="text-[13.5px] text-text-secondary mb-6 leading-relaxed">
            빠르게 확인하고 필요하면 이메일로 답장드릴게요.
            <br />더 남기실 내용이 있다면 다시 작성해 주세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => setSubmitted(false)}
              className="inline-flex items-center justify-center rounded-full bg-primary text-white px-5 py-2.5 text-[13px] font-semibold hover:bg-primary/90 transition"
            >
              추가 의견 보내기
            </button>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-border-default text-text-primary px-5 py-2.5 text-[13px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              코스 둘러보기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-5 py-10 min-h-[70vh]">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold text-text-primary mb-1">
          의견 보내기
        </h1>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          베타 기간 동안 주시는 의견 하나하나가 정말 큰 도움이 됩니다.
          버그·제안 모두 환영해요.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-white dark:bg-gray-900 border border-border-light rounded-2xl p-5"
      >
        <div>
          <label className="block text-[12.5px] font-semibold text-text-primary mb-2">
            카테고리
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-light bg-white dark:bg-gray-900 text-text-primary hover:border-primary/40"
                  }`}
                >
                  <div className="text-[13px] font-semibold leading-tight">{c.label}</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5 leading-tight">
                    {c.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="feedback-message"
            className="block text-[12.5px] font-semibold text-text-primary mb-2"
          >
            내용
            <span className="ml-1.5 text-[11px] text-text-tertiary font-normal">
              ({message.length}/2000)
            </span>
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
            rows={7}
            placeholder="어떤 점이 불편하셨나요? 스크린샷은 이메일로 이어서 보내주셔도 좋아요."
            className="w-full rounded-xl border border-border-light bg-white dark:bg-gray-950 px-3.5 py-3 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-y"
            required
            minLength={5}
            maxLength={2000}
          />
        </div>

        {!isAuthenticated && (
          <div>
            <label
              htmlFor="feedback-email"
              className="block text-[12.5px] font-semibold text-text-primary mb-2"
            >
              이메일 <span className="text-text-tertiary font-normal">(선택)</span>
            </label>
            <input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="답장받을 이메일 (남기시면 확인 후 회신드려요)"
              className="w-full rounded-xl border border-border-light bg-white dark:bg-gray-950 px-3.5 py-2.5 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
              maxLength={254}
            />
          </div>
        )}

        {isAuthenticated && user && (
          <p className="text-[11.5px] text-text-tertiary">
            로그인 상태로 전송돼요 ({user.nickname}) — 별도 이메일 입력 불필요.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center rounded-full bg-primary text-white px-5 py-3 text-[14px] font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitting ? "보내는 중…" : "의견 보내기"}
        </button>

        <p className="text-[11px] text-text-tertiary text-center leading-relaxed">
          제출 시 현재 페이지 주소와 브라우저 정보가 함께 저장됩니다.
          <br />베타 종료 후 모든 데이터는 삭제돼요.
        </p>
      </form>
    </main>
  );
}
