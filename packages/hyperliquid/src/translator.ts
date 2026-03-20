/**
 * Hyperliquid → Normalized translation layer.
 *
 * This is the ONLY place in the codebase where Hyperliquid-specific field
 * names (px, sz, tid, coin, side "A", etc.) are known. Everything downstream
 * uses NormalizedFill and its siblings.
 *
 * Three translators:
 *   translateFill()     — one raw HL fill → NormalizedFill
 *   translateSnapshot() — clearinghouseState → NormalizedVaultSnapshot
 *   translatePosition() — one assetPosition → NormalizedPosition
 */

import type { NormalizedFill, NormalizedPosition, NormalizedVaultSnapshot } from "@openvault/db";
import type { AssetPosition, ClearinghouseState, Fill } from "./types.js";

const PLATFORM = "hyperliquid";

// ─── Fill ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the normalized side from a raw HL fill.
 *
 * HL uses three side values:
 *   "B" = bid-side fill (buy direction)
 *   "S" = sell-side fill (sell direction)
 *   "A" = ask-side fill (also sell direction — the maker sell counterpart to "B")
 *
 * "A" is NOT auto-deleveraged. It is a regular sell-side fill. Market-making
 * vaults (HLP Strategy A, Growi HF) have ~50% "A" fills with no "S" fills —
 * they trade purely on bid/ask. Directional vaults mix all three.
 *
 * isAdlEvent is set to false for all fills. True ADL detection requires
 * additional data (position history or userFunding) that fills alone don't
 * provide. The field is reserved for future implementation.
 */
function resolveSide(rawSide: "B" | "S" | "A"): { side: "buy" | "sell"; isAdlEvent: boolean } {
  if (rawSide === "B") return { side: "buy",  isAdlEvent: false };
  if (rawSide === "S") return { side: "sell", isAdlEvent: false };
  /* rawSide === "A" */ return { side: "sell", isAdlEvent: false };
}

/**
 * Translate one raw Hyperliquid fill into a NormalizedFill.
 * All HL string numerics are parsed to numbers here.
 */
export function translateFill(fill: Fill, vaultAddress: string): NormalizedFill {
  const positionBefore = parseFloat(fill.startPosition);
  const { side, isAdlEvent } = resolveSide(fill.side);

  return {
    tradeId:        String(fill.tid),
    platform:       PLATFORM,
    vaultAddress,
    asset:          fill.coin,
    price:          parseFloat(fill.px),
    size:           parseFloat(fill.sz),
    side,
    time:           new Date(fill.time),
    realizedPnl:    parseFloat(fill.closedPnl),
    fee:            parseFloat(fill.fee),
    feeAsset:       fill.feeToken,
    positionBefore,
    direction:      fill.dir,
    isAdlEvent,
    isTwap:         fill.twapId !== null,
    isTaker:        fill.crossed,
    orderId:        fill.oid,
    rawHash:        fill.hash,
  };
}

/**
 * Translate an array of raw fills — convenience wrapper.
 */
export function translateFills(fills: Fill[], vaultAddress: string): NormalizedFill[] {
  return fills.map((f) => translateFill(f, vaultAddress));
}

// ─── Vault snapshot ───────────────────────────────────────────────────────────

/**
 * Translate a clearinghouseState response into a NormalizedVaultSnapshot.
 */
export function translateSnapshot(
  state: ClearinghouseState,
  vaultAddress: string,
): NormalizedVaultSnapshot {
  const summary = state.marginSummary;
  return {
    vaultAddress,
    platform:         PLATFORM,
    time:             new Date(state.time),
    nav:              parseFloat(summary.accountValue),
    totalNotional:    parseFloat(summary.totalNtlPos),
    totalMarginUsed:  parseFloat(summary.totalMarginUsed),
    withdrawable:     parseFloat(state.withdrawable),
  };
}

// ─── Position ─────────────────────────────────────────────────────────────────

/**
 * Translate one HL assetPosition into a NormalizedPosition.
 * markPrice is computed from positionValue / |size| since HL doesn't return it directly.
 */
export function translatePosition(
  ap: AssetPosition,
  vaultAddress: string,
  snapshotTime: Date,
): NormalizedPosition {
  const p = ap.position;
  const size = parseFloat(p.szi);
  const positionValue = parseFloat(p.positionValue);
  const absSize = Math.abs(size);
  const markPrice = absSize > 0 ? positionValue / absSize : parseFloat(p.entryPx);

  return {
    vaultAddress,
    platform:         PLATFORM,
    asset:            p.coin,
    size,
    entryPrice:       parseFloat(p.entryPx),
    markPrice,
    unrealizedPnl:    parseFloat(p.unrealizedPnl),
    marginUsed:       parseFloat(p.marginUsed),
    leverage:         p.leverage.value,
    liquidationPrice: p.liquidationPx !== null ? parseFloat(p.liquidationPx) : null,
    isIsolated:       p.leverage.type === "isolated",
    snapshotTime,
  };
}
