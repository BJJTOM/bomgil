"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="text-[60px] leading-none mb-4 select-none">🌧️</div>
        <h1 className="text-[22px] font-bold text-text-primary mb-2">
          잠시 오류가 발생했어요
        </h1>
        <p className="text-[14px] text-text-secondary mb-6 leading-relaxed">
          요청을 처리하는 중 문제가 생겼어요. 다시 시도하거나 다른
          페이지로 이동해 주세요. 문제가 계속되면 아래 "의견 보내기"로
          알려주시면 빠르게 확인할게요.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-full bg-primary text-white px-5 py-2.5 text-[14px] font-semibold hover:bg-primary/90 transition"
          >
            다시 시도
          </button>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-border-default text-text-primary px-5 py-2.5 text-[14px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            코스 둘러보기
          </Link>
          <Link
            href="/feedback"
            className="inline-flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-border-default text-text-primary px-5 py-2.5 text-[14px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            의견 보내기
          </Link>
        </div>
        {error?.digest && (
          <p className="mt-8 text-[10.5px] font-en text-text-tertiary tracking-wider">
            ERROR ID · {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
