import Link from "next/link";
import type { VaultSearchResult } from "@openvault/db";
import { formatPercent, formatAddress, riskScoreColor } from "@/lib/format";
import { STRATEGY_LABELS, STRATEGY_COLORS } from "@/lib/constants";

export function SearchResults({
  results,
  query,
}: {
  results: VaultSearchResult[];
  query: string;
}) {
  if (!query || query.length < 2) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        Type at least 2 characters to search.
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        No vaults found for &ldquo;{query}&rdquo;.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
      {results.map((vault) => {
        const strategyKey = vault.strategyType ?? "unknown";
        const colors = STRATEGY_COLORS[strategyKey] ?? STRATEGY_COLORS["unknown"]!;
        const returnIsPositive = vault.annualizedReturn != null && vault.annualizedReturn > 0;
        const returnIsNegative = vault.annualizedReturn != null && vault.annualizedReturn < 0;

        return (
          <Link
            key={vault.vaultAddress}
            href={`/vault/${vault.vaultAddress}`}
            className="flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-2 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-slate-200">
                {vault.name ?? formatAddress(vault.vaultAddress)}
              </p>
              <p className="text-xs font-mono text-muted mt-0.5">
                {formatAddress(vault.vaultAddress)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}
              >
                {STRATEGY_LABELS[strategyKey] ?? strategyKey}
              </span>
              <span className={`text-sm tabular-nums font-medium ${riskScoreColor(vault.riskScore)}`}>
                {vault.riskScore?.toFixed(1) ?? "—"}
              </span>
              <span
                className={`text-sm tabular-nums ${
                  returnIsPositive ? "text-teal-400" : returnIsNegative ? "text-red-400" : "text-neutral-400"
                }`}
              >
                {formatPercent(vault.annualizedReturn, { showSign: true })}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
