/**
 * Hyperliquid API Exploration Script
 * Run: node packages/hyperliquid/explore.mjs
 *
 * Purpose: Answer every question on the API exploration checklist in CLAUDE.md.
 * This is a one-time research tool — not production code.
 */

const BASE = "https://api.hyperliquid.xyz/info";

async function hl(body) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return { __error: res.status, __body: text };
  }
  return res.json();
}

function section(title) {
  console.log("\n" + "=".repeat(70));
  console.log(`  ${title}`);
  console.log("=".repeat(70));
}

function show(label, data) {
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(data, null, 2));
}

// ─── Known vault addresses to seed exploration ───────────────────────────────
// These are well-known vaults pulled from the Hyperliquid leaderboard.
// We verify them with userRole before using.
const CANDIDATE_VAULTS = [
  "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303", // commonly referenced
  "0x1719884eb866cb12b2287399b15f7db5e7d775ea", // HLP vault (official)
  "0x010461c14e146ac35fe42271bdc1134ee31c703a", // another common vault
];

// ─── STEP 1: Vault Discovery ─────────────────────────────────────────────────
section("STEP 1 — Vault Discovery: userRole");

let confirmedVault = null;
let confirmedLeader = null;

for (const addr of CANDIDATE_VAULTS) {
  const role = await hl({ type: "userRole", user: addr });
  show(`userRole(${addr})`, role);
  if (role === "vault" || role?.role === "vault" || role === '"vault"') {
    confirmedVault = addr;
    console.log(`\n✓ Confirmed vault address: ${addr}`);
    break;
  }
}

// If none confirmed, use first candidate anyway and continue exploring
if (!confirmedVault) {
  confirmedVault = CANDIDATE_VAULTS[0];
  console.log(`\n⚠ No vault confirmed via userRole — using ${confirmedVault} anyway, check raw responses above.`);
}

// ─── STEP 2: vaultDetails ────────────────────────────────────────────────────
section("STEP 2 — Vault Details");

const vaultDetails = await hl({ type: "vaultDetails", vaultAddress: confirmedVault });
show("vaultDetails", vaultDetails);

// Extract leader/operator address from response
if (vaultDetails && typeof vaultDetails === "object") {
  const leader = vaultDetails.leader ?? vaultDetails.operator ?? vaultDetails.leaderAddress;
  if (leader) {
    confirmedLeader = leader;
    console.log(`\n✓ Leader/operator address: ${leader}`);
  } else {
    console.log("\n⚠ Could not find leader/operator in vaultDetails — inspect full response above.");
    // Try to find any address-like field
    const keys = Object.keys(vaultDetails);
    console.log("Top-level keys:", keys);
  }
}

// ─── STEP 3: Operator Linking ────────────────────────────────────────────────
section("STEP 3 — Operator Linking");

if (confirmedLeader) {
  const leaderRole = await hl({ type: "userRole", user: confirmedLeader });
  show(`userRole(leader=${confirmedLeader})`, leaderRole);

  // Does the leader also have vault activity? Check clearinghouseState
  const leaderState = await hl({ type: "clearinghouseState", user: confirmedLeader });
  show(`clearinghouseState(leader)`, leaderState);
}

// ─── STEP 4: Trade History ───────────────────────────────────────────────────
section("STEP 4 — Trade History: userFills (most recent 2000)");

const fills = await hl({ type: "userFills", user: confirmedVault });
if (Array.isArray(fills)) {
  console.log(`\nTotal fills returned: ${fills.length}`);
  if (fills.length > 0) {
    show("First fill (full shape)", fills[0]);
    show("Last fill (oldest in batch)", fills[fills.length - 1]);
    console.log("\nAll keys on a fill object:", Object.keys(fills[0]));
    console.log("Oldest fill time:", fills[fills.length - 1]?.time, "→", new Date(fills[fills.length - 1]?.time).toISOString());
    console.log("Newest fill time:", fills[0]?.time, "→", new Date(fills[0]?.time).toISOString());
  }
} else {
  show("userFills raw response", fills);
}

// ─── STEP 4b: userFillsByTime pagination ─────────────────────────────────────
section("STEP 4b — Trade History: userFillsByTime (paginated)");

const now = Date.now();
const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

const fillsByTime = await hl({
  type: "userFillsByTime",
  user: confirmedVault,
  startTime: thirtyDaysAgo,
  endTime: now,
});

if (Array.isArray(fillsByTime)) {
  console.log(`\nFills in last 30 days: ${fillsByTime.length}`);
  if (fillsByTime.length > 0) {
    show("First fill by time", fillsByTime[0]);
    // Keys check — should match userFills shape
    console.log("Keys:", Object.keys(fillsByTime[0]));
  }
} else {
  show("userFillsByTime raw response", fillsByTime);
}

// Try to get earliest history by using a very old startTime
section("STEP 4c — History depth: how far back does data go?");

