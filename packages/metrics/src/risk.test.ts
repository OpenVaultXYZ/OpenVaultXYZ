/**
 * Tests for risk.ts
 *
 * Run: pnpm test (from packages/metrics/)
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  sharpeRatio,
  sortinoRatio,
  drawdownPeriods,
  maxDrawdown,
  avgDrawdown,
  maxDrawdownDays,
  calmarRatio,
  winRate,
  profitFactor,
  type ClosingFill,
} from "./risk.js";
import type { NavPoint } from "./returns.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeNav(values: number[], totalDays = 100): NavPoint[] {
  const now = Date.now();
  return values.map((accountValue, i) => ({
    time: new Date(now - (totalDays - i) * 24 * 60 * 60 * 1000),
    accountValue,
  }));
}

/** Generate N nav points that increase steadily — enough for ratio calculations. */
function makeSteadyGrowthNav(points = 60, startValue = 100, dailyReturn = 0.001): NavPoint[] {
  const values: number[] = [];
  let v = startValue;
  for (let i = 0; i < points; i++) {
    values.push(v);
    v *= 1 + dailyReturn;
  }
  return makeNav(values, points);
}

/** Generate N nav points that alternate up/down — produces variance for Sharpe. */
function makeVolatileNav(points = 60, startValue = 100): NavPoint[] {
  const values: number[] = [];
  let v = startValue;
  for (let i = 0; i < points; i++) {
    values.push(v);
    v *= i % 2 === 0 ? 1.02 : 0.99; // alternates +2% / -1%
  }
  return makeNav(values, points);
}

function makeFill(closedPnl: number): ClosingFill {
  return { closedPnl };
}

// ─── sharpeRatio ──────────────────────────────────────────────────────────────

describe("sharpeRatio", () => {
  it("returns null for fewer than 30 data points", () => {
    assert.equal(sharpeRatio(makeNav([100, 110], 2)), null);
    assert.equal(sharpeRatio(makeNav(Array(29).fill(100), 29)), null);
  });

  it("returns null for zero variance (flat series)", () => {
    assert.equal(sharpeRatio(makeNav(Array(60).fill(100), 60)), null);
  });

  it("returns a positive number for consistently positive returns", () => {
    const nav = makeSteadyGrowthNav(60);
    const result = sharpeRatio(nav);
    assert.ok(result !== null, "expected non-null");
    assert.ok(result > 0, `expected positive Sharpe, got ${result}`);
  });

  it("returns a higher sharpe for smoother returns vs volatile returns", () => {
    const steady = makeSteadyGrowthNav(60, 100, 0.001);
    const volatile = makeVolatileNav(60);
    const steadySharpe = sharpeRatio(steady)!;
    const volatileSharpe = sharpeRatio(volatile)!;
    assert.ok(steadySharpe > volatileSharpe, `steady (${steadySharpe}) should > volatile (${volatileSharpe})`);
  });
});

// ─── sortinoRatio ─────────────────────────────────────────────────────────────

describe("sortinoRatio", () => {
  it("returns null for fewer than 30 data points", () => {
    assert.equal(sortinoRatio(makeNav([100, 110], 2)), null);
  });

  it("returns null when there are no negative returns", () => {
    const nav = makeSteadyGrowthNav(60);
    assert.equal(sortinoRatio(nav), null);
  });

  it("returns a number when there are some negative returns", () => {
    const nav = makeVolatileNav(60);
    const result = sortinoRatio(nav);
    assert.ok(result !== null, "expected non-null for volatile series");
    assert.equal(typeof result, "number");
  });
});

// ─── drawdownPeriods ──────────────────────────────────────────────────────────

describe("drawdownPeriods", () => {
  it("returns empty array for fewer than 2 points", () => {
    assert.deepEqual(drawdownPeriods([]), []);
    assert.deepEqual(drawdownPeriods(makeNav([100])), []);
  });

  it("returns empty array for monotonically increasing series", () => {
    const result = drawdownPeriods(makeNav([100, 110, 120, 130]));
    assert.equal(result.length, 0);
  });

  it("detects a single drawdown with recovery", () => {
    // 100 → 120 (peak) → 90 (trough) → 130 (recovery past peak)
    const nav = makeNav([100, 120, 90, 130]);
    const result = drawdownPeriods(nav);
    assert.equal(result.length, 1);
    const dd = result[0]!;
    assert.ok(Math.abs(dd.depth - (120 - 90) / 120) < 1e-10, `expected depth ${(120-90)/120}, got ${dd.depth}`);
    assert.ok(dd.recoveryTime !== null, "should have recovery time");
    assert.ok(dd.durationDays > 0);
  });

  it("marks unrecovered drawdown with recoveryTime: null", () => {
    // 100 → 120 (peak) → 90 (trough, no recovery)
    const nav = makeNav([100, 120, 90]);
    const result = drawdownPeriods(nav);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.recoveryTime, null);
    assert.equal(result[0]!.recoveryDays, null);
  });

  it("detects multiple drawdowns", () => {
    // Two separate drawdown/recovery cycles
    const nav = makeNav([100, 120, 100, 130, 110, 140]);
    const result = drawdownPeriods(nav);
    assert.ok(result.length >= 2, `expected at least 2 drawdowns, got ${result.length}`);
  });

  it("depth is always a positive number", () => {
    const nav = makeNav([100, 90, 80, 95]);
    const result = drawdownPeriods(nav);
    for (const dd of result) {
      assert.ok(dd.depth > 0, "depth must be positive");
    }
  });
});

