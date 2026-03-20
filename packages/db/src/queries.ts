/**
 * Typed database queries for OpenVault.
 * Uses the `postgres` npm package (sql tagged template literals).
 */

import postgres from "postgres";
import type { NormalizedFill } from "./normalized-types.js";

export type PositionInput = {
  position: {
    coin: string; szi: string; entryPx: string; positionValue: string;
    unrealizedPnl: string; leverage: { type: string; value: number };
    liquidationPx: string | null; marginUsed: string;
    cumFunding: { allTime: string; sinceOpen: string };
  };
};

export type VaultDetailsInput = {
  vaultAddress: string; name: string; description: string; leader: string;
  apr: number; isClosed: boolean; allowDeposits: boolean;
  relationship: { type: string } | null;
  leaderFraction: number; leaderCommission: number;
  maxDistributable: number; maxWithdrawable: number;
  followers: Array<{
    user: string; vaultEquity: string; pnl: string; allTimePnl: string;
    daysFollowing: number; vaultEntryTime: number; lockupUntil: number;
  }>;
};

export type Sql = ReturnType<typeof postgres>;

// ─── Vault registry ───────────────────────────────────────────────────────────

export async function upsertVault(sql: Sql, vault: VaultDetailsInput, discoverySource: string) {
  const relationship = vault.relationship?.type ?? null;

  // Check if the leader is another vault (handled by caller via userRole)
  await sql`
    INSERT INTO vaults (
      vault_address, name, description, leader_address,
      apr, is_closed, allow_deposits, relationship_type,
      leader_fraction, leader_commission, max_distributable, max_withdrawable,
      discovery_source, last_updated
    ) VALUES (
      ${vault.vaultAddress}, ${vault.name}, ${vault.description}, ${vault.leader},
      ${vault.apr}, ${vault.isClosed}, ${vault.allowDeposits}, ${relationship},
      ${vault.leaderFraction}, ${vault.leaderCommission},
      ${vault.maxDistributable}, ${vault.maxWithdrawable},
      ${discoverySource}, NOW()
    )
    ON CONFLICT (vault_address) DO UPDATE SET
      name               = EXCLUDED.name,
      description        = EXCLUDED.description,
      apr                = EXCLUDED.apr,
      is_closed          = EXCLUDED.is_closed,
      allow_deposits     = EXCLUDED.allow_deposits,
      relationship_type  = EXCLUDED.relationship_type,
      leader_fraction    = EXCLUDED.leader_fraction,
      leader_commission  = EXCLUDED.leader_commission,
      max_distributable  = EXCLUDED.max_distributable,
      max_withdrawable   = EXCLUDED.max_withdrawable,
      last_updated       = NOW()
  `;
}

export async function getVaultAddresses(sql: Sql): Promise<string[]> {
  const rows = await sql<{ vault_address: string }[]>`
    SELECT vault_address FROM vaults WHERE is_closed = false ORDER BY vault_address
  `;
  return rows.map((r) => r.vault_address);
}

export async function vaultExists(sql: Sql, vaultAddress: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM vaults WHERE vault_address = ${vaultAddress}) AS exists
  `;
  return rows[0]?.exists ?? false;
}

// ─── Normalized fills ─────────────────────────────────────────────────────────

/**
 * Insert normalized fills, skipping duplicates (ON CONFLICT DO NOTHING).
 * Returns the number of new rows inserted.
 */
export async function insertNormalizedFills(sql: Sql, fills: NormalizedFill[]): Promise<number> {
  if (fills.length === 0) return 0;

  const rows = fills.map((f) => ({
    vault_address:    f.vaultAddress,
    platform:         f.platform,
    trade_id:         f.tradeId,
    asset:            f.asset,
    price:            f.price,
    size:             f.size,
    side:             f.side,
    time:             f.time,
    realized_pnl:     f.realizedPnl,
    fee:              f.fee,
    fee_asset:        f.feeAsset,
    position_before:  f.positionBefore,
    direction:        f.direction,
    is_adl_event:     f.isAdlEvent,
    is_twap:          f.isTwap,
    is_taker:         f.isTaker,
    order_id:         f.orderId,
    raw_hash:         f.rawHash,
  }));

  const result = await sql`
    INSERT INTO normalized_fills ${sql(rows)}
    ON CONFLICT (vault_address, trade_id, time) DO NOTHING
    RETURNING trade_id
  `;

  return result.length;
}

export async function getOldestFillTime(
  sql: Sql,
  vaultAddress: string,
): Promise<Date | null> {
  const rows = await sql<{ min_time: Date | null }[]>`
    SELECT MIN(time) AS min_time FROM normalized_fills WHERE vault_address = ${vaultAddress}
  `;
  return rows[0]?.min_time ?? null;
}

export async function getNewestFillTime(
  sql: Sql,
  vaultAddress: string,
): Promise<Date | null> {
  const rows = await sql<{ max_time: Date | null }[]>`
    SELECT MAX(time) AS max_time FROM normalized_fills WHERE vault_address = ${vaultAddress}
  `;
  return rows[0]?.max_time ?? null;
}

export async function getFillCount(sql: Sql, vaultAddress: string): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count FROM normalized_fills WHERE vault_address = ${vaultAddress}
  `;
  return parseInt(rows[0]?.count ?? "0", 10);
}

