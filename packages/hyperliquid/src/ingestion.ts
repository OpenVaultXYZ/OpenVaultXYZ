/**
 * Data ingestion for a single vault.
 *
 * These functions pull data from the Hyperliquid API and store it in TimescaleDB.
 * They are designed to be idempotent — safe to run repeatedly. Re-running picks
 * up where it left off rather than re-fetching everything.
 *
 * Call order for a brand-new vault:
 *   1. ingestVaultMeta      — vaults table + followers snapshot
 *   2. ingestNAVHistory     — backfill vault_snapshots from portfolio allTime
 *   3. ingestFillHistory    — backfill raw_trades (full history, paginated)
 *   4. ingestSnapshot       — current positions + equity (vault_positions + vault_snapshots)
 */

import type { Sql } from "@openvault/db";
import {
  upsertVault,
  insertNormalizedFills,
  insertFollowers,
  insertPositions,
  insertSnapshot,
  getOldestFillTime,
} from "@openvault/db";
import { HyperliquidClient } from "./client.js";
import { translateFills } from "./translator.js";

// How large a time window to request per pagination call (1 week in ms).
// Smaller = fewer fills per call but more reliable for high-frequency vaults.
const FILL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Maximum calls per second (conservative — well under the ~5/sec observed limit)
const RATE_LIMIT_DELAY_MS = 250;

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ─── ingestVaultMeta ──────────────────────────────────────────────────────────

/**
 * Fetch vaultDetails and upsert the vaults + followers tables.
 */
export async function ingestVaultMeta(
  client: HyperliquidClient,
  sql: Sql,
  vaultAddress: string,
  discoverySource: string = "manual",
): Promise<void> {
  const details = await client.vaultDetails(vaultAddress);

  // Determine if the leader is itself a vault (sub-vault case)
  const leaderRole = await client.userRole(details.leader);
  await sleep(RATE_LIMIT_DELAY_MS);

  // Update vaults table
  await upsertVault(sql, details, discoverySource);

  // Persist whether the leader is a vault or a human operator
  await sql`
    UPDATE vaults SET leader_is_vault = ${leaderRole.role === "vault"} WHERE vault_address = ${vaultAddress}
  `;

  // Snapshot followers list
  const now = new Date();
  await insertFollowers(sql, vaultAddress, now, details.followers);

  console.log(
    `[ingestVaultMeta] ${details.name} (${vaultAddress}) — ${details.followers.length} followers`,
  );
}

// ─── ingestNAVHistory ─────────────────────────────────────────────────────────

/**
 * Backfill vault_snapshots from vaultDetails.portfolio (allTime).
 * The portfolio endpoint returns a sparse series going back to vault creation.
 * This is cheaper than polling — run once per vault on first ingestion.
 */
export async function ingestNAVHistory(
  client: HyperliquidClient,
  sql: Sql,
  vaultAddress: string,
): Promise<number> {
  const history = await client.portfolio(vaultAddress, "allTime");
  await sleep(RATE_LIMIT_DELAY_MS);

  const allTimeEntry = history.find(([timespan]) => timespan === "allTime");
  if (!allTimeEntry) {
    console.warn(`[ingestNAVHistory] No allTime portfolio data for ${vaultAddress}`);
    return 0;
  }

  const [, { accountValueHistory }] = allTimeEntry;
  let inserted = 0;

  for (const [timestampMs, valueStr] of accountValueHistory) {
    const value = parseFloat(valueStr);
    if (!isFinite(value)) continue;
    await insertSnapshot(sql, vaultAddress, new Date(timestampMs), value, null, null, null, "portfolio_history");
    inserted++;
  }

  console.log(`[ingestNAVHistory] ${vaultAddress} — ${inserted} NAV data points`);
  return inserted;
}

// ─── ingestFillHistory ────────────────────────────────────────────────────────

/**
 * Paginate through ALL fills for a vault from oldest to newest.
 *
 * Strategy:
 * - If no fills in DB: start from vault creation time (oldest portfolio history point)
 * - If fills exist: resume from oldest stored fill time and paginate backward in time
 *   (to fill any gaps from prior interrupted runs)
 * - After backfill: pull forward from newest stored fill to now
 *
 * For simplicity in Phase 1: always do a full forward scan from the earliest
 * portfolio timestamp to now, deduplicating on tid.
 */