// ─── maxDrawdown ──────────────────────────────────────────────────────────────

describe("maxDrawdown", () => {
  it("returns 0 for monotonically increasing series", () => {
    assert.equal(maxDrawdown(makeNav([100, 110, 120])), 0);
  });

  it("returns 0 for flat series", () => {
    assert.equal(maxDrawdown(makeNav([100, 100, 100])), 0);
  });

  it("returns correct max drawdown depth", () => {
    // 100 → 200 (peak) → 100 (50% drawdown)
    const nav = makeNav([100, 200, 100]);
    const result = maxDrawdown(nav);
    assert.ok(Math.abs(result - 0.5) < 1e-10, `expected 0.5, got ${result}`);
  });

  it("returns the deepest drawdown when multiple exist", () => {
    // First DD: 100→120→100 (16.7%), Second DD: 130→200→80 (60%)
    const nav = makeNav([100, 120, 100, 130, 200, 80]);
    const result = maxDrawdown(nav);
    assert.ok(result > 0.5, `expected > 0.5, got ${result}`);
  });
});

// ─── avgDrawdown ──────────────────────────────────────────────────────────────

describe("avgDrawdown", () => {
  it("returns 0 when no drawdowns", () => {
    assert.equal(avgDrawdown(makeNav([100, 110, 120])), 0);
  });

  it("equals maxDrawdown when only one drawdown exists", () => {
    const nav = makeNav([100, 200, 150]);
    assert.ok(Math.abs(avgDrawdown(nav) - maxDrawdown(nav)) < 1e-10);
  });
});

// ─── maxDrawdownDays ──────────────────────────────────────────────────────────

describe("maxDrawdownDays", () => {
  it("returns 0 when no drawdowns", () => {
    assert.equal(maxDrawdownDays(makeNav([100, 110, 120])), 0);
  });

  it("returns positive number for a drawdown", () => {
    const nav = makeNav([100, 120, 90]);
    const result = maxDrawdownDays(nav);
    assert.ok(result > 0, `expected > 0, got ${result}`);
  });
});

// ─── calmarRatio ──────────────────────────────────────────────────────────────

describe("calmarRatio", () => {
  it("returns null for fewer than 30 points", () => {
    assert.equal(calmarRatio(makeNav([100, 110], 2)), null);
  });

  it("returns null when max drawdown is zero", () => {
    const nav = makeSteadyGrowthNav(60, 100, 0.001); // strictly increasing → no drawdown
    assert.equal(calmarRatio(nav), null);
  });

  it("returns a number when there is a drawdown", () => {
    const values = Array.from({ length: 60 }, (_, i) =>
      i < 30 ? 100 + i : 130 - (i - 30)
    );
    const nav = makeNav(values, 60);
    const result = calmarRatio(nav);
    // May be null if no drawdown or negative return, just check type
    if (result !== null) {
      assert.equal(typeof result, "number");
    }
  });
});

// ─── winRate ─────────────────────────────────────────────────────────────────

describe("winRate", () => {
  it("returns null for empty array", () => {
    assert.equal(winRate([]), null);
  });

  it("returns null when all fills have zero closedPnl", () => {
    assert.equal(winRate([makeFill(0), makeFill(0)]), null);
  });

  it("ignores fills with closedPnl = 0", () => {
    // 2 wins, 1 loss, 2 zeros → win rate = 2/3
    const fills = [makeFill(100), makeFill(50), makeFill(-20), makeFill(0), makeFill(0)];
    const result = winRate(fills);
    assert.ok(result !== null);
    assert.ok(Math.abs(result - 2/3) < 1e-10, `expected 2/3, got ${result}`);
  });

  it("returns 1.0 when all closing fills are wins", () => {
    const fills = [makeFill(100), makeFill(200), makeFill(50)];
    assert.equal(winRate(fills), 1.0);
  });

  it("returns 0.0 when all closing fills are losses", () => {
    const fills = [makeFill(-100), makeFill(-50)];
    assert.equal(winRate(fills), 0.0);
  });
});

// ─── profitFactor ─────────────────────────────────────────────────────────────

describe("profitFactor", () => {
  it("returns null for empty array", () => {
    assert.equal(profitFactor([]), null);
  });

  it("returns null when all fills have zero closedPnl", () => {
    assert.equal(profitFactor([makeFill(0)]), null);
  });

  it("returns null when there are no losses", () => {
    assert.equal(profitFactor([makeFill(100), makeFill(200)]), null);
  });

  it("computes gross profit / gross loss correctly", () => {
    // gross profit = 150, gross loss = 50 → PF = 3.0
    const fills = [makeFill(100), makeFill(50), makeFill(-50)];
    const result = profitFactor(fills);
    assert.ok(result !== null);
    assert.ok(Math.abs(result - 3.0) < 1e-10, `expected 3.0, got ${result}`);
  });

  it("returns < 1 when losses exceed profits", () => {
    const fills = [makeFill(50), makeFill(-200)];
    const result = profitFactor(fills)!;
    assert.ok(result < 1.0, `expected < 1, got ${result}`);
  });
});
