/**
 * Strategy classification — pure function, no side effects.
 *
 * Classifies a vault's trading strategy from its fill history.
 * Rule-based v1 — no ML, fully auditable and explainable.
 *
 * The strategy type is one of the 6 categories defined in CLAUDE.md.
 */

export type StrategyType =
  | "momentum"
  | "mean_reversion"
  | "funding_arb"
  | "hf_market_making"
  | "directional_macro"
  | "leveraged_beta"
  | "unknown";

export type FillForClassification = {
  coin: string;
  side: "B" | "S";
  time: number; // Unix ms
  sz: number;
  closedPnl: number;
  dir: string; // "Open Long" | "Close Long" | "Open Short" | "Close Short"
};

export type PositionForClassification = {
  coin: string;
  szi: number;
  cumFundingAllTime: number;
  positionValue: number;
};

export type ClassificationResult = {
  strategyType: StrategyType;
  confidence: "high" | "medium" | "low";
  signals: Record<string, number | string>; // observable signals for transparency
};

/**
 * Compute the average hold time in hours for closed positions.
 * Pairs opens with closes for the same coin and side.
 */
function avgHoldTimeHours(fills: FillForClassification[]): number {
  const byOpenByCoin: Map<string, FillForClassification[]> = new Map();

  for (const fill of fills) {
    const isOpen = fill.dir.startsWith("Open");
    if (!isOpen) continue;
    const key = `${fill.coin}:${fill.dir.includes("Long") ? "B" : "S"}`;
    const arr = byOpenByCoin.get(key) ?? [];
    arr.push(fill);
    byOpenByCoin.set(key, arr);
  }

  const holdTimes: number[] = [];

  for (const fill of fills) {
    const isClose = fill.dir.startsWith("Close");
    if (!isClose) continue;
    const key = `${fill.coin}:${fill.dir.includes("Long") ? "B" : "S"}`;
    const opens = byOpenByCoin.get(key);
    if (!opens || opens.length === 0) continue;
    const open = opens.shift()!;
    const holdMs = fill.time - open.time;
    if (holdMs > 0) holdTimes.push(holdMs / (1000 * 60 * 60));
  }

  if (holdTimes.length === 0) return 0;
  return holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
}

/**
 * Trades per day (fill frequency).
 */
function tradesPerDay(fills: FillForClassification[]): number {
  if (fills.length < 2) return 0;
  const sorted = [...fills].sort((a, b) => a.time - b.time);
  const spanDays =
    (sorted[sorted.length - 1]!.time - sorted[0]!.time) / (1000 * 60 * 60 * 24);
  if (spanDays === 0) return 0;
  return fills.length / spanDays;
}

/**
 * Fraction of trades that are long-side opens.
 * High = directional long bias, low = short bias, ~0.5 = balanced/arb.
 */
function longBias(fills: FillForClassification[]): number {
  const opens = fills.filter((f) => f.dir.startsWith("Open"));
  if (opens.length === 0) return 0.5;
  const longs = opens.filter((f) => f.dir === "Open Long").length;
  return longs / opens.length;
}

/**
 * Herfindahl-Hirschman Index of position concentration by coin.
 * 1.0 = completely concentrated in one coin, ~0 = highly diversified.
 */
function concentrationHHI(positions: PositionForClassification[]): number {
  const total = positions.reduce((s, p) => s + Math.abs(p.positionValue), 0);
  if (total === 0) return 0;
  return positions.reduce((s, p) => {
    const share = Math.abs(p.positionValue) / total;
    return s + share * share;
  }, 0);
}

/**
 * HHI computed from fill volume by asset — used when no current positions exist.
 * A vault that only trades BTC will show HHI ≈ 1.0 even if all positions are closed.
 */
