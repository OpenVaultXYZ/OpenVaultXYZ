/**
 * Tests for returns.ts
 *
 * Run: pnpm test (from packages/metrics/)
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  timeWeightedReturn,
  annualizeReturn,
  annualizedReturn,
  dailyReturns,
  type NavPoint,
} from "./returns.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeNav(values: number[], totalDays = 100): NavPoint[] {
  const now = Date.now();
  return values.map((accountValue, i) => ({
    time: new Date(now - (totalDays - i) * 24 * 60 * 60 * 1000),
    accountValue,
  }));
}

function makeShortNav(values: number[], totalDays = 10): NavPoint[] {
  return makeNav(values, totalDays);
}

// ─── timeWeightedReturn ───────────────────────────────────────────────────────

describe("timeWeightedReturn", () => {
  it("returns 0 for fewer than 2 points", () => {
    assert.equal(timeWeightedReturn([]), 0);
    assert.equal(timeWeightedReturn(makeNav([100])), 0);
  });

  it("returns 0 for flat series", () => {
    assert.equal(timeWeightedReturn(makeNav([100, 100, 100])), 0);
  });

  it("computes correct return for simple growth", () => {
    // 100 → 200 = 100% return
    const result = timeWeightedReturn(makeNav([100, 200]));
    assert.ok(Math.abs(result - 1.0) < 1e-10, `expected 1.0, got ${result}`);
  });

  it("chains sub-period returns correctly", () => {
    // 100 → 110 → 121 = two 10% periods = 21% total
    const result = timeWeightedReturn(makeNav([100, 110, 121]));
    assert.ok(Math.abs(result - 0.21) < 1e-10, `expected 0.21, got ${result}`);
  });

  it("handles unsorted input", () => {
    const sorted = makeNav([100, 110, 121]);
    const unsorted = [sorted[2]!, sorted[0]!, sorted[1]!];
    const resultSorted = timeWeightedReturn(sorted);
    const resultUnsorted = timeWeightedReturn(unsorted);
    assert.ok(Math.abs(resultSorted - resultUnsorted) < 1e-10);
  });

  it("skips periods where previous NAV is zero", () => {
    const nav: NavPoint[] = [
      { time: new Date(0), accountValue: 0 },
      { time: new Date(1000), accountValue: 100 },
      { time: new Date(2000), accountValue: 110 },
    ];
    // Only the 100→110 period counts
    const result = timeWeightedReturn(nav);
    assert.ok(Math.abs(result - 0.1) < 1e-10, `expected 0.1, got ${result}`);
  });

  it("returns negative for declining series", () => {
    // 100 → 80 = -20%
    const result = timeWeightedReturn(makeNav([100, 80]));
    assert.ok(Math.abs(result - (-0.2)) < 1e-10, `expected -0.2, got ${result}`);
  });
});

// ─── annualizeReturn ──────────────────────────────────────────────────────────

describe("annualizeReturn", () => {
  it("returns 0 for zero or negative days", () => {
    assert.equal(annualizeReturn(0.1, 0), 0);
    assert.equal(annualizeReturn(0.1, -5), 0);
  });

  it("10% over 365 days annualizes to 10%", () => {
    const result = annualizeReturn(0.1, 365);
    assert.ok(Math.abs(result - 0.1) < 1e-10, `expected 0.1, got ${result}`);
  });

  it("10% over ~182 days annualizes to ~21% (compounding)", () => {
    // (1.1)^2 - 1 ≈ 0.21
    const result = annualizeReturn(0.1, 182.5);
    assert.ok(Math.abs(result - 0.21) < 0.005, `expected ~0.21, got ${result}`);
  });

  it("negative return annualizes correctly", () => {
    // -20% over 365 days stays -20%
    const result = annualizeReturn(-0.2, 365);
    assert.ok(Math.abs(result - (-0.2)) < 1e-10, `expected -0.2, got ${result}`);
  });
});

// ─── annualizedReturn ─────────────────────────────────────────────────────────

describe("annualizedReturn", () => {
  it("returns 0 for fewer than 2 points", () => {
    assert.equal(annualizedReturn([]), 0);
    assert.equal(annualizedReturn(makeNav([100])), 0);
  });

  it("returns raw TWR when series spans less than 30 days", () => {
    // 10 days, 100→150 = 50% raw TWR (not annualized)
    const nav = makeShortNav([100, 150], 10);
    const result = annualizedReturn(nav);
    assert.ok(Math.abs(result - 0.5) < 1e-10, `expected raw TWR 0.5, got ${result}`);
  });

  it("annualizes when series spans at least 30 days", () => {
    // 365 days, 100→110 — result should equal annualizeReturn(0.1, 365)
    const nav = makeNav([100, 110], 365);
    const result = annualizedReturn(nav);
    assert.ok(Math.abs(result - 0.1) < 0.001, `expected ~0.1, got ${result}`);
  });
});

// ─── dailyReturns ─────────────────────────────────────────────────────────────

describe("dailyReturns", () => {
  it("returns empty array for fewer than 2 points", () => {
    assert.deepEqual(dailyReturns([]), []);
    assert.deepEqual(dailyReturns(makeNav([100])), []);
  });

  it("returns correct number of returns", () => {
    const result = dailyReturns(makeNav([100, 110, 121]));
    assert.equal(result.length, 2);
  });

  it("computes correct per-period returns", () => {
    const result = dailyReturns(makeNav([100, 110, 121]));
    assert.ok(Math.abs(result[0]! - 0.1) < 1e-10, `first return should be 0.1, got ${result[0]}`);
    assert.ok(Math.abs(result[1]! - 0.1) < 1e-10, `second return should be 0.1, got ${result[1]}`);
  });

  it("skips periods where previous NAV is zero or negative", () => {
    const nav: NavPoint[] = [
      { time: new Date(0), accountValue: 0 },
      { time: new Date(1000), accountValue: 100 },
      { time: new Date(2000), accountValue: 110 },
    ];
    const result = dailyReturns(nav);
    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0]! - 0.1) < 1e-10);
  });

  it("handles declining series", () => {
    const result = dailyReturns(makeNav([100, 80]));
    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0]! - (-0.2)) < 1e-10);
  });
});
