/**
 * fetch-market-prices.mjs
 *
 * Fetches hourly BTC and ETH prices from CryptoCompare (free, no auth needed,
 * no geo-restrictions, unlimited historical depth).
 *
 * API: https://min-api.cryptocompare.com/data/v2/histohour
 *   ?fsym=BTC&tsym=USD&limit=2000&toTs=<unix_sec>
 * Returns up to 2000 hourly candles ending at toTs.
 * We paginate backward in time: start from now, walk back to START_SEC.
 *
 * Run: node scripts/fetch-market-prices.mjs
 */

import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:dev@localhost:5432/openvault";

const sql = postgres(DATABASE_URL, { max: 3 });

const CC_BASE = "https://min-api.cryptocompare.com/data/v2/histohour";
const LIMIT = 2000; // candles per request

// Earliest fill in our DB
const START_SEC = Math.floor(new Date("2023-03-01T00:00:00Z").getTime() / 1000);
const END_SEC   = Math.floor(new Date("2026-03-17T00:00:00Z").getTime() / 1000);

const COINS = [
  { fsym: "BTC", name: "BTC" },
  { fsym: "ETH", name: "ETH" },
];

async function fetchBatch(fsym, toTs) {
  const url = `${CC_BASE}?fsym=${fsym}&tsym=USD&limit=${LIMIT}&toTs=${toTs}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 30000));
    return fetchBatch(fsym, toTs);
  }
  if (!res.ok) throw new Error(`CryptoCompare HTTP error ${res.status}`);
  const json = await res.json();
  if (json.Response === "Error") throw new Error(`CryptoCompare error: ${json.Message}`);
  // Data array: [{time, open, high, low, close, ...}]
  return json.Data?.Data ?? [];
}

async function ingestCoin(coin) {
  console.log(`\n[${coin.name}] Fetching hourly prices 2023-03-01 → 2026-03-17`);

  // Paginate backward from END_SEC to START_SEC
  let toTs = END_SEC;
  let totalInserted = 0;
  let batch = 0;

  while (toTs > START_SEC) {
    const candles = await fetchBatch(coin.fsym, toTs);
    if (candles.length === 0) break;

    // Filter to our range
    const inRange = candles.filter((c) => c.time >= START_SEC && c.time <= END_SEC);

    if (inRange.length > 0) {
      const rows = inRange.map((c) => ({
        coin: coin.name,
        time: new Date(c.time * 1000),
        price: c.close,
      }));

      await sql`
        INSERT INTO market_prices ${sql(rows, "coin", "time", "price")}
        ON CONFLICT (coin, time) DO UPDATE SET price = EXCLUDED.price
      `;

      totalInserted += rows.length;
    }

    batch++;
    const earliest = candles[0].time;
    process.stdout.write(`\r  Batch ${batch}: ${totalInserted} rows (from ${new Date(earliest * 1000).toISOString().slice(0, 10)})`);

    // Move cursor back — earliest candle in this batch minus 1 second
    toTs = earliest - 1;

    // Rate limit: ~50 req/min free; 1.5s between requests
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n[${coin.name}] Done — ${totalInserted} hourly prices inserted.`);
}

async function main() {
  console.log("Fetching BTC and ETH hourly prices from CryptoCompare...");

  // Check if table has a unique constraint; if not, warn
  const existing = await sql`SELECT COUNT(*) FROM market_prices`;
  console.log(`market_prices currently has ${existing[0].count} rows`);

  for (const coin of COINS) {
    await ingestCoin(coin);
  }

  await sql.end();
  console.log("\nAll done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