function concentrationHHIFromFills(fills: FillForClassification[]): number {
  const volumeByAsset = new Map<string, number>();
  for (const f of fills) {
    volumeByAsset.set(f.coin, (volumeByAsset.get(f.coin) ?? 0) + f.sz);
  }
  const total = [...volumeByAsset.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return [...volumeByAsset.values()].reduce((s, v) => {
    const share = v / total;
    return s + share * share;
  }, 0);
}

/**
 * Funding income as a fraction of total realized PnL.
 */
function fundingIncomeFraction(
  positions: PositionForClassification[],
  totalRealizedPnl: number,
): number {
  if (Math.abs(totalRealizedPnl) < 0.01) return 0;
  const totalFunding = positions.reduce((s, p) => s + p.cumFundingAllTime, 0);
  return Math.abs(totalFunding) / (Math.abs(totalFunding) + Math.abs(totalRealizedPnl));
}

/**
 * Classify vault strategy from fills and current positions.
 *
 * This is the core explainability layer — every classification is backed by
 * observable signals from real trade data.
 */
export function classifyStrategy(
  fills: FillForClassification[],
  positions: PositionForClassification[],
): ClassificationResult {
  if (fills.length < 10) {
    return { strategyType: "unknown", confidence: "low", signals: { fillCount: fills.length } };
  }

  const holdTimeHours = avgHoldTimeHours(fills);
  const fillsPerDay = tradesPerDay(fills);
  const longBiasRatio = longBias(fills);
  // Use position-based HHI when positions are available; fall back to fill-volume
  // HHI when all positions are closed (still reflects historical concentration).
  const hhi = positions.length > 0
    ? concentrationHHI(positions)
    : concentrationHHIFromFills(fills);
  const totalRealizedPnl = fills.reduce((s, f) => s + f.closedPnl, 0);
  const fundingFraction = fundingIncomeFraction(positions, totalRealizedPnl);

  const signals = {
    holdTimeHours: Math.round(holdTimeHours * 10) / 10,
    fillsPerDay: Math.round(fillsPerDay * 10) / 10,
    longBiasRatio: Math.round(longBiasRatio * 100) / 100,
    concentrationHHI: Math.round(hhi * 100) / 100,
    fundingFraction: Math.round(fundingFraction * 100) / 100,
    fillCount: fills.length,
  };

  // ─── Classification rules ──────────────────────────────────────────────────
  // Ordered from most to least specific. First match wins.

  // HF market making: extremely high frequency, very short holds
  if (fillsPerDay > 500 || (fillsPerDay > 100 && holdTimeHours < 0.1)) {
    return { strategyType: "hf_market_making", confidence: "high", signals };
  }

  // Funding arb: significant funding income, relatively balanced long/short
  if (fundingFraction > 0.4 && longBiasRatio > 0.3 && longBiasRatio < 0.7) {
    return { strategyType: "funding_arb", confidence: "high", signals };
  }

  // Leveraged beta: high BTC/ETH correlation, long-biased, moderate frequency
  // (BTC beta computed separately — flagged as leveraged_beta when btcBeta > 0.8)
  // Cannot detect from fills alone; defer to beta computation

  // Mean reversion: short holds, high frequency, balanced bias
  if (holdTimeHours < 4 && fillsPerDay > 20 && longBiasRatio > 0.35 && longBiasRatio < 0.65) {
    return { strategyType: "mean_reversion", confidence: "medium", signals };
  }

  // Directional macro: low frequency, multi-hour holds, concentrated positions.
  // Thresholds relaxed from (< 1/day, > 24h, HHI > 0.5) — some macro vaults
  // trade a few times per day and hold overnight rather than for days.
  if (fillsPerDay < 2 && holdTimeHours > 8 && hhi > 0.4) {
    return { strategyType: "directional_macro", confidence: "medium", signals };
  }

  // Medium-frequency momentum: active (> 20/day) but holds positions for hours.
  // Fills the gap between mean_reversion (short holds) and low-freq momentum.
  if (fillsPerDay > 20 && holdTimeHours > 4) {
    return { strategyType: "momentum", confidence: "medium", signals };
  }

  // Momentum / trend: low frequency, longer holds, directional bias
  if (holdTimeHours > 4 && fillsPerDay < 20) {
    return { strategyType: "momentum", confidence: "medium", signals };
  }

  return { strategyType: "unknown", confidence: "low", signals };
}
