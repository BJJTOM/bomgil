"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: {
    key: string;
    label: string;
    options: FilterOption[];
  }[];
  selected: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function FilterBar({ filters, selected, onChange }: FilterBarProps) {
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-wrap">
      {filters.map((filter) => (
        <div key={filter.key} className="relative flex-shrink-0">
          <button
            onClick={() =>
              setExpandedFilter(expandedFilter === filter.key ? null : filter.key)
            }
            className={cn(
              selected[filter.key] ? "chip-active" : "chip"
            )}
          >
            {selected[filter.key]
              ? filter.options.find((o) => o.value === selected[filter.key])?.label
              : filter.label}
            <svg
              className={cn(
                "w-3.5 h-3.5 ml-1 transition-transform",
                expandedFilter === filter.key && "rotate-180"
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedFilter === filter.key && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setExpandedFilter(null)}
              />
              <div className="absolute top-full left-0 mt-2 z-50 bg-surface rounded-card shadow-float p-2 min-w-[120px]">
                <button
                  onClick={() => {
                    onChange(filter.key, "");
                    setExpandedFilter(null);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-input transition-colors",
                    !selected[filter.key]
                      ? "bg-accent/15 text-primary font-medium"
                      : "text-text-secondary hover:bg-[#F5F6F7]"
                  )}
                >
                  전체
                </button>
                {filter.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(filter.key, opt.value);
                      setExpandedFilter(null);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-input transition-colors",
                      selected[filter.key] === opt.value
                        ? "bg-accent/15 text-primary font-medium"
                        : "text-text-secondary hover:bg-[#F5F6F7]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
      {Object.values(selected).some(Boolean) && (
        <button
          onClick={() =>
            filters.forEach((f) => onChange(f.key, ""))
          }
          className="flex-shrink-0 chip text-text-tertiary hover:text-danger transition-colors"
        >
          초기화
        </button>
      )}
    </div>
  );
}
