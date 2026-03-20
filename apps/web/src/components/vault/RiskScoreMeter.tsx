import { riskScoreColor, riskScoreLabel } from "@/lib/format";

export function RiskScoreMeter({ score }: { score: number | null }) {
  const color = riskScoreColor(score);
  const label = riskScoreLabel(score);

  return (
    <div className="flex flex-col items-center bg-surface border border-border rounded-lg px-6 py-4 min-w-28">
      <span className="text-xs text-muted uppercase tracking-wider mb-1">Risk Score</span>
      <span className={`text-4xl font-bold tabular-nums ${color}`}>
        {score?.toFixed(1) ?? "—"}
      </span>
      <span className={`text-xs mt-1 ${color}`}>{label}</span>
      <div className="mt-2 w-full bg-border rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            score == null
              ? "bg-neutral-600"
              : score <= 3
              ? "bg-teal-400"
              : score <= 6
              ? "bg-yellow-400"
              : "bg-red-400"
          }`}
          style={{ width: `${Math.min(100, ((score ?? 0) / 10) * 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-muted mt-1">1 = safest · 10 = riskiest</span>
    </div>
  );
}
