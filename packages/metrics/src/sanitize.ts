import type { NavPoint } from "./returns.js";

/**
 * Clean a raw NAV series before feeding it to metrics functions.
 *
 * Two problems in the raw data:
 * 1. Vaults are initialized with near-zero NAV before deposits arrive. Including
 *    those points in TWR makes a $1→$100k deposit look like a 100,000x return.
 * 2. Large external deposits cause >5x NAV jumps that look like trading returns.
 *
 * Fixes:
 * - Step 1: drop leading points where NAV < 1% of the series median (catches
 *   near-zero initialization artifacts). Uses median so one outlier doesn't set
 *   the floor.
 * - Step 2: detect and remove deposit spikes (>5x jumps in < 7 days). Removes
 *   the pre-spike point so TWR doesn't treat the deposit as a return.
 *
 * NOTE: We intentionally do NOT filter by firstFillTime. Fill ingestion is
 * incomplete for many vaults (BFS-discovered vaults only have recent fills),
 * so using firstFillTime would silently discard months of valid NAV history.
 */
export function sanitizeNavSeries(navPoints: NavPoint[]): NavPoint[] {
  let pts = [...navPoints].sort((a, b) => a.time.getTime() - b.time.getTime());

  // Step 1: drop leading near-zero initialization points
  if (pts.length >= 2) {
    const values = [...pts].map((p) => p.accountValue).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)]!;
    const floor = median * 0.01;
    const firstValid = pts.findIndex((p) => p.accountValue >= floor);
    if (firstValid > 0) pts = pts.slice(firstValid);
  }

  // Step 2: detect and remove deposit spikes anywhere in the series.
  // A >5x jump in < 7 days is almost certainly an external deposit, not trading.
  // Remove the pre-spike point so TWR doesn't treat the deposit as a return.
  const DEPOSIT_RATIO = 5;
  const DEPOSIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  let i = 0;
  while (i < pts.length - 1) {
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const ratio = next.accountValue / curr.accountValue;
    const delta = next.time.getTime() - curr.time.getTime();
    if (ratio > DEPOSIT_RATIO && delta < DEPOSIT_WINDOW_MS) {
      pts.splice(i, 1); // drop the pre-deposit point; re-check from same index
    } else {
      i++;
    }
  }

  return pts;
}
