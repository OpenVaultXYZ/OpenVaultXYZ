/**
 * Tests for score.ts
 *
 * Run: pnpm test (from packages/metrics/)
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { riskScore, type RiskScoreInputs } from "./score.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeInputs(overrides: Partial<RiskScoreInputs> = {}): RiskScoreInputs {
  return {
    maxDrawdown: 0.1,
    sharpeRatio: 1.5,
    sortino: 2.0,
    winRate: 0.55,
    annualizedReturn: 0.25,
    fundingIncomePct: null,
    ...overrides,
  };
}

// ─── riskScore ────────────────────────────────────────────────────────────────

describe("riskScore — output range", () => {
  it("always returns a value between 1 and 10", () => {
    const cases: RiskScoreInputs[] = [
      makeInputs(),
      makeInputs({ maxDrawdown: 0, sharpeRatio: 5, winRate: 0.9, annualizedReturn: 1.0 }),
      makeInputs({ maxDrawdown: 1, sharpeRatio: 0, winRate: 0.1, annualizedReturn: -0.5 }),
      makeInputs({ maxDrawdown: 0.5, sharpeRatio: null, winRate: null, annualizedReturn: null }),
    ];
    for (const inputs of cases) {
      const score = riskScore(inputs);
      assert.ok(score >= 1 && score <= 10, `score ${score} is out of [1, 10]`);
    }
  });

  it("returns a number rounded to 1 decimal place", () => {
    const score = riskScore(makeInputs());
    assert.equal(score, Math.round(score * 10) / 10);
  });
});

describe("riskScore — low risk inputs → score near 1", () => {
  it("minimal drawdown + high sharpe + high win rate + strong return → score near 1", () => {
    const score = riskScore({
      maxDrawdown: 0.01,   // < 5% good threshold
      sharpeRatio: 3.0,    // > 2.0 good threshold
      sortino: 4.0,
      winRate: 0.75,       // > 60% good threshold
      annualizedReturn: 0.50, // > 20% good threshold
      fundingIncomePct: null,
    });
    assert.ok(score <= 3, `expected low risk score (≤ 3), got ${score}`);
  });
});

describe("riskScore — high risk inputs → score near 10", () => {
  it("large drawdown + poor sharpe + low win rate + negative return → score near 10", () => {
    const score = riskScore({
      maxDrawdown: 0.50,      // >> 30% bad threshold
      sharpeRatio: 0.2,       // < 0.5 bad threshold
      sortino: 0.1,
      winRate: 0.30,          // < 40% bad threshold
      annualizedReturn: -0.20, // < -10% bad threshold
      fundingIncomePct: null,
    });
    assert.ok(score >= 7, `expected high risk score (≥ 7), got ${score}`);
  });
});

describe("riskScore — null inputs fall back to defaults", () => {
  it("handles null sharpeRatio gracefully", () => {
    const score = riskScore(makeInputs({ sharpeRatio: null }));
    assert.ok(score >= 1 && score <= 10);
  });

  it("handles null winRate gracefully", () => {
    const score = riskScore(makeInputs({ winRate: null }));
    assert.ok(score >= 1 && score <= 10);
  });

  it("handles null annualizedReturn gracefully", () => {
    const score = riskScore(makeInputs({ annualizedReturn: null }));
    assert.ok(score >= 1 && score <= 10);
  });

  it("handles all-null inputs gracefully", () => {
    const score = riskScore({
      maxDrawdown: 0.1,
      sharpeRatio: null,
      sortino: null,
      winRate: null,
      annualizedReturn: null,
      fundingIncomePct: null,
    });
    assert.ok(score >= 1 && score <= 10);
  });
});

describe("riskScore — monotonicity", () => {
  it("increasing drawdown increases risk score", () => {
    const low = riskScore(makeInputs({ maxDrawdown: 0.05 }));
    const high = riskScore(makeInputs({ maxDrawdown: 0.40 }));
    assert.ok(low < high, `expected low drawdown (${low}) < high drawdown (${high})`);
  });

  it("higher sharpe produces lower risk score", () => {
    const poor = riskScore(makeInputs({ sharpeRatio: 0.3 }));
    const good = riskScore(makeInputs({ sharpeRatio: 2.5 }));
    assert.ok(good < poor, `expected good sharpe (${good}) < poor sharpe (${poor})`);
  });

  it("higher win rate produces lower risk score", () => {
    const poor = riskScore(makeInputs({ winRate: 0.30 }));
    const good = riskScore(makeInputs({ winRate: 0.70 }));
    assert.ok(good < poor, `expected good win rate (${good}) < poor win rate (${poor})`);
  });

  it("higher return produces lower risk score", () => {
    const poor = riskScore(makeInputs({ annualizedReturn: -0.15 }));
    const good = riskScore(makeInputs({ annualizedReturn: 0.30 }));
    assert.ok(good < poor, `expected good return (${good}) < poor return (${poor})`);
  });
});
