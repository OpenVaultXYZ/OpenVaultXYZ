/**
 * Tests for translator.ts — verifies HL raw → NormalizedFill translation.
 *
 * Run: node --test dist/translator.test.js  (after pnpm build)
 *
 * Tests the three cases that matter most:
 *   1. Standard buy fill ("B")
 *   2. Standard sell/close fill ("S")
 *   3. ADL fill ("A") — long position (positive startPosition)
 *   4. ADL fill ("A") — short position (negative startPosition)
 *   5. TWAP fill (twapId non-null)
 *   6. Snapshot translation
 *   7. Position translation (including markPrice computation)
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { translateFill, translateFills, translateSnapshot, translatePosition } from "./translator.js";
import type { Fill, ClearinghouseState, AssetPosition } from "./types.js";

// ─── Shared fixture ───────────────────────────────────────────────────────────

const VAULT = "0xabc123";

function makeFill(overrides: Partial<Fill> = {}): Fill {
  return {
    coin: "BTC",
    px: "70000.0",
    sz: "0.5",
    side: "B",
    time: 1700000000000,
    startPosition: "0.0",
    dir: "Open Long",
    closedPnl: "0.0",
    hash: "0xdeadbeef",
    oid: 12345,
    crossed: true,
    fee: "3.50",
    tid: 987654321,
    feeToken: "USDC",
    twapId: null,
    ...overrides,
  };
}

// ─── Fill translation ─────────────────────────────────────────────────────────

describe("translateFill — buy fill (side B)", () => {
  it("maps all fields correctly", () => {
    const fill = makeFill({ side: "B", startPosition: "0.0", closedPnl: "0.0" });
    const result = translateFill(fill, VAULT);

    assert.equal(result.platform, "hyperliquid");
    assert.equal(result.vaultAddress, VAULT);
    assert.equal(result.tradeId, "987654321");
    assert.equal(result.asset, "BTC");
    assert.equal(result.price, 70000.0);
    assert.equal(result.size, 0.5);
    assert.equal(result.side, "buy");
    assert.equal(result.isAdlEvent, false);
    assert.equal(result.isTwap, false);
    assert.equal(result.isTaker, true);
    assert.equal(result.realizedPnl, 0.0);
    assert.equal(result.fee, 3.50);
    assert.equal(result.feeAsset, "USDC");
    assert.equal(result.positionBefore, 0.0);
    assert.equal(result.direction, "Open Long");
    assert.equal(result.orderId, 12345);
    assert.equal(result.rawHash, "0xdeadbeef");
    assert.ok(result.time instanceof Date);
    assert.equal(result.time.getTime(), 1700000000000);
  });
});

describe("translateFill — sell/close fill (side S)", () => {
  it("sets side=sell and captures closedPnl", () => {
    const fill = makeFill({
      side: "S",
      startPosition: "0.5",
      dir: "Close Long",
      closedPnl: "150.25",
    });
    const result = translateFill(fill, VAULT);

    assert.equal(result.side, "sell");
    assert.equal(result.isAdlEvent, false);
    assert.equal(result.realizedPnl, 150.25);
    assert.equal(result.positionBefore, 0.5);
    assert.equal(result.direction, "Close Long");
  });
});

describe("translateFill — ask-side fill (side A, closing a long)", () => {
  it("maps to side=sell, isAdlEvent=false", () => {
    const fill = makeFill({
      side: "A",
      startPosition: "1.5",
      dir: "Close Long",
      closedPnl: "-200.00",
    });
    const result = translateFill(fill, VAULT);

    assert.equal(result.side, "sell", "ask-side fill should produce side=sell");
    assert.equal(result.isAdlEvent, false, "A fills are ask-side, not ADL events");
    assert.equal(result.realizedPnl, -200.00);
    assert.equal(result.positionBefore, 1.5);
  });
});

describe("translateFill — ask-side fill (side A, opening a short)", () => {
  it("maps to side=sell, isAdlEvent=false regardless of positionBefore", () => {
    const fill = makeFill({
      side: "A",
      startPosition: "-2.0",  // already short, adding more
      dir: "Open Short",
      closedPnl: "0.00",
    });
    const result = translateFill(fill, VAULT);

    assert.equal(result.side, "sell", "A fill opening a short is still side=sell");
    assert.equal(result.isAdlEvent, false);
    assert.equal(result.positionBefore, -2.0);
  });
});

describe("translateFill — TWAP fill (twapId non-null)", () => {
  it("sets isTwap=true", () => {
    const fill = makeFill({ twapId: 99001 });
    const result = translateFill(fill, VAULT);
    assert.equal(result.isTwap, true);
  });
});

describe("translateFills — batch translation", () => {
  it("translates an array and preserves length", () => {
    const fills = [
      makeFill({ tid: 1, side: "B" }),
      makeFill({ tid: 2, side: "S", startPosition: "0.5", closedPnl: "10.0" }),
      makeFill({ tid: 3, side: "A", startPosition: "1.0" }),
    ];
    const results = translateFills(fills, VAULT);

    assert.equal(results.length, 3);
    assert.equal(results[0]!.side, "buy");
    assert.equal(results[1]!.side, "sell");
    assert.equal(results[2]!.side, "sell");   // A = ask-side fill = sell
    assert.equal(results[2]!.isAdlEvent, false);
  });
});

// ─── Snapshot translation ─────────────────────────────────────────────────────

describe("translateSnapshot", () => {
  it("maps clearinghouseState fields correctly", () => {
    const state: ClearinghouseState = {
      marginSummary: {
        accountValue: "500000.00",
        totalNtlPos: "150000.00",
        totalRawUsd: "499000.00",
        totalMarginUsed: "7500.00",
      },
      crossMarginSummary: {
        accountValue: "500000.00",
        totalNtlPos: "150000.00",
        totalRawUsd: "499000.00",
        totalMarginUsed: "7500.00",
      },
      crossMaintenanceMarginUsed: "1500.00",
      withdrawable: "492500.00",
      assetPositions: [],
      time: 1700000000000,
    };

    const result = translateSnapshot(state, VAULT);

    assert.equal(result.platform, "hyperliquid");
    assert.equal(result.vaultAddress, VAULT);
    assert.equal(result.nav, 500000.00);
    assert.equal(result.totalNotional, 150000.00);
    assert.equal(result.totalMarginUsed, 7500.00);
    assert.equal(result.withdrawable, 492500.00);
    assert.ok(result.time instanceof Date);
    assert.equal(result.time.getTime(), 1700000000000);
  });
});

// ─── Position translation ─────────────────────────────────────────────────────

describe("translatePosition — long position", () => {
  it("computes markPrice and maps all fields", () => {
    const ap: AssetPosition = {
      type: "oneWay",
      position: {
        coin: "ETH",
        szi: "10.0",
        leverage: { type: "cross", value: 5 },
        entryPx: "3000.0",
        positionValue: "32000.0",   // markPrice = 32000 / 10 = 3200
        unrealizedPnl: "2000.0",
        returnOnEquity: "0.10",
        liquidationPx: "2500.0",
        marginUsed: "6400.0",
        maxLeverage: 50,
        cumFunding: { allTime: "-100.0", sinceOpen: "-50.0", sinceChange: "0.0" },
      },
    };
    const snapshotTime = new Date(1700000000000);
    const result = translatePosition(ap, VAULT, snapshotTime);

    assert.equal(result.platform, "hyperliquid");
    assert.equal(result.vaultAddress, VAULT);
    assert.equal(result.asset, "ETH");
    assert.equal(result.size, 10.0);
    assert.equal(result.entryPrice, 3000.0);
    assert.equal(result.markPrice, 3200.0);
    assert.equal(result.unrealizedPnl, 2000.0);
    assert.equal(result.marginUsed, 6400.0);
    assert.equal(result.leverage, 5);
    assert.equal(result.liquidationPrice, 2500.0);
    assert.equal(result.isIsolated, false);
    assert.equal(result.snapshotTime, snapshotTime);
  });
});

describe("translatePosition — short position with no liquidation risk", () => {
  it("sets liquidationPrice=null and isIsolated correctly", () => {
    const ap: AssetPosition = {
      type: "oneWay",
      position: {
        coin: "BTC",
        szi: "-0.5",
        leverage: { type: "isolated", value: 3 },
        entryPx: "70000.0",
        positionValue: "34000.0",
        unrealizedPnl: "1000.0",
        returnOnEquity: "0.05",
        liquidationPx: null,
        marginUsed: "11333.0",
        maxLeverage: 50,
        cumFunding: { allTime: "200.0", sinceOpen: "100.0", sinceChange: "0.0" },
      },
    };
    const result = translatePosition(ap, VAULT, new Date());

    assert.equal(result.size, -0.5);
    assert.equal(result.liquidationPrice, null);
    assert.equal(result.isIsolated, true);
    // markPrice = 34000 / |-0.5| = 34000 / 0.5 = 68000
    assert.equal(result.markPrice, 68000.0);
  });
});
