import { cn, DIFFICULTY_CONFIG } from "@/lib/utils";

interface DifficultyBadgeProps {
  difficulty: "easy" | "moderate" | "hard";
  className?: string;
}

const BADGE_STYLES = {
  easy: "bg-green-50 text-green-700 border-green-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  hard: "bg-red-50 text-red-700 border-red-200",
} as const;

const DOT_COLORS = {
  easy: "bg-green-500",
  moderate: "bg-amber-500",
  hard: "bg-red-500",
} as const;

export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  const config = DIFFICULTY_CONFIG[difficulty];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-semibold border",
        BADGE_STYLES[difficulty],
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", DOT_COLORS[difficulty])} />
      {config.label}
    </span>
  );
}
