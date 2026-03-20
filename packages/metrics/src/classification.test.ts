/**
 * Tests for classification.ts
 *
 * Run: pnpm test (from packages/metrics/)
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  classifyStrategy,
  type FillForClassification,
  type PositionForClassification,
} from "./classification.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_TIME = new Date("2025-01-01T00:00:00Z").getTime();

/**
 * Build fill fixtures that simulate a given fills-per-day rate over a span.
 * Each open/close pair spans holdMs milliseconds.
 */
function makeFills(
  count: number,
  spanDays: number,
  holdMs: number,
  dir: "Long" | "Short" = "Long",
  closedPnl = 10,
): FillForClassification[] {
  const fills: FillForClassification[] = [];
  const intervalMs = (spanDays * DAY_MS) / count;

  for (let i = 0; i < count; i++) {
    const openTime = BASE_TIME + i * intervalMs;
    fills.push({
      coin: "BTC",
      side: dir === "Long" ? "B" : "S",
      time: openTime,
      sz: 0.1,
      closedPnl: 0,
      dir: `Open ${dir}`,
    });
    fills.push({
      coin: "BTC",
      side: dir === "Long" ? "S" : "B",
      time: openTime + holdMs,
      sz: 0.1,
      closedPnl,
      dir: `Close ${dir}`,
    });
  }

  return fills;
}

function noPositions(): PositionForClassification[] {
  return [];
}

// ─── classifyStrategy — insufficient data ────────────────────────────────────

describe("classifyStrategy — insufficient data", () => {
  it("returns unknown with low confidence for fewer than 10 fills", () => {
    const result = classifyStrategy([], noPositions());
    assert.equal(result.strategyType, "unknown");
    assert.equal(result.confidence, "low");
  });

  it("returns unknown for 9 fills", () => {
    const fills = makeFills(4, 1, 60 * 60 * 1000).slice(0, 9);
    const result = classifyStrategy(fills, noPositions());
    assert.equal(result.strategyType, "unknown");
  });
});

// ─── classifyStrategy — hf_market_making ─────────────────────────────────────

describe("classifyStrategy — hf_market_making", () => {
  it("classifies very high frequency (> 500/day) as hf_market_making", () => {
    // 600 fills in 1 day = 600/day, hold time very short (1 min)
    const fills = makeFills(300, 1, 60 * 1000); // 300 open/close pairs = 600 fills total
    const result = classifyStrategy(fills, noPositions());
    assert.equal(result.strategyType, "hf_market_making");
    assert.equal(result.confidence, "high");
  });

  it("classifies 200/day with sub-6-minute holds as hf_market_making", () => {
    // 200 fills/day, hold 5 minutes (< 0.1 hours)
    const fills = makeFills(100, 1, 5 * 60 * 1000);
    const result = classifyStrategy(fills, noPositions());
    assert.equal(result.strategyType, "hf_market_making");
    assert.equal(result.confidence, "high");
  });
});

// ─── classifyStrategy — funding_arb ──────────────────────────────────────────

describe("classifyStrategy — funding_arb", () => {
  it("classifies dominant funding income with balanced long/short as funding_arb", () => {
    // Mix of longs and shorts (balanced ~50/50), low realized PnL, high funding
    const longFills = makeFills(20, 30, 12 * 60 * 60 * 1000, "Long", 5);
    const shortFills = makeFills(20, 30, 12 * 60 * 60 * 1000, "Short", 5);
    const allFills = [...longFills, ...shortFills];

    // Positions with large cumulative funding relative to realized PnL
    const positions: PositionForClassification[] = [
      { coin: "BTC", szi: 0.5, cumFundingAllTime: 10000, positionValue: 50000 },
      { coin: "BTC", szi: -0.5, cumFundingAllTime: 10000, positionValue: 50000 },
    ];

    const result = classifyStrategy(allFills, positions);
    assert.equal(result.strategyType, "funding_arb");
    assert.equal(result.confidence, "high");
  });
});

// ─── classifyStrategy — mean_reversion ───────────────────────────────────────

describe("classifyStrategy — mean_reversion", () => {
  it("classifies short holds + high frequency + balanced bias as mean_reversion", () => {
    // ~30 fills/day, 2-hour holds, balanced long/short
    const longFills = makeFills(30, 2, 2 * 60 * 60 * 1000, "Long");
    const shortFills = makeFills(30, 2, 2 * 60 * 60 * 1000, "Short");
    const result = classifyStrategy([...longFills, ...shortFills], noPositions());
    assert.equal(result.strategyType, "mean_reversion");
  });
});

// ─── classifyStrategy — directional_macro ────────────────────────────────────

describe("classifyStrategy — directional_macro", () => {
  it("classifies low frequency + long holds + concentrated as directional_macro", () => {
    // 1 trade every 2 days, 12-hour holds, concentrated in 1 coin
    const fills = makeFills(15, 30, 12 * 60 * 60 * 1000, "Long");
    const positions: PositionForClassification[] = [
      { coin: "BTC", szi: 1.0, cumFundingAllTime: 50, positionValue: 70000 },
    ];
    const result = classifyStrategy(fills, positions);
    assert.equal(result.strategyType, "directional_macro");
  });
});

// ─── classifyStrategy — momentum ─────────────────────────────────────────────

describe("classifyStrategy — momentum", () => {
  it("classifies medium holds + medium frequency as momentum", () => {
    // ~10 fills/day, 8-hour holds, directional long bias
    const fills = makeFills(30, 6, 8 * 60 * 60 * 1000, "Long");
    const result = classifyStrategy(fills, noPositions());
    assert.equal(result.strategyType, "momentum");
  });
});

// ─── classifyStrategy — signals ──────────────────────────────────────────────

describe("classifyStrategy — signals", () => {
  it("always includes observable signals in result", () => {
    const fills = makeFills(10, 10, 60 * 60 * 1000);
    const result = classifyStrategy(fills, noPositions());
    assert.ok("holdTimeHours" in result.signals);
    assert.ok("fillsPerDay" in result.signals);
    assert.ok("longBiasRatio" in result.signals);
    assert.ok("concentrationHHI" in result.signals);
    assert.ok("fillCount" in result.signals);
  });

  it("fillCount signal matches actual fill count", () => {
    const fills = makeFills(10, 10, 60 * 60 * 1000);
    const result = classifyStrategy(fills, noPositions());
    assert.equal(result.signals.fillCount, fills.length);
  });
});
