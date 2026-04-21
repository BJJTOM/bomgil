"use client";

import { useState } from "react";
import type { TrailConditionReport, TrailConditionTag } from "@/types";
import type { Language } from "@/stores/language";

// ─── Tag config: icon + multilingual labels ─────────────────────────────────

interface TagMeta {
  icon: string;
  label: Record<Language, string>;
  severity: "good" | "warning" | "danger";
}

const TAG_CONFIG: Record<TrailConditionTag, TagMeta> = {
  clear: {
    icon: "\u2705",
    label: { ko: "\uC0C1\uD0DC \uC591\uD638", en: "Clear", ja: "\u826F\u597D", zh: "\u72B6\u6001\u826F\u597D" },
    severity: "good",
  },
  muddy: {
    icon: "\uD83D\uDFE4",
    label: { ko: "\uC9C4\uD759/\uBBF8\uB044\uB7EC\uC6C0", en: "Muddy", ja: "\u6CE5\u6CA5", zh: "\u6CE5\u6CDE" },
    severity: "warning",
  },
  icy: {
    icon: "\uD83E\uDDCA",
    label: { ko: "\uBE59\uD310", en: "Icy", ja: "\u51CD\u7D50", zh: "\u7ED3\u51B0" },
    severity: "warning",
  },
  overgrown: {
    icon: "\uD83C\uDF3F",
    label: { ko: "\uD480 \uC6B0\uAC70\uC9D0", en: "Overgrown", ja: "\u8349\u304C\u8302\u3063\u3066\u3044\u308B", zh: "\u6742\u8349\u4E1B\u751F" },
    severity: "warning",
  },
  flooded: {
    icon: "\uD83C\uDF0A",
    label: { ko: "\uCE68\uC218", en: "Flooded", ja: "\u6D78\u6C34", zh: "\u6D78\u6C34" },
    severity: "danger",
  },
  closed: {
    icon: "\uD83D\uDEAB",
    label: { ko: "\uD1B5\uD589 \uBD88\uAC00", en: "Closed", ja: "\u901A\u884C\u7981\u6B62", zh: "\u7981\u6B62\u901A\u884C" },
    severity: "danger",
  },
  construction: {
    icon: "\uD83D\uDEA7",
    label: { ko: "\uACF5\uC0AC \uC911", en: "Construction", ja: "\u5DE5\u4E8B\u4E2D", zh: "\u65BD\u5DE5\u4E2D" },
    severity: "warning",
  },
  fallen_trees: {
    icon: "\uD83C\uDF33",
    label: { ko: "\uC4F0\uB7EC\uC9C4 \uB098\uBB34", en: "Fallen trees", ja: "\u5012\u6728", zh: "\u5012\u6811" },
    severity: "warning",
  },
  bugs: {
    icon: "\uD83E\uDD9F",
    label: { ko: "\uBC8C\uB808 \uC8FC\uC758", en: "Bugs", ja: "\u866B\u6CE8\u610F", zh: "\u6CE8\u610F\u866B\u5B50" },
    severity: "warning",
  },
  crowded: {
    icon: "\uD83D\uDC65",
    label: { ko: "\uD63C\uC7A1", en: "Crowded", ja: "\u6DF7\u96D1", zh: "\u62E5\u6324" },
    severity: "warning",
  },
  other: {
    icon: "\u2139\uFE0F",
    label: { ko: "\uAE30\uD0C0", en: "Other", ja: "\u305D\u306E\u4ED6", zh: "\u5176\u4ED6" },
    severity: "warning",
  },
};

// ─── Severity-based styles ──────────────────────────────────────────────────

const SEVERITY_STYLES = {
  good: {
    bg: "bg-[#E8F5E9]",
    border: "border-[#A5D6A7]",
    text: "text-[#2E7D32]",
    tagBg: "bg-[#C8E6C9]",
  },
  warning: {
    bg: "bg-[#FFF8E1]",
    border: "border-[#FFE082]",
    text: "text-[#E65100]",
    tagBg: "bg-[#FFECB3]",
  },
  danger: {
    bg: "bg-[#FFEBEE]",
    border: "border-[#EF9A9A]",
    text: "text-[#C62828]",
    tagBg: "bg-[#FFCDD2]",
  },
} as const;

