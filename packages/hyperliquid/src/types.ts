/**
 * Zod schemas and TypeScript types for the Hyperliquid Info API.
 *
 * All schemas are derived from EXPLORATION.md — actual observed API responses,
 * not documentation assumptions. The API changes without warning; Zod validation
 * on every response catches schema drift early.
 *
 * Key fact: ALL numeric values come back as strings ("123.456"). Parse with
 * parseFloat() at the consumption site, never in the schema.
 */

import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Decimal number returned as a string by the API */
const DecimalString = z.string();

/** Unix timestamp in milliseconds */
const TimestampMs = z.number();

/** Ethereum-style hex address (lowercase, 0x-prefixed, 42 chars) */
const Address = z.string().regex(/^0x[0-9a-f]{40}$/i);

// ─── userRole ─────────────────────────────────────────────────────────────────

export const UserRoleResponseSchema = z.object({
  role: z.enum(["vault", "user", "agent", "subAccount", "missing"]),
});

export type UserRoleResponse = z.infer<typeof UserRoleResponseSchema>;

// ─── Follower entry inside vaultDetails ──────────────────────────────────────

export const VaultFollowerSchema = z.object({
  user: z.string(),
  vaultEquity: DecimalString,
  pnl: DecimalString,
  allTimePnl: DecimalString,
  daysFollowing: z.number(),
  vaultEntryTime: TimestampMs,
  lockupUntil: TimestampMs,
});

export type VaultFollower = z.infer<typeof VaultFollowerSchema>;

// ─── Portfolio history (embedded in vaultDetails + standalone portfolio) ──────

const PortfolioHistoryEntrySchema = z.object({
  accountValueHistory: z.array(z.tuple([TimestampMs, DecimalString])),
  pnlHistory: z.array(z.tuple([TimestampMs, DecimalString])),
  vlm: DecimalString,
});

const PortfolioTimespanSchema = z.tuple([
  z.enum(["day", "week", "month", "allTime", "perpDay", "perpWeek", "perpMonth", "perpAllTime"]),
  PortfolioHistoryEntrySchema,
]);

export const PortfolioHistorySchema = z.array(PortfolioTimespanSchema);

export type PortfolioHistory = z.infer<typeof PortfolioHistorySchema>;

// ─── vaultDetails ─────────────────────────────────────────────────────────────

export const VaultDetailsSchema = z.object({
  name: z.string(),
  vaultAddress: Address,
  leader: Address,
  description: z.string(),
  portfolio: PortfolioHistorySchema,
  apr: z.number(),
  followerState: z.null(),
  leaderFraction: z.number(),
  leaderCommission: z.number(),
  followers: z.array(VaultFollowerSchema),
  maxDistributable: z.number(),
  maxWithdrawable: z.number(),
  isClosed: z.boolean(),
  relationship: z.object({ type: z.enum(["parent", "child", "normal"]) }).nullable(),
  allowDeposits: z.boolean(),
  alwaysCloseOnWithdraw: z.boolean(),
});

export type VaultDetails = z.infer<typeof VaultDetailsSchema>;

// ─── userFills / userFillsByTime ──────────────────────────────────────────────

export const FillSchema = z.object({
  coin: z.string(),
  px: DecimalString,
  sz: DecimalString,
  side: z.enum(["B", "S", "A"]),  // A = auto-deleveraged (ADL) / forced liquidation
  time: TimestampMs,
  startPosition: DecimalString,
  dir: z.string(), // "Open Long" | "Close Long" | "Open Short" | "Close Short"
  closedPnl: DecimalString,
  hash: z.string(),
  oid: z.number(),
  crossed: z.boolean(),
  fee: DecimalString,
  tid: z.number(),
  feeToken: z.string(),
  twapId: z.number().nullable(),
});

export type Fill = z.infer<typeof FillSchema>;

export const FillsSchema = z.array(FillSchema);

// ─── clearinghouseState ───────────────────────────────────────────────────────

const MarginSummarySchema = z.object({
  accountValue: DecimalString,
  totalNtlPos: DecimalString,
  totalRawUsd: DecimalString,
  totalMarginUsed: DecimalString,
});

const LeverageSchema = z.object({
  type: z.enum(["cross", "isolated"]),
  value: z.number(),
});

const CumFundingSchema = z.object({
  allTime: DecimalString,
  sinceOpen: DecimalString,
  sinceChange: DecimalString,
});

const PositionDataSchema = z.object({
  coin: z.string(),
  szi: DecimalString,
  leverage: LeverageSchema,
  entryPx: DecimalString,
  positionValue: DecimalString,
  unrealizedPnl: DecimalString,
  returnOnEquity: DecimalString,
  liquidationPx: DecimalString.nullable(),
  marginUsed: DecimalString,
  maxLeverage: z.number(),
  cumFunding: CumFundingSchema,
});

const AssetPositionSchema = z.object({
  type: z.literal("oneWay"),
  position: PositionDataSchema,
});

export type AssetPosition = z.infer<typeof AssetPositionSchema>;

export const ClearinghouseStateSchema = z.object({
  marginSummary: MarginSummarySchema,
  crossMarginSummary: MarginSummarySchema,
  crossMaintenanceMarginUsed: DecimalString,
  withdrawable: DecimalString,
  assetPositions: z.array(AssetPositionSchema),
  time: TimestampMs,
});

export type ClearinghouseState = z.infer<typeof ClearinghouseStateSchema>;

// ─── fundingHistory ───────────────────────────────────────────────────────────

export const FundingRecordSchema = z.object({
  coin: z.string(),
  fundingRate: DecimalString,
  premium: DecimalString,
  time: TimestampMs,
});

export type FundingRecord = z.infer<typeof FundingRecordSchema>;

export const FundingHistorySchema = z.array(FundingRecordSchema);

// ─── userVaultEquities ────────────────────────────────────────────────────────

export const UserVaultEquitySchema = z.object({
  vaultAddress: Address,
  equity: DecimalString,
  lockedUntilTimestamp: TimestampMs,
});

export type UserVaultEquity = z.infer<typeof UserVaultEquitySchema>;

export const UserVaultEquitiesSchema = z.array(UserVaultEquitySchema);

// ─── Request body types ───────────────────────────────────────────────────────

export type InfoRequest =
  | { type: "userRole"; user: string }
  | { type: "vaultDetails"; vaultAddress: string }
  | { type: "userFills"; user: string }
  | { type: "userFillsByTime"; user: string; startTime: number; endTime: number }
  | { type: "clearinghouseState"; user: string }
  | { type: "portfolio"; user: string; timespan: "day" | "week" | "month" | "allTime" }
  | { type: "fundingHistory"; coin: string; startTime: number; endTime?: number }
  | { type: "userVaultEquities"; user: string };
