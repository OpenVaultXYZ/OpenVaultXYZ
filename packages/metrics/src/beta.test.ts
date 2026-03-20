/**
 * Tests for beta.ts
 *
 * Run: pnpm test (from packages/metrics/)
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { betaToMarket, type PricePoint } from "./beta.js";
import type { NavPoint } from "./returns.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_TIME = new Date("2025-01-01T00:00:00Z").getTime();

function makeNav(values: number[]): NavPoint[] {
  return values.map((accountValue, i) => ({
    time: new Date(BASE_TIME + i * DAY_MS),
    accountValue,
  }));
}

function makePrices(values: number[]): PricePoint[] {
  return values.map((price, i) => ({
    time: new Date(BASE_TIME + i * DAY_MS),
    price,
  }));
}

// ─── Helpers for beta tests ───────────────────────────────────────────────────

/** Build NAV values from a series of per-period returns. */
function buildNavFromReturns(returns: number[], startValue = 100): number[] {
  const values = [startValue];
  for (const r of returns) {
    values.push(values[values.length - 1]! * (1 + r));
  }
  return values;
}

// Varying return series — realistic mix of positive and negative returns.
// Using explicit variation prevents the zero-variance problem in OLS.
const MARKET_RETURNS = [
  0.03, -0.02, 0.04, -0.01, 0.02, -0.03, 0.05, -0.02, 0.01, 0.03,
  -0.01, 0.02, -0.04, 0.03, -0.01, 0.02, 0.04, -0.03, 0.01, -0.02,
];

// ─── betaToMarket ─────────────────────────────────────────────────────────────

describe("betaToMarket", () => {
  it("returns null when vault has fewer than 2 points", () => {
    const market = makePrices([100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200]);
    assert.equal(betaToMarket(makeNav([100]), market), null);
  });

  it("returns null when market has fewer than 2 points", () => {
    const vault = makeNav([100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200]);
    assert.equal(betaToMarket(vault, makePrices([100])), null);
  });

  it("returns null when fewer than 10 aligned pairs exist", () => {
    // Only 5 matching timestamps
    const vault = makeNav([100, 110, 120, 130, 140]);
    const market = makePrices([1000, 1100, 1200, 1300, 1400]);
    assert.equal(betaToMarket(vault, market), null);
  });

  it("returns ~1.0 for perfectly correlated series (same returns)", () => {
    // Vault and market have identical per-period returns → beta = 1
    const vaultValues = buildNavFromReturns(MARKET_RETURNS, 100);
    const marketValues = buildNavFromReturns(MARKET_RETURNS, 1000);
    const result = betaToMarket(makeNav(vaultValues), makePrices(marketValues));
    assert.ok(result !== null, "expected non-null");
    assert.ok(Math.abs(result - 1.0) < 0.01, `expected ~1.0, got ${result}`);
  });

  it("returns ~2.0 for 2x leveraged series", () => {
    // Vault has 2x market's return each period → beta = 2
    const vaultReturns = MARKET_RETURNS.map((r) => r * 2);
    const vaultValues = buildNavFromReturns(vaultReturns, 100);
    const marketValues = buildNavFromReturns(MARKET_RETURNS, 1000);
    const result = betaToMarket(makeNav(vaultValues), makePrices(marketValues));
    assert.ok(result !== null, "expected non-null");
    assert.ok(Math.abs(result - 2.0) < 0.05, `expected ~2.0, got ${result}`);
  });

  it("returns near zero for uncorrelated series", () => {
    // Vault is flat (all returns = 0), market varies — zero covariance → beta ≈ 0
    const n = 21;
    const vaultValues = Array(n).fill(100);
    const marketValues = buildNavFromReturns(MARKET_RETURNS, 1000);
    const result = betaToMarket(makeNav(vaultValues), makePrices(marketValues));
    assert.ok(result !== null, "expected non-null");
    assert.ok(Math.abs(result) < 0.1, `expected near 0, got ${result}`);
  });

  it("returns negative beta for inverse series", () => {
    // Vault has -1x market returns → beta = -1
    const vaultReturns = MARKET_RETURNS.map((r) => -r);
    const vaultValues = buildNavFromReturns(vaultReturns, 100);
    const marketValues = buildNavFromReturns(MARKET_RETURNS, 1000);
    const result = betaToMarket(makeNav(vaultValues), makePrices(marketValues));
    assert.ok(result !== null, "expected non-null");
    assert.ok(result < 0, `expected negative beta, got ${result}`);
  });

  it("aligns series within 1-hour tolerance", () => {
    // Vault timestamps are 30 minutes offset from market — should still align
    const HOUR_MS = 60 * 60 * 1000;
    const n = 15;
    const vaultNav: NavPoint[] = Array.from({ length: n }, (_, i) => ({
      time: new Date(BASE_TIME + i * DAY_MS + 30 * 60 * 1000), // +30 min offset
      accountValue: 100 * Math.pow(1.01, i),
    }));
    const marketPrices: PricePoint[] = Array.from({ length: n }, (_, i) => ({
      time: new Date(BASE_TIME + i * DAY_MS),
      price: 1000 * Math.pow(1.01, i),
    }));
    const result = betaToMarket(vaultNav, marketPrices);
    assert.ok(result !== null, "should align within 1-hour tolerance");
  });

  it("returns null for market with zero variance", () => {
    // Flat market → variance = 0 → beta undefined
    const n = 15;
    const vault = makeNav(Array.from({ length: n }, (_, i) => 100 * Math.pow(1.01, i)));
    const market = makePrices(Array(n).fill(1000)); // flat
    const result = betaToMarket(vault, market);
    assert.equal(result, null);
  });
});