// ─── NAV snapshots ────────────────────────────────────────────────────────────

export async function insertSnapshot(
  sql: Sql,
  vaultAddress: string,
  time: Date,
  accountValue: number,
  totalNtlPos: number | null,
  totalMarginUsed: number | null,
  withdrawable: number | null,
  source: "portfolio_history" | "poll",
) {
  await sql`
    INSERT INTO vault_snapshots (
      vault_address, time, account_value, total_ntl_pos, total_margin_used, withdrawable, source
    ) VALUES (
      ${vaultAddress}, ${time}, ${accountValue}, ${totalNtlPos},
      ${totalMarginUsed}, ${withdrawable}, ${source}
    )
    ON CONFLICT (vault_address, time) DO NOTHING
  `;
}

export async function getSnapshotCount(sql: Sql, vaultAddress: string): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count FROM vault_snapshots WHERE vault_address = ${vaultAddress}
  `;
  return parseInt(rows[0]?.count ?? "0", 10);
}

export async function getSnapshotSeries(
  sql: Sql,
  vaultAddress: string,
): Promise<{ time: Date; account_value: number }[]> {
  return sql<{ time: Date; account_value: number }[]>`
    SELECT time, account_value::float8 AS account_value
    FROM vault_snapshots
    WHERE vault_address = ${vaultAddress}
    ORDER BY time ASC
  `;
}

// ─── Position snapshots ───────────────────────────────────────────────────────

export async function insertPositions(
  sql: Sql,
  vaultAddress: string,
  snapshotTime: Date,
  positions: PositionInput[],
) {
  if (positions.length === 0) return;

  const rows = positions.map((ap) => ({
    vault_address:            vaultAddress,
    snapshot_time:            snapshotTime,
    coin:                     ap.position.coin,
    szi:                      parseFloat(ap.position.szi),
    entry_px:                 parseFloat(ap.position.entryPx),
    position_value:           parseFloat(ap.position.positionValue),
    unrealized_pnl:           parseFloat(ap.position.unrealizedPnl),
    leverage_type:            ap.position.leverage.type,
    leverage_value:           ap.position.leverage.value,
    liquidation_px:           ap.position.liquidationPx !== null
                                ? parseFloat(ap.position.liquidationPx)
                                : null,
    margin_used:              parseFloat(ap.position.marginUsed),
    cum_funding_all_time:     parseFloat(ap.position.cumFunding.allTime),
    cum_funding_since_open:   parseFloat(ap.position.cumFunding.sinceOpen),
  }));

  await sql`
    INSERT INTO vault_positions ${sql(rows)}
    ON CONFLICT (vault_address, snapshot_time, coin) DO NOTHING
  `;
}

// ─── Vault followers ──────────────────────────────────────────────────────────

export async function insertFollowers(
  sql: Sql,
  vaultAddress: string,
  snapshotTime: Date,
  followers: VaultDetailsInput["followers"],
) {
  if (followers.length === 0) return;

  const rows = followers.map((f) => ({
    vault_address:  vaultAddress,
    snapshot_time:  snapshotTime,
    user_address:   f.user,
    vault_equity:   parseFloat(f.vaultEquity),
    pnl:            parseFloat(f.pnl),
    all_time_pnl:   parseFloat(f.allTimePnl),
    days_following: f.daysFollowing,
    entry_time:     new Date(f.vaultEntryTime),
    lockup_until:   new Date(f.lockupUntil),
  }));

  await sql`
    INSERT INTO vault_followers ${sql(rows)}
    ON CONFLICT (vault_address, snapshot_time, user_address) DO NOTHING
  `;
}

// ─── Metrics read queries ─────────────────────────────────────────────────────

/**
 * NAV series for a vault — maps vault_snapshots to NavPoint shape
 * expected by @openvault/metrics functions.
 */
export async function getNavSeries(
  sql: Sql,
  vaultAddress: string,
): Promise<{ time: Date; accountValue: number }[]> {
  const rows = await sql<{ time: Date; account_value: number }[]>`
    SELECT time, account_value::float8 AS account_value
    FROM vault_snapshots
    WHERE vault_address = ${vaultAddress}
    ORDER BY time ASC
  `;
  return rows.map((r) => ({ time: r.time, accountValue: r.account_value }));
}

/**
 * Closing fills (realized_pnl != 0) — maps to ClosingFill shape
 * expected by winRate() and profitFactor().
 */
export async function getClosingFills(
  sql: Sql,
  vaultAddress: string,
): Promise<{ closedPnl: number }[]> {
  const rows = await sql<{ realized_pnl: number }[]>`
    SELECT realized_pnl::float8 AS realized_pnl
    FROM normalized_fills
    WHERE vault_address = ${vaultAddress}
      AND realized_pnl != 0
    ORDER BY time ASC
  `;
  return rows.map((r) => ({ closedPnl: r.realized_pnl }));
}

export type FillStats = {
  count: number;
  oldestTime: Date | null;
  newestTime: Date | null;
  buyCount: number;
  sellCount: number;
};

/**
 * Summary fill statistics for a vault — used for logging and diagnostics.
 */
export async function getFillStats(sql: Sql, vaultAddress: string): Promise<FillStats> {
  const rows = await sql<{
    count: string;
    oldest_time: Date | null;
    newest_time: Date | null;
    buy_count: string;
    sell_count: string;
  }[]>`
    SELECT
      COUNT(*)                                     AS count,
      MIN(time)                                    AS oldest_time,
      MAX(time)                                    AS newest_time,
      COUNT(*) FILTER (WHERE side = 'buy')         AS buy_count,
      COUNT(*) FILTER (WHERE side = 'sell')        AS sell_count
    FROM normalized_fills
    WHERE vault_address = ${vaultAddress}
  `;
  const r = rows[0]!;
  return {
    count:      parseInt(r.count, 10),
    oldestTime: r.oldest_time,
    newestTime: r.newest_time,
    buyCount:   parseInt(r.buy_count, 10),
    sellCount:  parseInt(r.sell_count, 10),
  };
}

/**
 * Input types for strategy classification.
 * Defined here (not imported from @openvault/metrics) to keep the packages
 * fully independent — metrics never imports from db, db never imports from metrics.
 */
export type FillForClassification = {
  coin: string;
  side: "B" | "S";
  time: number; // Unix ms
  sz: number;
  closedPnl: number;
  dir: string; // "Open Long" | "Close Long" | "Open Short" | "Close Short"
};

export type PositionForClassification = {
  coin: string;
  szi: number;
  cumFundingAllTime: number;
  positionValue: number;
};

/**
 * All fills for a vault shaped for classifyStrategy().
 * Denormalizes side back to "B"/"S" (normalized "buy"→"B", "sell"→"S").
 */
export async function getFillsForClassification(
  sql: Sql,
  vaultAddress: string,
): Promise<FillForClassification[]> {
  const rows = await sql<{
    asset: string;
    side: string;
    time: Date;
    size: number;
    realized_pnl: number;
    direction: string;
  }[]>`
    SELECT asset, side, time, size::float8 AS size, realized_pnl::float8 AS realized_pnl, direction
    FROM normalized_fills
    WHERE vault_address = ${vaultAddress}
    ORDER BY time ASC
  `;
  return rows.map((r) => ({
    coin:      r.asset,
    side:      r.side === "buy" ? "B" : "S",
    time:      r.time.getTime(),
    sz:        r.size,
    closedPnl: r.realized_pnl,
    dir:       r.direction,
  }));
}

/**
 * Latest position snapshot for a vault — used as input to classifyStrategy().
 */
export async function getLatestPositions(
  sql: Sql,
  vaultAddress: string,
): Promise<PositionForClassification[]> {
  const rows = await sql<{
    coin: string;
    szi: number;
    cum_funding_all_time: number;
    position_value: number;
  }[]>`
    SELECT
      coin,
      szi::float8               AS szi,
      cum_funding_all_time::float8 AS cum_funding_all_time,
      position_value::float8    AS position_value
    FROM vault_positions
    WHERE vault_address = ${vaultAddress}
      AND snapshot_time = (
        SELECT MAX(snapshot_time) FROM vault_positions WHERE vault_address = ${vaultAddress}
      )
  `;
  return rows.map((r) => ({
    coin:              r.coin,
    szi:               r.szi,
    cumFundingAllTime: r.cum_funding_all_time,
    positionValue:     r.position_value,
  }));
}

/**
 * Market price series for a given coin (BTC / ETH) — used for beta computation.
 * Returns empty array if market_prices table has no data for the coin.
 */
export async function getMarketPrices(
  sql: Sql,
  coin: string,
): Promise<{ time: Date; price: number }[]> {
  return sql<{ time: Date; price: number }[]>`
    SELECT time, price::float8 AS price
    FROM market_prices
    WHERE coin = ${coin}
    ORDER BY time ASC
  `;
}

// ─── Vault metrics ────────────────────────────────────────────────────────────

export type VaultMetricsRow = {
  vault_address: string;
  computed_at: Date;
  annualized_return?: number;
  win_rate?: number;
  profit_factor?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  max_drawdown?: number;
  avg_drawdown?: number;
  max_drawdown_days?: number;
  btc_beta?: number;
  eth_beta?: number;
  funding_income_pct?: number;
  strategy_type?: string;
  risk_score?: number;
  data?: Record<string, unknown>;
};

// ─── UI read queries ──────────────────────────────────────────────────────────

export type VaultListRow = {
  vaultAddress: string;
  name: string | null;
  description: string | null;
  leaderAddress: string;
  apr: number | null;
  isClosed: boolean;
  allowDeposits: boolean | null;
  leaderCommission: number | null;
  computedAt: Date;
  annualizedReturn: number | null;
  winRate: number | null;
  profitFactor: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  maxDrawdown: number | null;
  avgDrawdown: number | null;
  maxDrawdownDays: number | null;
  btcBeta: number | null;
  ethBeta: number | null;
  fundingIncomePct: number | null;
  strategyType: string | null;
  riskScore: number | null;
  daysElapsed: number | null;
  navSparkline: number[] | null;
  currentAum: number | null;
  data: Record<string, unknown>;
};

export type VaultDetailRow = VaultListRow & {
  leaderFraction: number | null;
  maxDistributable: number | null;
  maxWithdrawable: number | null;
  relationshipType: string | null;
  leaderIsVault: boolean;
  discoverySource: string;
  discoveredAt: Date;
  lastUpdated: Date;
};

export type VaultSearchResult = {
  vaultAddress: string;
  name: string | null;
  strategyType: string | null;
  riskScore: number | null;
  annualizedReturn: number | null;
};

/**
 * All active vaults with pre-computed metrics, joined with vault registry.
 * Default order: risk_score ASC (safest first). Used by leaderboard.
 */
export async function getAllVaultMetrics(sql: Sql): Promise<VaultListRow[]> {
  const rows = await sql<VaultListRow[]>`
    SELECT
      v.vault_address      AS "vaultAddress",
      v.name,
      v.description,
      v.leader_address     AS "leaderAddress",
      v.apr::float8        AS apr,
      v.is_closed          AS "isClosed",
      v.allow_deposits     AS "allowDeposits",
      v.leader_commission::float8 AS "leaderCommission",
      m.computed_at        AS "computedAt",
      m.annualized_return::float8 AS "annualizedReturn",
      m.win_rate::float8          AS "winRate",
      m.profit_factor::float8     AS "profitFactor",
      m.sharpe_ratio::float8      AS "sharpeRatio",
      m.sortino_ratio::float8     AS "sortinoRatio",
      m.calmar_ratio::float8      AS "calmarRatio",
      m.max_drawdown::float8      AS "maxDrawdown",
      m.avg_drawdown::float8      AS "avgDrawdown",
      m.max_drawdown_days         AS "maxDrawdownDays",
      m.btc_beta::float8          AS "btcBeta",
      m.eth_beta::float8          AS "ethBeta",
      m.funding_income_pct::float8 AS "fundingIncomePct",
      m.strategy_type             AS "strategyType",
      m.risk_score::float8        AS "riskScore",
      (m.data->>'daysElapsed')::integer AS "daysElapsed",
      CASE
        WHEN jsonb_typeof(m.data->'navSparkline') = 'array'
        THEN ARRAY(SELECT (el.value)::float8 FROM jsonb_array_elements_text(m.data->'navSparkline') AS el(value))
        ELSE NULL
      END AS "navSparkline",
      (
        SELECT s.account_value::float8
        FROM vault_snapshots s
        WHERE s.vault_address = v.vault_address
        ORDER BY s.time DESC
        LIMIT 1
      ) AS "currentAum",
      m.data
    FROM vault_metrics m
    JOIN vaults v ON v.vault_address = m.vault_address
    WHERE v.is_closed = false
    ORDER BY m.risk_score ASC NULLS LAST
  `;
  return rows;
}

/**
 * Single vault with full metrics. Returns null if vault address not found.
 * LEFT JOIN so vaults without metrics return partial data rather than null.
 */
export async function getVaultWithMetrics(
  sql: Sql,
  vaultAddress: string,
): Promise<VaultDetailRow | null> {
  const rows = await sql<VaultDetailRow[]>`
    SELECT
      v.vault_address       AS "vaultAddress",
      v.name,
      v.description,
      v.leader_address      AS "leaderAddress",
      v.leader_is_vault     AS "leaderIsVault",
      v.apr::float8         AS apr,
      v.is_closed           AS "isClosed",
      v.allow_deposits      AS "allowDeposits",
      v.relationship_type   AS "relationshipType",
      v.leader_fraction::float8    AS "leaderFraction",
      v.leader_commission::float8  AS "leaderCommission",
      v.max_distributable::float8  AS "maxDistributable",
      v.max_withdrawable::float8   AS "maxWithdrawable",
      v.discovery_source    AS "discoverySource",
      v.discovered_at       AS "discoveredAt",
      v.last_updated        AS "lastUpdated",
      m.computed_at         AS "computedAt",
      m.annualized_return::float8  AS "annualizedReturn",
      m.win_rate::float8           AS "winRate",
      m.profit_factor::float8      AS "profitFactor",
      m.sharpe_ratio::float8       AS "sharpeRatio",
      m.sortino_ratio::float8      AS "sortinoRatio",
      m.calmar_ratio::float8       AS "calmarRatio",
      m.max_drawdown::float8       AS "maxDrawdown",
      m.avg_drawdown::float8       AS "avgDrawdown",
      m.max_drawdown_days          AS "maxDrawdownDays",
      m.btc_beta::float8           AS "btcBeta",
      m.eth_beta::float8           AS "ethBeta",
      m.funding_income_pct::float8 AS "fundingIncomePct",
      m.strategy_type              AS "strategyType",
      m.risk_score::float8         AS "riskScore",
      m.data
    FROM vaults v
    LEFT JOIN vault_metrics m ON m.vault_address = v.vault_address
    WHERE v.vault_address = ${vaultAddress}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Search vaults by name (case-insensitive substring) or address prefix.
 * Address prefix matches sort before name matches. Limit 20.
 */
