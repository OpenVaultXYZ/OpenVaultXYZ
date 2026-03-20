/**
 * Canonical normalized types — the internal schema that all platform
 * translators produce and that the metrics engine consumes.
 *
 * These types must never contain platform-specific field names (no `px`,
 * `sz`, `tid`, `coin`, etc.). If you find a HL field name here, it's a bug.
 *
 * Translators live in their respective platform packages:
 *   packages/hyperliquid/translator.ts  → NormalizedFill
 *   packages/lighter/translator.ts      → NormalizedFill  (future)
 */

// ─── Fills ────────────────────────────────────────────────────────────────────

export interface NormalizedFill {
  // Identity
  tradeId: string         // unique fill ID (HL: String(tid))
  platform: string        // "hyperliquid" | "lighter" | "dydx" etc.
  vaultAddress: string    // vault this fill belongs to

  // Trade data
  asset: string           // coin/market (HL: coin)
  price: number           // execution price (HL: parseFloat(px))
  size: number            // size filled (HL: parseFloat(sz))
  side: "buy" | "sell"    // direction — "A" fills resolved here, never downstream
  time: Date              // execution time (HL: new Date(time))

  // PnL
  realizedPnl: number     // closed PnL for this fill; 0 for opens (HL: parseFloat(closedPnl))
  fee: number             // fee paid (HL: parseFloat(fee))
  feeAsset: string        // currency of fee (HL: feeToken)

  // Position context
  positionBefore: number  // signed size before this fill (HL: parseFloat(startPosition))
  direction: string       // "Open Long" | "Close Short" etc. (HL: dir)

  // Risk flags
  isAdlEvent: boolean     // auto-deleveraged fill (HL: side === "A")
  isTwap: boolean         // part of a TWAP order (HL: twapId !== null)
  isTaker: boolean        // true = taker (crossed spread) (HL: crossed)

  // Raw reference
  orderId: number         // order ID (HL: oid)
  rawHash: string         // transaction hash (HL: hash)
}

// ─── Vault NAV snapshots ──────────────────────────────────────────────────────

export interface NormalizedVaultSnapshot {
  vaultAddress: string
  platform: string
  time: Date
  nav: number             // net asset value / total account value
  totalNotional: number   // total notional position size
  totalMarginUsed: number
  withdrawable: number
}

// ─── Open positions ───────────────────────────────────────────────────────────

export interface NormalizedPosition {
  vaultAddress: string
  platform: string
  asset: string
  size: number              // positive = long, negative = short
  entryPrice: number
  markPrice: number         // computed from positionValue / |size|
  unrealizedPnl: number
  marginUsed: number
  leverage: number
  liquidationPrice: number | null
  isIsolated: boolean
  snapshotTime: Date
}
