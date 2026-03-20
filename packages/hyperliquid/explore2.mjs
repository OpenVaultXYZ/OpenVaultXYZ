/**
 * Round 2: Explore a regular vault (not HLP) to get fills, positions, and structure.
 * Also test vault discovery approaches.
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

// Vault addresses discovered so far:
// 0xdfc24b077bc1425ad1dea75bcb6f8158e10df303 = HLP (protocol vault, no fills exposed)
// 0x010461c14e146ac35fe42271bdc1134ee31c703a = confirmed vault
// 0x63c621a33714ec48660e32f2374895c8026a3a00 = from userVaultEquities
const VAULT_A = "0x010461c14e146ac35fe42271bdc1134ee31c703a";
const VAULT_B = "0x63c621a33714ec48660e32f2374895c8026a3a00";

// ─── Try to discover more vaults via the leaderboard-style endpoint ─────────
section("VAULT DISCOVERY — Does a 'leaderboard' or 'allVaults' type exist?");

// Try various potential discovery endpoints
const discoveryAttempts = [
  { type: "leaderboard" },
  { type: "allVaults" },
  { type: "vaultList" },
  { type: "vaults" },
  { type: "topVaults" },
  { type: "perpetualsAtOpenInterest" },
];

for (const body of discoveryAttempts) {
  const result = await hl(body);
  console.log(`${body.type}:`, JSON.stringify(result).substring(0, 200));
}

// ─── Vault A: vaultDetails ───────────────────────────────────────────────────
section(`VAULT A Details (${VAULT_A})`);

const vaultADetails = await hl({ type: "vaultDetails", vaultAddress: VAULT_A });
show("vaultDetails (Vault A)", vaultADetails);
if (vaultADetails && typeof vaultADetails === "object") {
  console.log("Top-level keys:", Object.keys(vaultADetails));
  console.log("Leader:", vaultADetails.leader);
  console.log("APR:", vaultADetails.apr);
  console.log("isClosed:", vaultADetails.isClosed);
  console.log("Followers count:", vaultADetails.followers?.length);
}

// ─── Vault A: fills ──────────────────────────────────────────────────────────
section(`VAULT A Fills (${VAULT_A})`);

const vaultAFills = await hl({ type: "userFills", user: VAULT_A });
if (Array.isArray(vaultAFills)) {
  console.log(`Fills returned: ${vaultAFills.length}`);
  if (vaultAFills.length > 0) {
    show("First fill", vaultAFills[0]);
    show("Last fill (oldest)", vaultAFills[vaultAFills.length - 1]);
    console.log("\nAll fill keys:", Object.keys(vaultAFills[0]));
    // Check if closedPnl is included
    console.log("Has closedPnl:", "closedPnl" in vaultAFills[0]);
    console.log("Has pnl:", "pnl" in vaultAFills[0]);
    console.log("Oldest fill time:", new Date(vaultAFills[vaultAFills.length - 1]?.time).toISOString());
    console.log("Newest fill time:", new Date(vaultAFills[0]?.time).toISOString());
  }
} else {
  show("userFills raw", vaultAFills);
}

// ─── Vault A: userFillsByTime deep history ──────────────────────────────────
section(`VAULT A: History depth test`);

const origins = [
  new Date("2024-01-01").getTime(),
  new Date("2023-01-01").getTime(),
  new Date("2022-01-01").getTime(),
];

for (const start of origins) {
  const end = start + 30 * 24 * 60 * 60 * 1000;
  const result = await hl({ type: "userFillsByTime", user: VAULT_A, startTime: start, endTime: end });
  const count = Array.isArray(result) ? result.length : "error";
  console.log(`${new Date(start).toISOString().substring(0, 10)}: ${count} fills`);
  if (Array.isArray(result) && result.length > 0) {
    show("Earliest fill found", result[0]);
  }
}

// ─── Vault A: clearinghouseState ─────────────────────────────────────────────
section(`VAULT A: clearinghouseState (positions, equity)`);

const vaultAClearinghouse = await hl({ type: "clearinghouseState", user: VAULT_A });
show("clearinghouseState (Vault A)", vaultAClearinghouse);
if (vaultAClearinghouse?.assetPositions?.length > 0) {
  show("First position", vaultAClearinghouse.assetPositions[0]);
  console.log("Position keys:", Object.keys(vaultAClearinghouse.assetPositions[0]));
  const pos = vaultAClearinghouse.assetPositions[0];
  if (pos.position) {
    console.log("Position sub-keys:", Object.keys(pos.position));
  }
}

// ─── Vault B: vaultDetails + fills ───────────────────────────────────────────
section(`VAULT B: ${VAULT_B}`);

const vaultBRole = await hl({ type: "userRole", user: VAULT_B });
show("userRole (Vault B)", vaultBRole);

const vaultBDetails = await hl({ type: "vaultDetails", vaultAddress: VAULT_B });
if (vaultBDetails) {
  console.log("Vault B name:", vaultBDetails.name);
  console.log("Vault B leader:", vaultBDetails.leader);
  console.log("Vault B APR:", vaultBDetails.apr);
}

const vaultBFills = await hl({ type: "userFills", user: VAULT_B });
if (Array.isArray(vaultBFills)) {
  console.log(`Vault B fills: ${vaultBFills.length}`);
  if (vaultBFills.length > 0) show("Vault B first fill", vaultBFills[0]);
} else {
  show("Vault B fills raw", vaultBFills);
}

// ─── Operator: can leader address also trade? ─────────────────────────────────
section("Operator: check if leader has their own fills");

let leaderAddr = null;
if (vaultADetails?.leader) leaderAddr = vaultADetails.leader;

if (leaderAddr) {
  console.log("Leader address:", leaderAddr);
  const leaderRole = await hl({ type: "userRole", user: leaderAddr });
  show("Leader userRole", leaderRole);

  const leaderFills = await hl({ type: "userFills", user: leaderAddr });
  if (Array.isArray(leaderFills)) {
    console.log(`Leader personal fills: ${leaderFills.length}`);
    if (leaderFills.length > 0) {
      show("Leader first fill", leaderFills[0]);
    }
  }
}

// ─── Full vaultDetails key survey ────────────────────────────────────────────
section("Full vaultDetails key survey (all fields)");

// Use vaultA and list every key including nested
function flatKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    keys.push(`${full}: ${Array.isArray(v) ? `Array[${v.length}]` : typeof v} = ${JSON.stringify(v)?.substring(0, 80)}`);
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length < 20) {
      keys.push(...flatKeys(v, full));
    }
  }
  return keys;
}

if (vaultADetails && typeof vaultADetails === "object") {
  const surveyed = flatKeys(vaultADetails);
  console.log("\nVault A field tree (truncated values):");
  for (const line of surveyed.slice(0, 80)) {
    console.log(" ", line);
  }
}

// ─── Rate limit: test burst with POST requests, more aggressive ───────────────
section("Rate limit: 200 rapid sequential requests");

const rateStart = Date.now();
const rateErrors = [];
let rateSuccess = 0;

for (let i = 0; i < 200; i++) {
  const res = await hl({ type: "allMids" });
  if (res?.__error) {
    rateErrors.push({ i, ...res });
    console.log(`Request ${i}: ERROR ${res.__error} — ${res.__body}`);
    if (rateErrors.length >= 5) break;
  } else {
    rateSuccess++;
  }
}

const rateElapsed = Date.now() - rateStart;
console.log(`\nRate limit (200 req): ${rateSuccess} success, ${rateErrors.length} errors in ${rateElapsed}ms`);
console.log(`Req/sec: ${(rateSuccess / (rateElapsed / 1000)).toFixed(1)}`);
if (rateErrors.length > 0) {
  show("Rate limit error", rateErrors[0]);
}

console.log("\n" + "=".repeat(70));
console.log("  ROUND 2 COMPLETE");
console.log("=".repeat(70) + "\n");
