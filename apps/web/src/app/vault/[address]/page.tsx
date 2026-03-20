import { getVaultWithMetrics, getNavSeries } from "@openvault/db";
import { sanitizeNavSeries } from "@openvault/metrics";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { NavChart } from "@/components/vault/NavChart";
import { MetricsGrid } from "@/components/vault/MetricsGrid";
import { StrategyBadge } from "@/components/vault/StrategyBadge";
import { RiskScoreMeter } from "@/components/vault/RiskScoreMeter";
import { formatAddress, formatDate } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VaultPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  const [vault, navSeries] = await Promise.all([
    getVaultWithMetrics(db, address),
    getNavSeries(db, address),
  ]);

  if (!vault) notFound();

  // Serialize Dates to numbers before passing to client components
  const chartData = navSeries.map((p) => ({
    time: new Date(p.time).getTime(),
    accountValue: p.accountValue,
  }));

  // Build TWR performance series: sanitized nav chained into a running index
  // starting at 1.0. Removes deposit/withdrawal effects so the chart shows
  // pure trading performance, comparable across vaults.
  const cleanNav = sanitizeNavSeries(
    navSeries.map((p) => ({ time: new Date(p.time), accountValue: p.accountValue }))
  );
  const sortedClean = [...cleanNav].sort((a, b) => a.time.getTime() - b.time.getTime());
  const perfData: { time: number; value: number }[] = [];
  if (sortedClean.length >= 2) {
    let index = 1.0;
    perfData.push({ time: sortedClean[0]!.time.getTime(), value: 1.0 });
    for (let i = 1; i < sortedClean.length; i++) {
      const prev = sortedClean[i - 1]!;
      const curr = sortedClean[i]!;
      if (prev.accountValue > 0) {
        index *= curr.accountValue / prev.accountValue;
      }
      perfData.push({ time: curr.time.getTime(), value: index });
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/" className="text-sm text-neutral-400 hover:text-slate-200 transition-colors">
        ← Leaderboard
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {vault.name ?? formatAddress(vault.vaultAddress)}
          </h1>
          <p className="text-sm font-mono text-muted mt-1">{vault.vaultAddress}</p>
          {vault.description && (
            <p className="text-sm text-neutral-400 mt-2 max-w-xl">{vault.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {vault.strategyType && <StrategyBadge type={vault.strategyType} />}
            <span className="text-xs text-muted">
              Operator:{" "}
              <span className="font-mono">
                {formatAddress(vault.leaderAddress)}
              </span>
            </span>
            {vault.allowDeposits != null && (
              <span className={`text-xs px-2 py-0.5 rounded border ${
                vault.allowDeposits
                  ? "text-teal-400 border-teal-800 bg-teal-950"
                  : "text-neutral-400 border-border bg-surface"
              }`}>
                {vault.allowDeposits ? "Deposits Open" : "Deposits Closed"}
              </span>
            )}
          </div>
        </div>
        <RiskScoreMeter score={vault.riskScore} />
      </div>

      {/* NAV Chart */}
      {chartData.length >= 2 && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <NavChart data={chartData} {...(perfData.length >= 2 ? { perfData } : {})} />
        </div>
      )}

      {/* Metrics */}
      <MetricsGrid vault={vault} />

      {/* Footer metadata */}
      <div className="text-xs text-muted border-t border-border pt-4">
        Metrics computed {formatDate(vault.computedAt)} ·
        Track record from {formatDate(vault.discoveredAt)}
      </div>
    </div>
  );
}
