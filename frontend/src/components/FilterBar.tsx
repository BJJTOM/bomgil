"use client";

import { useState, useRef, useEffect } from "react";
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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const openDropdown = (key: string) => {
    if (expandedFilter === key) {
      setExpandedFilter(null);
      return;
    }
    const btn = buttonRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: Math.max(8, rect.left) });
    }
    setExpandedFilter(key);
  };

  return (
    <>
      <div className="flex gap-1.5 scrollbar-hide flex-nowrap">
        {filters.map((filter) => (
          <button
            key={filter.key}
            ref={(el) => { buttonRefs.current[filter.key] = el; }}
            onClick={() => openDropdown(filter.key)}
            className={cn(
              "whitespace-nowrap py-1.5 px-3 text-[12px] font-medium rounded-pill flex items-center gap-1 flex-shrink-0 transition-colors",
              selected[filter.key]
                ? "bg-primary text-white"
                : "bg-bg-secondary text-text-secondary"
            )}
          >
            {selected[filter.key]
              ? filter.options.find((o) => o.value === selected[filter.key])?.label
              : filter.label}
            <svg
              className={cn("w-3 h-3 transition-transform", expandedFilter === filter.key && "rotate-180")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Dropdown portal — fixed position so it's not clipped by overflow */}
      {expandedFilter && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setExpandedFilter(null)} />
          <div
            className="fixed z-[100] bg-white rounded-[16px] shadow-float p-1.5 min-w-[150px] max-h-[280px] overflow-y-auto border border-border-light"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {filters
              .find((f) => f.key === expandedFilter)
              ?.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(expandedFilter, opt.value);
                    setExpandedFilter(null);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-[13px] rounded-[10px] transition-colors",
                    selected[expandedFilter] === opt.value
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-text-primary hover:bg-bg-secondary"
                  )}
                >
                  {opt.label}
                </button>
              ))}
          </div>
        </>
      )}
    </>
  );
}
