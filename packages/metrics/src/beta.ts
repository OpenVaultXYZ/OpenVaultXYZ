/**
 * Beta computation — pure functions, no side effects.
 *
 * Beta measures how much the vault's returns move relative to a benchmark
 * (BTC or ETH). Beta > 1 = amplified market moves. Beta ~0 = uncorrelated.
 * Negative beta = inverse correlation.
 *
 * A vault with 80%+ annualized return but BTC beta of 0.9 is probably just
 * a leveraged beta play — not genuine alpha. This is a key insight for allocators.
 */

import type { NavPoint } from "./returns.js";

export type PricePoint = { time: Date; price: number };

/**
 * Align two time series by finding matching or nearby timestamps.
 * Returns paired [vaultReturn, marketReturn] arrays.
 */
function alignSeries(
  vault: NavPoint[],
  market: PricePoint[],
  toleranceMs = 60 * 60 * 1000, // 1 hour tolerance
): Array<[number, number]> {
  const sortedVault = [...vault].sort((a, b) => a.time.getTime() - b.time.getTime());
  const sortedMarket = [...market].sort((a, b) => a.time.getTime() - b.time.getTime());

  if (sortedVault.length < 2 || sortedMarket.length < 2) return [];

  // Compute returns for vault
  const vaultReturns: Array<{ time: number; ret: number }> = [];
  for (let i = 1; i < sortedVault.length; i++) {
    const prev = sortedVault[i - 1]!;
    const curr = sortedVault[i]!;
    if (prev.accountValue <= 0) continue;
    vaultReturns.push({
      time: curr.time.getTime(),
      ret: (curr.accountValue - prev.accountValue) / prev.accountValue,
    });
  }

  // Compute returns for market
  const marketReturns: Array<{ time: number; ret: number }> = [];
  for (let i = 1; i < sortedMarket.length; i++) {
    const prev = sortedMarket[i - 1]!;
    const curr = sortedMarket[i]!;
    if (prev.price <= 0) continue;
    marketReturns.push({
      time: curr.time.getTime(),
      ret: (curr.price - prev.price) / prev.price,
    });
  }

  // Match by timestamp
  const pairs: Array<[number, number]> = [];
  for (const vr of vaultReturns) {
    const nearest = marketReturns.find(
      (mr) => Math.abs(mr.time - vr.time) <= toleranceMs,
    );
    if (nearest !== undefined) {
      pairs.push([vr.ret, nearest.ret]);
    }
  }

  return pairs;
}

/**
 * OLS beta: covariance(vault, market) / variance(market)
 */
function olsBeta(pairs: Array<[number, number]>): number | null {
  if (pairs.length < 10) return null;

  const n = pairs.length;
  const meanV = pairs.reduce((s, [v]) => s + v, 0) / n;
  const meanM = pairs.reduce((s, [, m]) => s + m, 0) / n;

  let cov = 0;
  let varM = 0;
  for (const [v, m] of pairs) {
    cov += (v - meanV) * (m - meanM);
    varM += (m - meanM) ** 2;
  }

  if (varM === 0) return null;
  return cov / varM;
}

/**
 * Compute vault beta relative to a market (BTC or ETH).
 * Returns null if insufficient aligned data.
 */
export function betaToMarket(vault: NavPoint[], market: PricePoint[]): number | null {
  const pairs = alignSeries(vault, market);
  return olsBeta(pairs);
}
