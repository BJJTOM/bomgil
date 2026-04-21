"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useLanguageStore, type Language } from "@/stores/language";

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------
const T: Record<string, Record<Language, string>> = {
  title: {
    ko: "이번 주 활동 리포트",
    en: "Weekly Activity Report",
    ja: "今週のアクティビティレポート",
    zh: "本周活动报告",
  },
  aiPowered: {
    ko: "AI 코칭",
    en: "AI Coaching",
    ja: "AIコーチング",
    zh: "AI教练",
  },
  goalLabel: {
    ko: "주간 목표",
    en: "Weekly Goal",
    ja: "週間目標",
    zh: "周目标",
  },
  suggestion: {
    ko: "추천",
    en: "Suggestion",
    ja: "おすすめ",
    zh: "推荐",
  },
  showMore: {
    ko: "자세히 보기",
    en: "Show more",
    ja: "詳しく見る",
    zh: "查看更多",
  },
  showLess: {
    ko: "접기",
    en: "Show less",
    ja: "閉じる",
    zh: "收起",
  },
  viewTrail: {
    ko: "코스 보기",
    en: "View Trail",
    ja: "コースを見る",
    zh: "查看路线",
  },
};

function t(key: string, lang: Language): string {
  return T[key]?.[lang] || T[key]?.ko || key;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface InsightsData {
  summary: string;
  highlights: string[];
  suggestion: string;
  suggested_trail_id: number | null;
  goal_progress: number;
  trend: "improving" | "stable" | "declining";
}

// ---------------------------------------------------------------------------
// Trend indicator
// ---------------------------------------------------------------------------
function TrendBadge({ trend }: { trend: string }) {
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      </span>
    );
  }
  if (trend === "declining") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-gray-100 text-gray-400 dark:bg-white/[0.08] dark:text-white/50">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function WeeklyInsights() {
  const { isAuthenticated } = useAuthStore();
  const { language } = useLanguageStore();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery<InsightsData>({
    queryKey: ["weekly-insights"],
    queryFn: async () => (await api.get("/activities/weekly-insights/")).data,
    enabled: isAuthenticated,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-4 bg-border-light rounded w-2/3 mb-3" />
        <div className="h-3 bg-border-light rounded w-full mb-2" />
        <div className="h-2 bg-border-light rounded w-full" />
      </div>
    );
  }

  if (error || !data || !data.summary) return null;

  const goalPct = Math.round(data.goal_progress * 100);
  const hasHighlights = data.highlights && data.highlights.length > 0;
  const hasSuggestion = !!data.suggestion;

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[11px] bg-primary-50 dark:bg-emerald-500/10 flex items-center justify-center text-[18px]">
              {"✨"}
            </div>
            <div>
              <h3 className="text-[15px] font-bold tracking-tight">
                {t("title", language)}
              </h3>
              <p className="text-[11px] text-text-tertiary font-medium">
                {t("aiPowered", language)}
              </p>
            </div>
          </div>
          <TrendBadge trend={data.trend} />
        </div>

        {/* Summary */}
        <p className="text-[14px] font-medium leading-[1.5] mb-4">
          {data.summary}
        </p>

        {/* Goal progress */}
        <div className="mb-1">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[12px] text-text-tertiary font-medium">
              {t("goalLabel", language)}
            </span>
            <span
              className={`text-[12px] font-bold ${
                goalPct >= 100
                  ? "text-emerald-500 dark:text-emerald-400"
                  : "text-text-secondary"
              }`}
            >
              {goalPct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-border-light dark:bg-white/[0.08] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                goalPct >= 100
                  ? "bg-emerald-500 dark:bg-emerald-400"
                  : "bg-primary dark:bg-emerald-400"
              }`}
              style={{ width: `${Math.min(goalPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Expandable details */}
        {(hasHighlights || hasSuggestion) && (
          <>
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                expanded ? "max-h-[400px] opacity-100 mt-4" : "max-h-0 opacity-0"
              }`}
            >
              {/* Highlights */}
              {hasHighlights && (
                <ul className="space-y-1.5 mb-4">
                  {data.highlights.map((h, idx) => (
                    <li
                      key={`highlight-${idx}-${h.slice(0, 20)}`}
                      className="flex items-start gap-2 text-[13px] text-text-secondary leading-[1.5]"
                    >
                      <span className="text-primary dark:text-emerald-400 font-bold mt-[1px]">
                        {"\u2022"}
                      </span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Suggestion */}
              {hasSuggestion && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary-50 dark:bg-emerald-500/[0.08]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary dark:text-emerald-400 flex-shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                  <p className="text-[13px] font-medium leading-[1.4]">
                    {data.suggestion}
                  </p>
                </div>
              )}

              {/* Trail link */}
              {data.suggested_trail_id && (
                <Link
                  href={`/trails/${data.suggested_trail_id}`}
                  className="flex items-center justify-center gap-1.5 mt-3 py-2.5 rounded-xl border border-border-default text-[13px] font-semibold text-primary dark:text-emerald-400 hover:bg-primary-50 dark:hover:bg-emerald-500/[0.08] transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {t("viewTrail", language)}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              )}
            </div>

            {/* Toggle */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center gap-1 w-full mt-3 py-1 text-[13px] font-medium text-primary dark:text-emerald-400 hover:opacity-80 transition-opacity"
            >
              {expanded ? t("showLess", language) : t("showMore", language)}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