const veryOld = new Date("2023-01-01").getTime();
const fillsOld = await hl({
  type: "userFillsByTime",
  user: confirmedVault,
  startTime: veryOld,
  endTime: veryOld + 30 * 24 * 60 * 60 * 1000, // 30 days window
});
if (Array.isArray(fillsOld)) {
  console.log(`\nFills in Jan 2023: ${fillsOld.length}`);
  if (fillsOld.length > 0) show("Earliest fill found", fillsOld[0]);
} else {
  show("fillsByTime(2023-01) raw", fillsOld);
}

// ─── STEP 5: Positions and State ─────────────────────────────────────────────
section("STEP 5 — Current Positions and Equity: clearinghouseState");

const chState = await hl({ type: "clearinghouseState", user: confirmedVault });
show("clearinghouseState (vault)", chState);

if (chState && typeof chState === "object") {
  console.log("\nTop-level keys:", Object.keys(chState));
  if (chState.assetPositions?.length > 0) {
    show("First open position", chState.assetPositions[0]);
    console.log("Position keys:", Object.keys(chState.assetPositions[0]));
  } else {
    console.log("No open positions currently.");
  }
}

// ─── STEP 5b: Portfolio (NAV history) ────────────────────────────────────────
section("STEP 5b — NAV History: portfolio");

const portfolio = await hl({ type: "portfolio", user: confirmedVault, timespan: "allTime" });
show("portfolio (allTime)", portfolio);

// ─── STEP 6: Funding Payments ────────────────────────────────────────────────
section("STEP 6 — Funding: fundingHistory (global rate for BTC)");

const fundingHistory = await hl({
  type: "fundingHistory",
  coin: "BTC",
  startTime: thirtyDaysAgo,
  endTime: now,
});
if (Array.isArray(fundingHistory)) {
  console.log(`\nFunding rate records for BTC (30d): ${fundingHistory.length}`);
  if (fundingHistory.length > 0) show("First funding record", fundingHistory[0]);
} else {
  show("fundingHistory raw", fundingHistory);
}

// Check if fills contain funding data
section("STEP 6b — Is funding income in fills? Check fill types");

if (Array.isArray(fills) && fills.length > 0) {
  // Look for any fills that might be funding-related
  const uniqueTypes = [...new Set(fills.map(f => f.dir ?? f.type ?? f.side ?? "unknown"))];
  console.log("\nUnique fill 'dir' values:", uniqueTypes);
  const fundingFills = fills.filter(f =>
    JSON.stringify(f).toLowerCase().includes("fund")
  );
  console.log(`Fills containing 'fund': ${fundingFills.length}`);
  if (fundingFills.length > 0) show("Funding-related fill", fundingFills[0]);
}

// ─── STEP 7: Rate Limits ──────────────────────────────────────────────────────
section("STEP 7 — Rate Limits: fire 120 requests rapidly");

const rateTestStart = Date.now();
const errors = [];
const results = [];

for (let i = 0; i < 120; i++) {
  const res = await hl({ type: "allMids" });
  if (res?.__error) {
    errors.push({ i, ...res });
    console.log(`Request ${i}: ERROR ${res.__error} — ${res.__body}`);
    if (errors.length >= 3) {
      console.log("Hit 3 errors — stopping rate limit test.");
      break;
    }
  } else {
    results.push(i);
  }
}

const elapsed = Date.now() - rateTestStart;
console.log(`\nRate limit test: ${results.length} success, ${errors.length} errors in ${elapsed}ms`);
console.log(`Req/sec achieved: ${(results.length / (elapsed / 1000)).toFixed(1)}`);

if (errors.length > 0) {
  show("Rate limit error response", errors[0]);
} else {
  console.log("No rate limit errors encountered at this rate.");
}

// ─── STEP 8: userRole on all candidate addresses ──────────────────────────────
section("STEP 8 — userRole on all candidates (confirm vault vs user)");

for (const addr of CANDIDATE_VAULTS) {
  const role = await hl({ type: "userRole", user: addr });
  console.log(`${addr}: ${JSON.stringify(role)}`);
}

// ─── STEP 9: HLP official vault deep-dive ─────────────────────────────────────
section("STEP 9 — HLP Official Vault Details");

const hlpVault = "0x1719884eb866cb12b2287399b15f7db5e7d775ea";
const hlpDetails = await hl({ type: "vaultDetails", vaultAddress: hlpVault });
show("HLP vaultDetails", hlpDetails);

// ─── STEP 10: userVaultEquities (inverse: find vaults a user is in) ───────────
section("STEP 10 — userVaultEquities (find vaults for a depositor address)");

// Use the confirmed leader as the query address
if (confirmedLeader) {
  const vaultEquities = await hl({ type: "userVaultEquities", user: confirmedLeader });
  show(`userVaultEquities(leader=${confirmedLeader})`, vaultEquities);
}

console.log("\n" + "=".repeat(70));
console.log("  EXPLORATION COMPLETE");
console.log("=".repeat(70) + "\n");
