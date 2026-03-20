/**
 * Seed the vault registry and run full ingestion for each vault.
 *
 * Usage:
 *   node scripts/seed.mjs            # seed + ingest all
 *   node scripts/seed.mjs --meta-only  # seed metadata only (fast, no fills)
 *
 * First run takes ~5-10 minutes for 30 vaults (fill history + rate limiting).
 * Subsequent runs are incremental.
 */

import postgres from "postgres";
import { config } from "dotenv";
import { SEED_VAULT_ADDRESSES } from "../packages/hyperliquid/dist/vault-seeds.js";
import { HyperliquidClient } from "../packages/hyperliquid/dist/client.js";
import { ingestVault, ingestVaultMeta } from "../packages/hyperliquid/dist/ingestion.js";
import { getVaultAddresses } from "../packages/db/dist/queries.js";

config();

const metaOnly = process.argv.includes("--meta-only");

const sql = postgres(process.env.DATABASE_URL);
const client = new HyperliquidClient();

console.log(`\nOpenVault — Vault Seeder`);
console.log(`Mode: ${metaOnly ? "metadata only" : "full ingestion (fills + NAV + positions)"}`);
console.log(`Vaults to process: ${SEED_VAULT_ADDRESSES.length}\n`);

let succeeded = 0;
let failed = 0;

for (const address of SEED_VAULT_ADDRESSES) {
  try {
    if (metaOnly) {
      await ingestVaultMeta(client, sql, address);
    } else {
      await ingestVault(client, sql, address);
    }
    succeeded++;
  } catch (err) {
    console.error(`[seed] FAILED ${address}: ${err.message}`);
    failed++;
  }
}

const known = await getVaultAddresses(sql);

console.log(`\n─── Seed complete ───────────────────────────`);
console.log(`  Succeeded : ${succeeded}`);
console.log(`  Failed    : ${failed}`);
console.log(`  Total in DB: ${known.length} vaults`);
console.log(`─────────────────────────────────────────────\n`);

await sql.end();