export async function ingestFillHistory(
  client: HyperliquidClient,
  sql: Sql,
  vaultAddress: string,
  vaultCreatedAt: number, // Unix ms from oldest portfolio history point
): Promise<number> {
  const now = Date.now();
  let cursor = vaultCreatedAt;
  let totalInserted = 0;
  let pageCount = 0;

  console.log(
    `[ingestFillHistory] ${vaultAddress} — scanning from ${new Date(vaultCreatedAt).toISOString()}`,
  );

  while (cursor < now) {
    const end = Math.min(cursor + FILL_WINDOW_MS, now);
    const fills = await client.fillsByTime(vaultAddress, cursor, end);
    await sleep(RATE_LIMIT_DELAY_MS);

    if (fills.length > 0) {
      const inserted = await insertNormalizedFills(sql, translateFills(fills, vaultAddress));
      totalInserted += inserted;
      pageCount++;

      if (pageCount % 10 === 0) {
        console.log(
          `[ingestFillHistory] ${vaultAddress} — ${pageCount} pages, ${totalInserted} new fills so far`,
        );
      }

      // If we got exactly 2000 fills, there may be more in this window.
      // Shrink the window to the last fill's time + 1ms and retry.
      if (fills.length === 2000) {
        const lastFillTime = fills[fills.length - 1]?.time;
        if (lastFillTime !== undefined) {
          cursor = lastFillTime + 1;
          continue;
        }
      }
    }

    cursor = end + 1;
  }

  console.log(
    `[ingestFillHistory] ${vaultAddress} — complete: ${totalInserted} fills inserted across ${pageCount} pages`,
  );
  return totalInserted;
}

// ─── ingestSnapshot ───────────────────────────────────────────────────────────

/**
 * Pull the current clearinghouseState and store a position + equity snapshot.
 * Run on a schedule (e.g. every 15 minutes) for ongoing monitoring.
 */
export async function ingestSnapshot(
  client: HyperliquidClient,
  sql: Sql,
  vaultAddress: string,
): Promise<void> {
  const state = await client.clearinghouseState(vaultAddress);
  await sleep(RATE_LIMIT_DELAY_MS);

  const snapshotTime = new Date(state.time);
  const summary = state.marginSummary;

  await insertSnapshot(
    sql,
    vaultAddress,
    snapshotTime,
    parseFloat(summary.accountValue),
    parseFloat(summary.totalNtlPos),
    parseFloat(summary.totalMarginUsed),
    parseFloat(state.withdrawable),
    "poll",
  );

  if (state.assetPositions.length > 0) {
    await insertPositions(sql, vaultAddress, snapshotTime, state.assetPositions);
  }
}

// ─── ingestVault (full pipeline) ─────────────────────────────────────────────

/**
 * Full ingestion pipeline for a brand-new vault.
 * Run once per vault on initial discovery.
 */
export async function ingestVault(
  client: HyperliquidClient,
  sql: Sql,
  vaultAddress: string,
): Promise<void> {
  console.log(`\n[ingestVault] Starting full ingestion for ${vaultAddress}`);

  // 1. Vault metadata + followers
  await ingestVaultMeta(client, sql, vaultAddress);
  await sleep(RATE_LIMIT_DELAY_MS);

  // 2. NAV history backfill — also gives us the vault's creation timestamp
  const history = await client.portfolio(vaultAddress, "allTime");
  await sleep(RATE_LIMIT_DELAY_MS);

  const allTime = history.find(([t]) => t === "allTime");
  const creationTimestamp = allTime?.[1].accountValueHistory[0]?.[0];

  if (creationTimestamp !== undefined) {
    // Store the NAV history we already fetched
    const [, { accountValueHistory }] = allTime!;
    for (const [timestampMs, valueStr] of accountValueHistory) {
      const value = parseFloat(valueStr);
      if (isFinite(value)) {
        await insertSnapshot(sql, vaultAddress, new Date(timestampMs), value, null, null, null, "portfolio_history");
      }
    }
    console.log(`[ingestVault] NAV history: ${accountValueHistory.length} points`);

    // 3. Fill history (full paginated backfill)
    await ingestFillHistory(client, sql, vaultAddress, creationTimestamp);
  } else {
    console.warn(`[ingestVault] Could not determine vault creation time for ${vaultAddress}`);
  }

  // 4. Current snapshot
  await ingestSnapshot(client, sql, vaultAddress);

  console.log(`[ingestVault] Complete for ${vaultAddress}\n`);
}
