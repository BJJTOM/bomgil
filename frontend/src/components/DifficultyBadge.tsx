import { cn, DIFFICULTY_CONFIG } from "@/lib/utils";

interface DifficultyBadgeProps {
  difficulty: "easy" | "moderate" | "hard";
  className?: string;
}

const BADGE_STYLES = {
  easy: "bg-[#E8F5E9] text-[#2E7D32]",
  moderate: "bg-[#FFF3E0] text-[#E65100]",
  hard: "bg-[#FFEBEE] text-[#C62828]",
} as const;

export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  const config = DIFFICULTY_CONFIG[difficulty];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-[11px] font-semibold",
        BADGE_STYLES[difficulty],
        className
      )}
    >
      {config.emoji} {config.label}
    </span>
  );
}
