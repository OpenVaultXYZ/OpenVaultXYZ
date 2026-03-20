/**
 * Risk score — composite 1-10 score for quick vault assessment.
 *
 * 1 = lowest risk (consistent, low drawdown, positive risk-adjusted returns)
 * 10 = highest risk (erratic, large drawdowns, poor risk-adjusted returns)
 *
 * The score is designed to be used for free-tier display and quick filtering.
 * It is NOT a recommendation — it is one dimension of a full evaluation.
 *
 * Methodology is published and versioned so it can be held to account.
 * Version: v1 (March 2026)
 */

export type RiskScoreInputs = {
  maxDrawdown: number;       // 0-1 (0.15 = 15% drawdown)
  sharpeRatio: number | null;
  sortino: number | null;
  winRate: number | null;
  annualizedReturn: number | null;
  fundingIncomePct: number | null;
};

/**
 * Clamp a value to [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map a value to a 0-1 score where higher input = higher score (worse risk).
 * Uses a piecewise linear scale between good and bad thresholds.
 */
function badIsHigh(value: number, goodThreshold: number, badThreshold: number): number {
  if (value <= goodThreshold) return 0;
  if (value >= badThreshold) return 1;
  return (value - goodThreshold) / (badThreshold - goodThreshold);
}

/**
 * Map a value to a 0-1 score where higher input = lower score (better risk).
 */
function goodIsHigh(value: number, badThreshold: number, goodThreshold: number): number {
  return badIsHigh(goodThreshold - value + badThreshold, goodThreshold, badThreshold);
}

/**
 * Compute a risk score from 1 (low risk) to 10 (high risk).
 *
 * Component weights (must sum to 1.0):
 *   max drawdown:    40% — most important single risk indicator
 *   Sharpe ratio:    30% — quality of risk-adjusted returns
 *   win rate:        15% — consistency of profitable trades
 *   return quality:  15% — whether returns are meaningful
 */
export function riskScore(inputs: RiskScoreInputs): number {
  const components: Array<{ score: number; weight: number }> = [];

  // Max drawdown (0 = no drawdown, 1 = total loss)
  // Good: < 5% | Bad: > 30%
  components.push({
    score: badIsHigh(inputs.maxDrawdown, 0.05, 0.30),
    weight: 0.40,
  });

  // Sharpe ratio (higher is better)
  // Good: > 2.0 | Bad: < 0.5
  const sharpe = inputs.sharpeRatio ?? 0.5;
  components.push({
    score: goodIsHigh(sharpe, 0.5, 2.0),
    weight: 0.30,
  });

  // Win rate (higher is better)
  // Good: > 60% | Bad: < 40%
  const wr = inputs.winRate ?? 0.4;
  components.push({
    score: goodIsHigh(wr, 0.4, 0.6),
    weight: 0.15,
  });

  // Annualized return quality
  // Good: > 20% | Bad: < -10% (negative return = max risk component)
  const ret = inputs.annualizedReturn ?? -0.1;
  components.push({
    score: goodIsHigh(ret, -0.1, 0.2),
    weight: 0.15,
  });

  const composite = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  // Map 0-1 composite to 1-10 scale (rounded to 1 decimal)
  const score = 1 + composite * 9;
  return Math.round(clamp(score, 1, 10) * 10) / 10;
}
