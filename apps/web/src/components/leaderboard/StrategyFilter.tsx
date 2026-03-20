"use client";

import { STRATEGY_LABELS, STRATEGY_COLORS } from "@/lib/constants";

type Props = {
  strategies: string[];
  active: string;
  onChange: (strategy: string) => void;
};

export function StrategyFilter({ strategies, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange("all")}
        className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
          active === "all"
            ? "bg-teal-900 text-teal-300 border-teal-700"
            : "bg-surface text-neutral-400 border-border hover:text-slate-200"
        }`}
      >
        All
      </button>
      {strategies.map((s) => {
        const colors = STRATEGY_COLORS[s] ?? STRATEGY_COLORS["unknown"]!;
        const isActive = active === s;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              isActive
                ? `${colors.bg} ${colors.text} ${colors.border}`
                : "bg-surface text-neutral-400 border-border hover:text-slate-200"
            }`}
          >
            {STRATEGY_LABELS[s] ?? s}
          </button>
        );
      })}
    </div>
  );
}
