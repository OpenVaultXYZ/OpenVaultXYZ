/**
 * Metrics computation worker.
 *
 * Reads all vault data from TimescaleDB, runs the @openvault/metrics pure
 * functions, and writes results to vault_metrics.
 *
 * Usage:
 *   node scripts/compute-metrics.mjs
 *   node scripts/compute-metrics.mjs --vault 0xabc...  # single vault
 */

import postgres from "postgres";
import { config } from "dotenv";

import {
  annualizedReturn,
  sharpeRatio,
  sortinoRatio,
  calmarRatio,
  maxDrawdown,
  avgDrawdown,
  maxDrawdownDays,
  winRate,
  profitFactor,
  betaToMarket,
  classifyStrategy,
  riskScore,
} from "../packages/metrics/dist/index.js";

import {
  getVaultAddresses,
  getNavSeries,
  getClosingFills,
  getFillStats,
  getFillsForClassification,
  getLatestPositions,
  getMarketPrices,
  upsertVaultMetrics,
} from "../packages/db/dist/queries.js";

config();

// ─── CLI args ─────────────────────────────────────────────────────────────────

const singleVaultArg = (() => {
  const idx = process.argv.indexOf("--vault");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── DB connection ────────────────────────────────────────────────────────────

const sql = postgres(process.env.DATABASE_URL);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n, decimals = 2) {
  if (n == null) return "null";
  return n.toFixed(decimals);
}

function fmtPct(n) {
  if (n == null) return "null";
  return (n * 100).toFixed(1) + "%";
}

function pad(s, len) {
  return String(s).padEnd(len);
}

// ─── NAV sanitization ────────────────────────────────────────────────────────

/**
 * Clean a raw NAV series before feeding it to metrics functions.
 *
 * Two problems in the raw data:
 * 1. Vaults are initialized with near-zero NAV before deposits arrive. Including
 *    those points in TWR makes a $1→$100k deposit look like a 100,000x return.
 * 2. Some early snapshots may predate meaningful trading activity.
 *
 * Fixes:
 * - Step 1: drop leading points where NAV < 1% of the series median (catches
 *   near-zero initialization artifacts). Uses median so one outlier doesn't set
 *   the floor.
 * - Step 2: detect and remove deposit spikes (>5x jumps in < 7 days).
 *
 * NOTE: We intentionally do NOT filter by firstFillTime. Fill ingestion is
 * incomplete for many vaults (BFS-discovered vaults only have recent fills),
 * so using firstFillTime would silently discard months of valid NAV history.
 * Steps 1+2 are sufficient to clean initialization artifacts.
 */
function sanitizeNavSeries(navPoints) {
  let pts = [...navPoints].sort((a, b) => a.time - b.time);

  if (pts.length >= 2) {
    const values = [...pts].map(p => p.accountValue).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    const floor = median * 0.01;
    const firstValid = pts.findIndex(p => p.accountValue >= floor);
    if (firstValid > 0) pts = pts.slice(firstValid);
  }

  // Step 3: detect and remove deposit spikes anywhere in the series.
  // A >5x jump in < 7 days is almost certainly an external deposit, not trading.
  // Remove the pre-spike point so TWR doesn't treat the deposit as a return.
  const DEPOSIT_RATIO = 5;
  const DEPOSIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  let i = 0;
  while (i < pts.length - 1) {
    const ratio = pts[i + 1].accountValue / pts[i].accountValue;
    const delta = pts[i + 1].time - pts[i].time;
    if (ratio > DEPOSIT_RATIO && delta < DEPOSIT_WINDOW_MS) {
      pts.splice(i, 1); // drop the pre-deposit point; re-check from same index
    } else {
      i++;
    }
  }

  return pts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("\nOpenVault — Metrics Computation Worker");
console.log("━".repeat(60));

// Fetch market prices once — shared across all vaults.
// Returns empty arrays if market_prices table is not yet populated;
// betaToMarket() returns null gracefully in that case.
const [btcPrices, ethPrices] = await Promise.all([
  getMarketPrices(sql, "BTC"),
  getMarketPrices(sql, "ETH"),
]);

console.log(
  `Market prices: BTC=${btcPrices.length} pts, ETH=${ethPrices.length} pts` +
    (btcPrices.length === 0 ? " (beta will be null — populate market_prices to enable)" : ""),
);

const vaultAddresses = singleVaultArg
  ? [singleVaultArg]
  : await getVaultAddresses(sql);

console.log(`Vaults to process: ${vaultAddresses.length}\n`);

let succeeded = 0;
let failed = 0;
const results = [];

for (const vaultAddress of vaultAddresses) {
  try {
    // ── Fetch data ────────────────────────────────────────────────────────────
    const [navPoints, closingFills, fillStats, classificationFills, latestPositions] =
      await Promise.all([
        getNavSeries(sql, vaultAddress),
        getClosingFills(sql, vaultAddress),
        getFillStats(sql, vaultAddress),
        getFillsForClassification(sql, vaultAddress),
        getLatestPositions(sql, vaultAddress),
      ]);

    // ── Sanitize NAV series ───────────────────────────────────────────────────
    const cleanNav = sanitizeNavSeries(navPoints);

    // Compute data window metadata for UI display
    const sortedClean = [...cleanNav].sort((a, b) => a.time - b.time);
    const navStart = sortedClean[0]?.time ?? null;
    const navEnd   = sortedClean[sortedClean.length - 1]?.time ?? null;
    const daysElapsed = navStart && navEnd
      ? Math.round((navEnd - navStart) / 86400000)
      : 0;

    // Compact sparkline: up to 24 evenly-sampled normalized NAV values (first = 1.0)
    // Used for the leaderboard row mini-chart.
    //
    // Uses raw navPoints (not sanitized) so shape matches the vault AUM chart.
    // Only strips leading near-zero initialization points (step 1 of sanitization)
    // so the base value is always positive. Deposit spikes are kept intentionally.
    function sampleSparkline(pts, maxPoints = 24) {
      if (pts.length < 2) return null;
      // Strip leading near-zero init points so base is a real deposit value.
      const sorted = [...pts].sort((a, b) => a.time - b.time);
      const values = sorted.map(p => p.accountValue).sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      const floor = median * 0.01;
      const firstValid = sorted.findIndex(p => p.accountValue >= floor);
      const trimmed = firstValid > 0 ? sorted.slice(firstValid) : sorted;
      if (trimmed.length < 2) return null;
      // Linspace sampling: always include first and last, distribute evenly.
      const sampled = trimmed.length <= maxPoints
        ? trimmed
        : Array.from({ length: maxPoints }, (_, i) => {
            const idx = Math.round(i * (trimmed.length - 1) / (maxPoints - 1));
            return trimmed[idx];
          });
      const base = sampled[0].accountValue;
      if (base <= 0) return null;
      return sampled.map(p => Math.round((p.accountValue / base) * 1000) / 1000);
    }
    const navSparkline = sampleSparkline(navPoints);

    // ── Compute metrics ───────────────────────────────────────────────────────

    const annReturn    = annualizedReturn(cleanNav);
    const sharpe       = sharpeRatio(cleanNav);
    const sortino      = sortinoRatio(cleanNav);
    const calmar       = calmarRatio(cleanNav);
    const mdd          = maxDrawdown(cleanNav);
    const avgDD        = avgDrawdown(cleanNav);
    const mddDays      = maxDrawdownDays(cleanNav);
    const wr           = winRate(closingFills);
    const pf           = profitFactor(closingFills);
    // Cap beta to interpretable range. Blown-up vaults produce extreme OLS
    // estimates (e.g. 130,000) from a few extreme NAV swings — those are
    // numerically meaningless and should not be displayed.
    const rawBtcBeta   = betaToMarket(cleanNav, btcPrices);
    const rawEthBeta   = betaToMarket(cleanNav, ethPrices);
    const btcBeta      = rawBtcBeta != null && Math.abs(rawBtcBeta) <= 10 ? rawBtcBeta : null;
    const ethBeta      = rawEthBeta != null && Math.abs(rawEthBeta) <= 10 ? rawEthBeta : null;

    const classification = classifyStrategy(classificationFills, latestPositions);

    // Funding income % = |total funding| / (|total funding| + |total realized pnl|)
    const totalRealizedPnl = closingFills.reduce((s, f) => s + f.closedPnl, 0);
    const totalFunding = latestPositions.reduce((s, p) => s + p.cumFundingAllTime, 0);
    const fundingIncomePct =
      Math.abs(totalFunding) + Math.abs(totalRealizedPnl) > 0.01
        ? Math.abs(totalFunding) / (Math.abs(totalFunding) + Math.abs(totalRealizedPnl))
        : null;

    const score = riskScore({
      maxDrawdown:      mdd,
      sharpeRatio:      sharpe,
      sortino:          sortino,
      winRate:          wr,
      annualizedReturn: annReturn,
      fundingIncomePct: fundingIncomePct,
    });

    // ── Persist ───────────────────────────────────────────────────────────────
    await upsertVaultMetrics(sql, {
      vault_address:      vaultAddress,
      computed_at:        new Date(),
      annualized_return:  annReturn,
      win_rate:           wr,
      profit_factor:      pf,
      sharpe_ratio:       sharpe,
      sortino_ratio:      sortino,
      calmar_ratio:       calmar,
      max_drawdown:       mdd,
      avg_drawdown:       avgDD,
      max_drawdown_days:  Math.round(mddDays),
      btc_beta:           btcBeta,
      eth_beta:           ethBeta,
      funding_income_pct: fundingIncomePct,
      strategy_type:      classification.strategyType,
      risk_score:         score,
      data: {
        classification: {
          confidence: classification.confidence,
          signals:    classification.signals,
        },
        fillStats: {
          count:       fillStats.count,
          oldestTime:  fillStats.oldestTime?.toISOString() ?? null,
          newestTime:  fillStats.newestTime?.toISOString() ?? null,
          buyCount:    fillStats.buyCount,
          sellCount:   fillStats.sellCount,
        },
        navPoints:     navPoints.length,
        navPointsUsed: cleanNav.length,
        daysElapsed:   daysElapsed,
        navStartDate:  navStart?.toISOString() ?? null,
        navEndDate:    navEnd?.toISOString() ?? null,
        navSparkline:  navSparkline,
      },
    });

    // ── Log ───────────────────────────────────────────────────────────────────
    const short = vaultAddress.slice(0, 10) + "…";
    console.log(
      `${pad(short, 14)} ` +
      `strategy=${pad(classification.strategyType, 18)} ` +
      `risk=${pad(fmt(score, 1), 5)} ` +
      `sharpe=${pad(fmt(sharpe), 7)} ` +
      `return=${pad(fmtPct(annReturn), 9)} ` +
      `mdd=${pad(fmtPct(mdd), 7)} ` +
      `fills=${pad(fillStats.count, 7)} ` +
      `nav=${navPoints.length}→${cleanNav.length}`
    );

    results.push({ vaultAddress, score, strategyType: classification.strategyType, annReturn });
    succeeded++;
  } catch (err) {
    console.error(`[${vaultAddress.slice(0, 10)}…] FAILED: ${err.message}`);
    failed++;
  }
}

// ─── Summary table (sorted by risk score) ────────────────────────────────────

console.log("\n" + "━".repeat(60));
console.log("SUMMARY — sorted by risk score (low = safer)");
console.log("━".repeat(60));

results
  .sort((a, b) => (a.score ?? 10) - (b.score ?? 10))
  .forEach(({ vaultAddress, score, strategyType, annReturn }) => {
    console.log(
      `  ${vaultAddress.slice(0, 12)}…  ` +
      `score=${pad(fmt(score, 1), 5)}  ` +
      `strategy=${pad(strategyType, 18)}  ` +
      `return=${fmtPct(annReturn)}`
    );
  });

console.log("\n" + "━".repeat(60));
console.log(`  Succeeded : ${succeeded}`);
console.log(`  Failed    : ${failed}`);
console.log(`  Total     : ${vaultAddresses.length}`);
console.log("━".repeat(60) + "\n");

await sql.end();