// ─── Relative time formatter ────────────────────────────────────────────────

function relativeTime(dateStr: string, lang: Language): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (lang === "ko") {
    if (diffMin < 1) return "\uBC29\uAE08";
    if (diffMin < 60) return `${diffMin}\uBD84 \uC804`;
    if (diffHr < 24) return `${diffHr}\uC2DC\uAC04 \uC804`;
    return `${diffDay}\uC77C \uC804`;
  }
  if (lang === "ja") {
    if (diffMin < 1) return "\u305F\u3060\u4ECA";
    if (diffMin < 60) return `${diffMin}\u5206\u524D`;
    if (diffHr < 24) return `${diffHr}\u6642\u9593\u524D`;
    return `${diffDay}\u65E5\u524D`;
  }
  if (lang === "zh") {
    if (diffMin < 1) return "\u521A\u521A";
    if (diffMin < 60) return `${diffMin}\u5206\u949F\u524D`;
    if (diffHr < 24) return `${diffHr}\u5C0F\u65F6\u524D`;
    return `${diffDay}\u5929\u524D`;
  }
  // en
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface TrailConditionBannerProps {
  condition: TrailConditionReport | null | undefined;
  language: Language;
}

export function TrailConditionBanner({ condition, language }: TrailConditionBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!condition) return null;

  const meta = TAG_CONFIG[condition.tag] ?? TAG_CONFIG.other;
  const styles = SEVERITY_STYLES[meta.severity];
  const tagLabel = `${meta.icon} ${meta.label[language] || meta.label.en}`;
  const time = relativeTime(condition.created_at, language);
  const reporter = condition.user?.nickname ?? (language === "ko" ? "\uC775\uBA85" : "Anonymous");

  const headerLabel: Record<Language, string> = {
    ko: "\uCD5C\uADFC \uCF54\uC2A4 \uC0C1\uD0DC",
    en: "Trail Condition",
    ja: "\u6700\u65B0\u306E\u30B3\u30FC\u30B9\u72B6\u614B",
    zh: "\u6700\u65B0\u8DEF\u7EBF\u72B6\u6001",
  };

  return (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className={`w-full text-left rounded-card border ${styles.bg} ${styles.border} transition-all duration-200`}
    >
      {/* Summary line (always visible) */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        {/* Tag chip */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[12px] font-semibold ${styles.tagBg} ${styles.text}`}
        >
          {tagLabel}
        </span>

        {/* Reporter + time */}
        <span className="text-[12px] text-text-secondary truncate">
          {reporter} &middot; {time}
        </span>

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-auto flex-shrink-0 text-text-tertiary transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 animate-fade-in">
          {/* Note */}
          {condition.note && (
            <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">
              {condition.note}
            </p>
          )}

          {/* Image */}
          {condition.image && (
            <img
              src={condition.image}
              alt=""
              className="w-full max-h-[180px] object-cover rounded-[10px]"
            />
          )}

          {/* Helpful count */}
          {condition.helpful_count > 0 && (
            <p className="text-[11px] text-text-tertiary">
              {language === "ko"
                ? `${condition.helpful_count}\uBA85\uC774 \uB3C4\uC6C0\uC774 \uB410\uC5B4\uC694`
                : language === "ja"
                  ? `${condition.helpful_count}\u4EBA\u304C\u5F79\u7ACB\u3063\u305F\u3068\u8A55\u4FA1`
                  : language === "zh"
                    ? `${condition.helpful_count}\u4EBA\u89C9\u5F97\u6709\u7528`
                    : `${condition.helpful_count} found helpful`}
            </p>
          )}

          {/* Micro header */}
          <p className="text-[10px] text-text-tertiary uppercase tracking-wide pt-1">
            {headerLabel[language] || headerLabel.en}
          </p>
        </div>
      )}
    </button>
  );
}
