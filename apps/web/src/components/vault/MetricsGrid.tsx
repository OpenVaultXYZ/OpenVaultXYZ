import type { VaultDetailRow } from "@openvault/db";
import { formatPercent, formatRatio, formatInt, formatDate, getFillStats } from "@/lib/format";

// ─── Tooltip helper ───────────────────────────────────────────────────────────

function MetricLabel({ label, tooltip }: { label: string; tooltip?: string | undefined }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      {tooltip && (
        <span className="relative group/tip inline-flex items-center">
          <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-neutral-700 text-[8px] text-neutral-600 cursor-help leading-none select-none group-hover/tip:border-neutral-500 group-hover/tip:text-neutral-400 transition-colors">i</span>
          <span className={[
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50",
            "w-60 p-2.5 rounded border border-border bg-surface shadow-xl",
            "text-xs text-slate-300 font-normal normal-case tracking-normal leading-relaxed",
            "opacity-0 invisible pointer-events-none",
            "group-hover/tip:opacity-100 group-hover/tip:visible transition-opacity duration-150",
          ].join(" ")}>
            {tooltip}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
          </span>
        </span>
      )}
    </span>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  tooltip,
  value,
  sub,
  valueClass,
}: {
  label: string;
  tooltip?: string | undefined;
  value: string;
  sub?: string | undefined;
  valueClass?: string | undefined;

}) {
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3">
      <p className="text-[11px] text-neutral uppercase tracking-wider mb-1">
        <MetricLabel label={label} tooltip={tooltip} />
      </p>
      <p className={`text-lg font-semibold tabular-nums ${valueClass ?? "text-slate-200"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wider text-muted col-span-full mt-4 first:mt-0">
      {label}
    </h3>
  );
}

// ─── Helper to safely read typed fields from JSONB data ──────────────────────

function getNavMeta(data: Record<string, unknown> | string) {
  const d: Record<string, unknown> =
    typeof data === "string" ? (JSON.parse(data) as Record<string, unknown>) : data;
  return {
    daysElapsed:   typeof d["daysElapsed"]   === "number" ? d["daysElapsed"]   : null,
    navStartDate:  typeof d["navStartDate"]  === "string" ? d["navStartDate"]  : null,
    navEndDate:    typeof d["navEndDate"]     === "string" ? d["navEndDate"]    : null,
    navPointsUsed: typeof d["navPointsUsed"] === "number" ? d["navPointsUsed"] : null,
  };
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export function MetricsGrid({ vault }: { vault: VaultDetailRow }) {
  const fillStats = vault.data ? getFillStats(vault.data) : null;
  const navMeta   = vault.data ? getNavMeta(vault.data)   : null;

  const daysElapsed    = navMeta?.daysElapsed ?? null;
  const navStartDate   = navMeta?.navStartDate ?? null;
  const navEndDate     = navMeta?.navEndDate ?? null;
  const navPointsUsed  = navMeta?.navPointsUsed ?? null;

  // Dynamic label: if data spans < 30 days, annualization isn't applied —
  // call it "Total Return" so users know it's not an annualized figure.
  const returnLabel = daysElapsed != null && daysElapsed < 30 ? "Total Return" : "Annualized Return";
  const returnSub   = daysElapsed != null
    ? daysElapsed < 30
      ? `${daysElapsed}-day total (not yet annualized)`
      : `annualized over ${Math.round(daysElapsed / 30)} months`
    : undefined;

  // How many weeks until Sharpe is available (needs 30+ periods ≈ 30 weeks for weekly snapshots)
  const weeksOfData      = daysElapsed != null ? Math.floor(daysElapsed / 7) : null;
  const weeksNeeded      = 30;
  const ratioMissingSub  = weeksOfData != null && weeksOfData < weeksNeeded
    ? `Needs ~${weeksNeeded} weeks of data (${weeksNeeded - weeksOfData} more)`
    : undefined;

  const returnClass =
    vault.annualizedReturn == null
      ? "text-neutral-400"
      : vault.annualizedReturn > 0
      ? "text-teal-400"
      : "text-red-400";

  const mddClass =
    vault.maxDrawdown != null && vault.maxDrawdown > 0.2 ? "text-red-400" : "text-slate-200";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">

      {/* Data window banner */}
      {navStartDate && navEndDate && navPointsUsed != null && (
        <p className="text-xs text-muted col-span-full -mb-1">
          Metrics based on {navPointsUsed} snapshots ·{" "}
          {formatDate(navStartDate)} → {formatDate(navEndDate)}
          {daysElapsed != null && daysElapsed < 30 && (
            <span className="text-yellow-500 ml-2">
              · Short history — ratios require more data
            </span>
          )}
        </p>
      )}

      <SectionHeader label="Performance" />

      <MetricCard
        label={returnLabel}
        tooltip="Time-weighted return, excluding the effect of investor deposits and withdrawals. Annualized when the track record spans 30+ days."
        value={formatPercent(vault.annualizedReturn, { showSign: true })}
        sub={returnSub}
        valueClass={returnClass}
      />
      <MetricCard
        label="Win Rate"
        tooltip="Fraction of closed trades that were profitable. Computed from actual on-chain trade fills, not the NAV chart."
        value={formatPercent(vault.winRate)}
      />
      <MetricCard
        label="Profit Factor"
        tooltip="Gross profit ÷ gross loss. >1 means net profitable overall; >2 is considered strong. Based on closed trade fills."
        value={formatRatio(vault.profitFactor)}
      />

      <SectionHeader label="Risk" />

      <MetricCard
        label="Sharpe Ratio"
        tooltip="Risk-adjusted return: annualized return ÷ annualized volatility. Higher is better. Requires 30+ data points."
        value={formatRatio(vault.sharpeRatio)}
        sub={vault.sharpeRatio == null ? ratioMissingSub : undefined}
      />
      <MetricCard
        label="Sortino Ratio"
        tooltip="Like Sharpe, but only penalizes downside volatility (ignores upside variance). Better measure for asymmetric return profiles."
        value={formatRatio(vault.sortinoRatio)}
        sub={vault.sortinoRatio == null ? ratioMissingSub : undefined}
      />
      <MetricCard
        label="Calmar Ratio"
        tooltip="Annualized return ÷ max drawdown. Penalizes large losses heavily — a vault with strong returns but a 50% drawdown scores lower than a steady 20% grinder."
        value={formatRatio(vault.calmarRatio)}
        sub={vault.calmarRatio == null ? ratioMissingSub : undefined}
      />
      <MetricCard
        label="Max Drawdown"
        tooltip="Largest peak-to-trough decline in vault equity during the tracked period, measured on sanitized NAV (deposits excluded)."
        value={formatPercent(vault.maxDrawdown)}
        sub={vault.maxDrawdownDays != null ? `${vault.maxDrawdownDays} days peak→trough` : undefined}
        valueClass={mddClass}
      />
      <MetricCard
        label="Avg Drawdown"
        tooltip="Average depth across all drawdown periods. Gives a sense of typical losing streaks, not just the worst case."
        value={formatPercent(vault.avgDrawdown)}
      />

      <SectionHeader label="Alpha / Beta" />

      <MetricCard
        label="BTC Beta"
        tooltip="Sensitivity to BTC price moves. Beta 1.0 = moves with BTC. Beta -1.0 = moves inversely. Near 0 = market-neutral. Computed via OLS regression on hourly prices."
        value={formatRatio(vault.btcBeta)}
        sub={vault.btcBeta == null ? "Insufficient aligned data" : undefined}
      />
      <MetricCard
        label="ETH Beta"
        tooltip="Same as BTC Beta but relative to ETH price movements."
        value={formatRatio(vault.ethBeta)}
        sub={vault.ethBeta == null ? "Insufficient aligned data" : undefined}
      />
      <MetricCard
        label="Funding Income"
        tooltip="Funding payments received as a % of total return. High funding % = the vault earns from being on the right side of perpetual funding rates, not just directional bets."
        value={formatPercent(vault.fundingIncomePct)}
        sub="% of total return"
      />

      {fillStats && (
        <>
          <SectionHeader label="Activity" />

          <MetricCard
            label="Total Fills"
            tooltip="Number of on-chain trade executions recorded for this vault."
            value={formatInt(fillStats.count)}
            sub="on-chain trades"
          />
          <MetricCard
            label="Track Record"
            tooltip="Date range of on-chain fill data collected for this vault. Fill ingestion may not cover the full vault lifetime."
            value={formatDate(fillStats.oldestTime)}
            sub={fillStats.newestTime ? `through ${formatDate(fillStats.newestTime)}` : undefined}
          />
          {vault.leaderCommission != null && (
            <MetricCard
              label="Commission"
              tooltip="Percentage of profits taken by the vault operator as a performance fee."
              value={formatPercent(vault.leaderCommission)}
              sub="operator fee"
            />
          )}
        </>
      )}
    </div>
  );
}
