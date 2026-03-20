import { STRATEGY_LABELS, STRATEGY_COLORS } from "@/lib/constants";

export function StrategyBadge({ type }: { type: string | null }) {
  const key = type ?? "unknown";
  const colors = STRATEGY_COLORS[key] ?? STRATEGY_COLORS["unknown"]!;
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {STRATEGY_LABELS[key] ?? key}
    </span>
  );
}
