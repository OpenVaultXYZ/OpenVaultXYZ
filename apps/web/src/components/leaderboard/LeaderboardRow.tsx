import Link from "next/link";
import type { VaultListRow } from "@openvault/db";
import { formatPercent, formatRatio, formatAddress, formatNav } from "@/lib/format";
import { STRATEGY_LABELS, STRATEGY_COLORS } from "@/lib/constants";
import { Sparkline } from "./Sparkline";

export function LeaderboardRow({ vault }: { vault: VaultListRow }) {
  const strategyKey = vault.strategyType ?? "unknown";
  const strategyColors = STRATEGY_COLORS[strategyKey] ?? STRATEGY_COLORS["unknown"]!;
  const returnIsPositive = vault.annualizedReturn != null && vault.annualizedReturn > 0;
  const returnIsNegative = vault.annualizedReturn != null && vault.annualizedReturn < 0;

  return (
    <tr className="hover:bg-surface transition-colors cursor-pointer group">
      {/* VAULT — left-aligned, fixed width */}
      <td className="px-4 py-3 w-56">
        <Link href={`/vault/${vault.vaultAddress}`} className="block">
          <div className="font-medium text-slate-200 group-hover:text-teal-400 transition-colors truncate max-w-52">
            {vault.name ?? formatAddress(vault.vaultAddress)}
          </div>
          <div className="text-xs text-muted font-mono mt-0.5">
            {formatAddress(vault.vaultAddress)}
          </div>
          {vault.currentAum != null && vault.currentAum > 0 && (
            <div className="text-xs text-neutral-500 mt-0.5">
              {formatNav(vault.currentAum)} AUM
            </div>
          )}
        </Link>
      </td>

      {/* SPARKLINE — no header, visual only */}
      <td className="px-2 py-3 w-20">
        {vault.navSparkline && vault.navSparkline.length >= 2 && (
          <Sparkline values={vault.navSparkline} positive={vault.annualizedReturn == null || vault.annualizedReturn === 0 ? null : vault.annualizedReturn > 0} />
        )}
      </td>

      {/* STRATEGY — left-aligned */}
      <td className="px-3 py-3 w-28">
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${strategyColors.bg} ${strategyColors.text} ${strategyColors.border}`}
        >
          {STRATEGY_LABELS[strategyKey] ?? strategyKey}
        </span>
      </td>

      {/* RETURN — right-aligned */}
      <td className="px-3 py-3 w-28 text-right tabular-nums">
        <span className={returnIsPositive ? "text-teal-400" : returnIsNegative ? "text-red-400" : "text-neutral-400"}>
          {formatPercent(vault.annualizedReturn, { showSign: true })}
        </span>
      </td>

      {/* SHARPE — right-aligned */}
      <td className="px-3 py-3 w-24 text-right tabular-nums text-slate-300">
        {formatRatio(vault.sharpeRatio)}
      </td>

      {/* MAX DD — right-aligned */}
      <td className="px-3 py-3 w-24 text-right tabular-nums">
        <span className={vault.maxDrawdown != null && vault.maxDrawdown > 0.2 ? "text-red-400" : "text-slate-300"}>
          {formatPercent(vault.maxDrawdown)}
        </span>
      </td>

      {/* WIN RATE — right-aligned */}
      <td className="px-3 py-3 w-24 text-right tabular-nums text-slate-300">
        {formatPercent(vault.winRate)}
      </td>

      {/* PROFIT FACTOR — right-aligned */}
      <td className="px-3 py-3 w-28 text-right tabular-nums text-slate-300">
        {formatRatio(vault.profitFactor)}
      </td>
    </tr>
  );
}
