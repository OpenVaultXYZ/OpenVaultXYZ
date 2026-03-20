/**
 * Return computation — pure functions, no side effects.
 *
 * Uses Time-Weighted Return (TWR) to eliminate the effect of cash flows
 * (deposits/withdrawals), which is the correct methodology for evaluating
 * manager skill rather than AUM changes.
 */

export type NavPoint = { time: Date; accountValue: number };

/**
 * Compute time-weighted return from a series of NAV snapshots.
 * TWR chains sub-period returns, making it immune to cash flow timing.
 *
 * Returns a decimal (0.15 = 15% return).
 */
export function timeWeightedReturn(nav: NavPoint[]): number {
  if (nav.length < 2) return 0;

  const sorted = [...nav].sort((a, b) => a.time.getTime() - b.time.getTime());
  let twr = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (prev.accountValue <= 0) continue;
    twr *= curr.accountValue / prev.accountValue;
  }

  return twr - 1;
}

/**
 * Annualize a return given the time span covered.
 * Uses compound annualization: (1 + r)^(365/days) - 1
 */
export function annualizeReturn(totalReturn: number, daysElapsed: number): number {
  if (daysElapsed <= 0) return 0;
  return Math.pow(1 + totalReturn, 365 / daysElapsed) - 1;
}

/**
 * Compute annualized return from a NAV series.
 *
 * Requires at least 30 days of history before annualizing. For shorter series,
 * returns the raw TWR (total return) instead of annualizing. This prevents
 * extrapolating a 2-week return into an absurd annualized figure — a vault with
 * 100% total return over 10 days would show 100% (not 3,650%) until it has
 * enough history to justify the annualization.
 */
const MIN_DAYS_FOR_ANNUALIZATION = 30;

export function annualizedReturn(nav: NavPoint[]): number {
  if (nav.length < 2) return 0;

  const sorted = [...nav].sort((a, b) => a.time.getTime() - b.time.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const totalReturn = timeWeightedReturn(sorted);
  const daysElapsed = (last.time.getTime() - first.time.getTime()) / (1000 * 60 * 60 * 24);

  if (daysElapsed < MIN_DAYS_FOR_ANNUALIZATION) return totalReturn;
  return annualizeReturn(totalReturn, daysElapsed);
}

/**
 * Compute daily returns from a NAV series.
 * Returns an array of decimal returns (0.01 = 1% day).
 */
export function dailyReturns(nav: NavPoint[]): number[] {
  const sorted = [...nav].sort((a, b) => a.time.getTime() - b.time.getTime());
  const returns: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (prev.accountValue <= 0) continue;
    returns.push((curr.accountValue - prev.accountValue) / prev.accountValue);
  }

  return returns;
}
