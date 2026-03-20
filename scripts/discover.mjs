/**
 * Vault discovery script.
 *
 * Expands the vault registry beyond the hardcoded seed list using:
 *   1. vaultSummaries endpoint — catches the most recently created vault
 *   2. Follower BFS — scans every known vault's followers for new vault addresses
 *
 * For each newly discovered vault: runs full ingestion (fills + NAV + positions).
 * Runs compute-metrics at the end to include new vaults in the rankings.
 *
 * Usage:
 *   node scripts/discover.mjs                # full BFS from all known vaults
 *   node scripts/discover.mjs --meta-only    # discover + metadata only, skip fills
 *   node scripts/discover.mjs --dry-run      # show what would be discovered, no writes
 */

import postgres from "postgres";
import { config } from "dotenv";
import { execSync } from "child_process";

import { HyperliquidClient } from "../packages/hyperliquid/dist/client.js";
import { runDiscoveryPass } from "../packages/hyperliquid/dist/discovery.js";
import { ingestVault, ingestVaultMeta } from "../packages/hyperliquid/dist/ingestion.js";
import { getVaultAddresses, vaultExists } from "../packages/db/dist/queries.js";

config();

const metaOnly = process.argv.includes("--meta-only");
const dryRun   = process.argv.includes("--dry-run");

const sql    = postgres(process.env.DATABASE_URL);
const client = new HyperliquidClient();

const HL_INFO = "https://api.hyperliquid.xyz/info";

// ─── vaultSummaries check ─────────────────────────────────────────────────────
// This endpoint returns the most recently created vault on HL.
// Running it daily catches brand-new vaults before they appear in any follower graph.

async function checkVaultSummaries() {
  try {
    const resp = await fetch(HL_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "vaultSummaries" }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];
    return data.map((v) => v.vaultAddress).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("\nOpenVault — Vault Discovery");
console.log("━".repeat(60));
console.log(`Mode: ${dryRun ? "DRY RUN" : metaOnly ? "meta only" : "full ingestion"}`);

// Load what we already know
const knownBefore = await getVaultAddresses(sql);
console.log(`Known vaults (start): ${knownBefore.length}`);

if (dryRun) {
  console.log("\n[dry-run] Would run BFS from all known vaults — no writes.");
  await sql.end();
  process.exit(0);
}

// ── Track A: vaultSummaries ────────────────────────────────────────────────────
const summaryAddresses = await checkVaultSummaries();
const summaryNew = [];
for (const addr of summaryAddresses) {
  if (!(await vaultExists(sql, addr))) {
    summaryNew.push(addr);
    console.log(`[vaultSummaries] New vault candidate: ${addr}`);
  }
}
if (summaryNew.length === 0) {
  console.log("[vaultSummaries] No new vaults found");
}

// ── Track B: follower BFS ──────────────────────────────────────────────────────
console.log(`\n[BFS] Starting discovery pass from ${knownBefore.length} known vaults...`);
const bfsNew = await runDiscoveryPass(client, sql, knownBefore);

// ── Combine all newly found addresses ─────────────────────────────────────────
const allNew = [...new Set([...summaryNew, ...bfsNew])];
console.log(`\n──────────────────────────────────────────────`);
console.log(`  Discovery complete — ${allNew.length} new vault(s) found`);
console.log(`──────────────────────────────────────────────`);

if (allNew.length === 0) {
  console.log("  Nothing new to ingest.\n");
  await sql.end();
  process.exit(0);
}

// ── Ingest each newly discovered vault ────────────────────────────────────────
let succeeded = 0;
let failed = 0;

for (const addr of allNew) {
  try {
    if (metaOnly) {
      await ingestVaultMeta(client, sql, addr);
    } else {
      await ingestVault(client, sql, addr);
    }
    console.log(`[ingest] ✓ ${addr}`);
    succeeded++;
  } catch (err) {
    console.error(`[ingest] ✗ ${addr}: ${err.message}`);
    failed++;
  }
}

const knownAfter = await getVaultAddresses(sql);
console.log(`\n──────────────────────────────────────────────`);
console.log(`  Ingested  : ${succeeded} succeeded, ${failed} failed`);
console.log(`  Total known: ${knownBefore.length} → ${knownAfter.length} vaults`);
console.log(`──────────────────────────────────────────────`);

await sql.end();

// ── Recompute metrics for all vaults (includes new ones) ──────────────────────
if (!metaOnly && succeeded > 0) {
  console.log("\n[metrics] Recomputing metrics for all vaults...");
  try {
    execSync("node scripts/compute-metrics.mjs", { stdio: "inherit" });
  } catch (err) {
    console.error("[metrics] compute-metrics failed:", err.message);
  }
}

console.log("\nDone.\n");
