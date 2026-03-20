/**
 * Risk metrics — pure functions, no side effects.
 *
 * All ratios use annualized figures. Risk-free rate defaults to 0 (appropriate
 * for crypto — there's no meaningful "risk-free" asset to benchmark against).
 */

import { dailyReturns, annualizedReturn, type NavPoint } from "./returns.js";

const TRADING_DAYS_PER_YEAR = 365; // crypto markets are 24/7/365

/**
 * Derive the number of return periods per year from a NAV series.
 *
 * Vault snapshots may be hourly, daily, weekly, etc. Using sqrt(365) for
 * annualization only works for daily data. This function measures the actual
 * average time gap and derives the correct annualization factor.
 *
 * Example: weekly snapshots → avgGapDays ≈ 7 → ~52 periods/year → sqrt(52)
 */
function periodsPerYear(nav: NavPoint[]): number {
  const sorted = [...nav].sort((a, b) => a.time.getTime() - b.time.getTime());
  if (sorted.length < 2) return TRADING_DAYS_PER_YEAR;
  const totalMs = sorted[sorted.length - 1]!.time.getTime() - sorted[0]!.time.getTime();
  const avgGapDays = totalMs / (sorted.length - 1) / (1000 * 60 * 60 * 24);
  if (avgGapDays <= 0) return TRADING_DAYS_PER_YEAR;
  return 365 / avgGapDays;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ─── Sharpe Ratio ─────────────────────────────────────────────────────────────

/**
 * Annualized Sharpe ratio.
 * sharpe = (mean_daily_return - risk_free_daily) / std_daily * sqrt(365)
 *
 * Returns null if insufficient data (< 30 data points).
 */
export function sharpeRatio(nav: NavPoint[], riskFreeAnnual = 0): number | null {
  const returns = dailyReturns(nav);
  if (returns.length < 30) return null;

  const riskFreeDaily = riskFreeAnnual / TRADING_DAYS_PER_YEAR;
  const excessReturns = returns.map((r) => r - riskFreeDaily);
  const m = mean(excessReturns);
  const s = stddev(excessReturns);

  if (s === 0) return null;
  return (m / s) * Math.sqrt(periodsPerYear(nav));
}

// ─── Sortino Ratio ────────────────────────────────────────────────────────────

/**
 * Annualized Sortino ratio. Uses downside deviation (only negative returns).
 * Better than Sharpe for asymmetric return distributions.
 */
export function sortinoRatio(nav: NavPoint[], riskFreeAnnual = 0): number | null {
  const returns = dailyReturns(nav);
  if (returns.length < 30) return null;

  const riskFreeDaily = riskFreeAnnual / TRADING_DAYS_PER_YEAR;
  const excessReturns = returns.map((r) => r - riskFreeDaily);
  const m = mean(excessReturns);

  const downside = excessReturns.filter((r) => r < 0);
  if (downside.length === 0) return null;

  const downsideVariance =
    downside.reduce((sum, r) => sum + r * r, 0) / excessReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(TRADING_DAYS_PER_YEAR);

  if (downsideDeviation === 0) return null;
  return (m * periodsPerYear(nav)) / downsideDeviation;
}

// ─── Drawdown Analysis ────────────────────────────────────────────────────────

export type DrawdownPeriod = {
  peakTime: Date;
  troughTime: Date;
  recoveryTime: Date | null; // null if not yet recovered
  depth: number; // positive decimal, e.g. 0.15 = 15% drawdown
  durationDays: number; // peak to trough
  recoveryDays: number | null; // trough to recovery, null if not recovered
};

/**
 * Compute all drawdown periods from a NAV series.
 * A drawdown starts when NAV falls below its running peak.
 * It ends when NAV recovers to the prior peak.
 */
export function drawdownPeriods(nav: NavPoint[]): DrawdownPeriod[] {
  const sorted = [...nav].sort((a, b) => a.time.getTime() - b.time.getTime());
  if (sorted.length < 2) return [];

  const periods: DrawdownPeriod[] = [];
  let peakValue = sorted[0]!.accountValue;
  let peakTime = sorted[0]!.time;
  let inDrawdown = false;
  let troughValue = peakValue;
  let troughTime = peakTime;

  for (let i = 1; i < sorted.length; i++) {
    const point = sorted[i]!;

    if (point.accountValue >= peakValue) {
      // New peak or recovery
      if (inDrawdown) {
        periods.push({
          peakTime,
          troughTime,
          recoveryTime: point.time,
          depth: (peakValue - troughValue) / peakValue,
          durationDays:
            (troughTime.getTime() - peakTime.getTime()) / (1000 * 60 * 60 * 24),
          recoveryDays:
            (point.time.getTime() - troughTime.getTime()) / (1000 * 60 * 60 * 24),
        });
        inDrawdown = false;
      }
      peakValue = point.accountValue;
      peakTime = point.time;
      troughValue = peakValue;
      troughTime = peakTime;
    } else {
      // Below peak
      inDrawdown = true;
      if (point.accountValue < troughValue) {
        troughValue = point.accountValue;
        troughTime = point.time;
      }
    }
  }

  // If still in drawdown at end of series
  if (inDrawdown) {
    periods.push({
      peakTime,
      troughTime,
      recoveryTime: null,
      depth: (peakValue - troughValue) / peakValue,
      durationDays:
        (troughTime.getTime() - peakTime.getTime()) / (1000 * 60 * 60 * 24),
      recoveryDays: null,
    });
  }

  return periods;
}

export function maxDrawdown(nav: NavPoint[]): number {
  const periods = drawdownPeriods(nav);
  if (periods.length === 0) return 0;
  return Math.max(...periods.map((p) => p.depth));
}

export function avgDrawdown(nav: NavPoint[]): number {
  const periods = drawdownPeriods(nav);
  if (periods.length === 0) return 0;
  return mean(periods.map((p) => p.depth));
}

/**
 * Duration of the worst drawdown in days (peak to trough).
 */
export function maxDrawdownDays(nav: NavPoint[]): number {
  const periods = drawdownPeriods(nav);
  if (periods.length === 0) return 0;
  const worst = periods.reduce((a, b) => (a.depth > b.depth ? a : b));
  return worst.durationDays;
}

// ─── Calmar Ratio ─────────────────────────────────────────────────────────────

/**
 * Calmar ratio = annualized return / max drawdown.
 * Higher is better. Penalizes large drawdowns heavily.
 */
export function calmarRatio(nav: NavPoint[]): number | null {
  if (nav.length < 30) return null;
  const mdd = maxDrawdown(nav);
  if (mdd === 0) return null;
  // Use TWR-based annualized return (same as displayed return) so Calmar is
  // consistent with the return figure shown on the vault page.
  const annReturn = annualizedReturn(nav);
  return annReturn / mdd;
}

// ─── Win rate & profit factor (from fills) ────────────────────────────────────

export type ClosingFill = { closedPnl: number };

/**
 * Win rate: fraction of closing trades that are profitable.
 * Only counts fills where a position was closed (closedPnl != 0).
 */
export function winRate(closingFills: ClosingFill[]): number | null {
  const closing = closingFills.filter((f) => f.closedPnl !== 0);
  if (closing.length === 0) return null;
  const wins = closing.filter((f) => f.closedPnl > 0).length;
  return wins / closing.length;
}

/**
 * Profit factor: gross profit / gross loss.
 * > 1 means profitable overall. > 2 is considered strong.
 */
export function profitFactor(closingFills: ClosingFill[]): number | null {
  const closing = closingFills.filter((f) => f.closedPnl !== 0);
  if (closing.length === 0) return null;
  const grossProfit = closing.filter((f) => f.closedPnl > 0).reduce((s, f) => s + f.closedPnl, 0);
  const grossLoss = Math.abs(
    closing.filter((f) => f.closedPnl < 0).reduce((s, f) => s + f.closedPnl, 0),
  );
  if (grossLoss === 0) return null;
  return grossProfit / grossLoss;
}