export async function searchVaults(
  sql: Sql,
  query: string,
): Promise<VaultSearchResult[]> {
  const namePat = `%${query}%`;
  const addrPat = `${query}%`;
  const rows = await sql<VaultSearchResult[]>`
    SELECT
      v.vault_address          AS "vaultAddress",
      v.name,
      m.strategy_type          AS "strategyType",
      m.risk_score::float8     AS "riskScore",
      m.annualized_return::float8 AS "annualizedReturn"
    FROM vaults v
    LEFT JOIN vault_metrics m ON m.vault_address = v.vault_address
    WHERE v.is_closed = false
      AND (
        v.name ILIKE ${namePat}
        OR v.vault_address ILIKE ${addrPat}
      )
    ORDER BY
      CASE WHEN v.vault_address ILIKE ${addrPat} THEN 0 ELSE 1 END,
      v.name ASC NULLS LAST
    LIMIT 20
  `;
  return rows;
}

export async function upsertVaultMetrics(sql: Sql, metrics: VaultMetricsRow) {
  await sql`
    INSERT INTO vault_metrics ${sql({ ...metrics, data: sql.json((metrics.data ?? {}) as unknown as import("postgres").JSONValue) })}
    ON CONFLICT (vault_address) DO UPDATE SET
      computed_at         = EXCLUDED.computed_at,
      annualized_return   = EXCLUDED.annualized_return,
      win_rate            = EXCLUDED.win_rate,
      profit_factor       = EXCLUDED.profit_factor,
      sharpe_ratio        = EXCLUDED.sharpe_ratio,
      sortino_ratio       = EXCLUDED.sortino_ratio,
      calmar_ratio        = EXCLUDED.calmar_ratio,
      max_drawdown        = EXCLUDED.max_drawdown,
      avg_drawdown        = EXCLUDED.avg_drawdown,
      max_drawdown_days   = EXCLUDED.max_drawdown_days,
      btc_beta            = EXCLUDED.btc_beta,
      eth_beta            = EXCLUDED.eth_beta,
      funding_income_pct  = EXCLUDED.funding_income_pct,
      strategy_type       = EXCLUDED.strategy_type,
      risk_score          = EXCLUDED.risk_score,
      data                = EXCLUDED.data
  `;
}
