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
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const openDropdown = (key: string) => {
    if (expandedFilter === key) {
      setIsAnimating(false);
      setTimeout(() => setExpandedFilter(null), 150);
      return;
    }
    const btn = buttonRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      // Clamp left so dropdown doesn't overflow right edge of viewport
      const maxLeft = typeof window !== "undefined" ? window.innerWidth - 180 : rect.left;
      setDropdownPos({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, maxLeft)) });
    }
    setExpandedFilter(key);
    // Trigger enter animation on next frame
    requestAnimationFrame(() => setIsAnimating(true));
  };

  const closeDropdown = () => {
    setIsAnimating(false);
    setTimeout(() => setExpandedFilter(null), 150);
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
              className={cn("w-3 h-3 transition-transform duration-200", expandedFilter === filter.key && "rotate-180")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Dropdown portal -- fixed position so it's not clipped by overflow */}
      {expandedFilter && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={closeDropdown} />
          <div
            className={cn(
              "fixed z-[100] bg-white dark:bg-gray-900 rounded-[14px] p-1.5 min-w-[160px] max-h-[240px] overflow-y-auto",
              "border border-gray-100 dark:border-gray-700",
              "shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]",
              "transition-all duration-150 ease-out origin-top",
              isAnimating
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 -translate-y-1"
            )}
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {filters
              .find((f) => f.key === expandedFilter)
              ?.options.map((opt) => {
                const isActive = selected[expandedFilter] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(expandedFilter, opt.value);
                      closeDropdown();
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[13px] rounded-[10px] transition-colors flex items-center gap-2",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-text-primary hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    <span className={isActive ? "" : "pl-[22px]"}>{opt.label}</span>
                  </button>
                );
              })}
          </div>
        </>
      )}
    </>
  );
}
