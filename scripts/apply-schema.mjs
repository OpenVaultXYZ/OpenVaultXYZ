/**
 * Apply the TimescaleDB schema to the database.
 * Run once before the first ingestion.
 *
 * Usage: node scripts/apply-schema.mjs
 */

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "../packages/db/src/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf8");

const sql = postgres(process.env.DATABASE_URL);

try {
  // TimescaleDB extension must exist before the schema runs
  await sql`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`;
  console.log("TimescaleDB extension enabled.");

  // Strip line comments, split on semicolons, run each statement individually.
  // create_hypertable must run after CREATE TABLE, so order matters.
  const stripped = schemaSql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await sql.unsafe(stmt);
  }

  console.log("Schema applied successfully.");
} catch (err) {
  console.error("Schema application failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
