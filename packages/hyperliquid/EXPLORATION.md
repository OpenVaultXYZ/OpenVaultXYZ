# Hyperliquid API — EXPLORATION.md

## What This File Is

Technical findings from exploring the Hyperliquid API.
Written before any production code. Updated as exploration progresses.
This is the source of truth for what the API actually returns — not what the docs say it returns.

Lives at: `packages/hyperliquid/EXPLORATION.md`

---

## How to Use It

All findings here come from running real POST requests against mainnet (`https://api.hyperliquid.xyz/info`).
Exploration scripts are at `packages/hyperliquid/explore.mjs` and `explore2.mjs`.

Production code should be written from what's documented here, not from assumptions.

---

## Exploration Status

Started: [x] 2026-03-14
Mainnet confirmed working: [x]
All checklist items answered: [x]
Schema designed from findings: [ ] — next step

---

## API Basics

**Single endpoint:** `POST https://api.hyperliquid.xyz/info`
All queries use the same URL. The `type` field in the JSON body dispatches to the correct handler.

**Unknown type behavior:** Returns HTTP 422 `"Failed to deserialize the JSON body into the target type"`.
This is how we confirmed no `leaderboard`, `allVaults`, `vaultList`, etc. endpoints exist.

---

## Vault Discovery

### How to get a list of all active vaults

**Answer: No endpoint exists for this.**

Tested: `leaderboard`, `allVaults`, `vaultList`, `vaults`, `topVaults` — all return HTTP 422.

**Practical approaches (in order of preference):**
1. **Scrape the Hyperliquid app UI** — the vaults leaderboard at app.hyperliquid.xyz renders vault addresses
2. **userVaultEquities on known depositor addresses** — returns all vaults a user is deposited in; useful for discovery from known participants
3. **Community-maintained lists** — HL ecosystem trackers maintain vault address lists
4. **Bootstrap from known addresses + BFS** — seed with known vaults, extract follower addresses, check each with `userRole`

This is a meaningful constraint for the ingestion architecture: **vault discovery is a separate, external problem from vault data retrieval**. We'll need a vault registry seeded externally and expanded over time.

### What does a vault address look like?

Standard 42-character Ethereum-style hex address, lowercase, prefixed with `0x`.
```
0xdfc24b077bc1425ad1dea75bcb6f8158e10df303  ← HLP vault
0x010461c14e146ac35fe42271bdc1134ee31c703a  ← HLP Strategy A (sub-vault)
0x63c621a33714ec48660e32f2374895c8026a3a00  ← Liquidator vault
```

**Vault addresses are indistinguishable from regular account addresses by format alone.**
Use `userRole` to confirm.

### How to distinguish a vault from a regular account

```
POST /info  {"type": "userRole", "user": "0x..."}
```

Response shapes:
```json
{"role": "vault"}       // it's a vault
{"role": "user"}        // regular trading account
{"role": "missing"}     // address doesn't exist
{"role": "agent"}       // API agent key
{"role": "subAccount"}  // sub-account
```

### What fields does a vault object contain?

```
POST /info  {"type": "vaultDetails", "vaultAddress": "0x..."}
```

Full response shape (from HLP and HLP Strategy A):
```json
{
  "name": "Hyperliquidity Provider (HLP)",
  "vaultAddress": "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303",
  "leader": "0x677d831aef5328190852e24f13c46cac05f984e7",
  "description": "This community-owned vault provides liquidity...",
  "portfolio": [
    ["day",   {"accountValueHistory": [[timestamp_ms, "value"], ...], "pnlHistory": [[timestamp_ms, "value"], ...], "vlm": "0.0"}],
    ["week",  {"accountValueHistory": [...], "pnlHistory": [...], "vlm": "0.0"}],
    ["month", {"accountValueHistory": [...], "pnlHistory": [...], "vlm": "0.0"}],
    ["allTime", {"accountValueHistory": [...], "pnlHistory": [...], "vlm": "0.0"}]
  ],
  "apr": 0.012296501767436546,
  "followerState": null,
  "leaderFraction": 0.000844013991406654,
  "leaderCommission": 0,
  "followers": [
    {
      "user": "0x...",
      "vaultEquity": "2228569.205",
      "pnl": "1650.308",
      "allTimePnl": "3663.657",
      "daysFollowing": 173,
      "vaultEntryTime": 1758546668681,
      "lockupUntil": 1771668308463
    }
  ],
  "maxDistributable": 149647651.59,
  "maxWithdrawable": 0,
  "isClosed": false,
  "relationship": {"type": "child"},
  "allowDeposits": true,
  "alwaysCloseOnWithdraw": false
}
```

**Field notes:**
- `leader` — the operator address. Always present.
- `apr` — annualized return as a decimal (0.012 = 1.2%). Pre-computed by HL, methodology unknown.
- `followerState` — null if you're not querying as an authenticated user deposited in this vault.
- `leaderFraction` — fraction of total equity owned by the leader. Used to compute operator skin-in-game.
- `leaderCommission` — profit share taken by leader (0–1). 0 = no commission.
- `followers` — array of all depositors with their equity, PnL, entry time, and lockup expiry.
- `maxDistributable` — total USDC that can be distributed to followers.
- `maxWithdrawable` — how much the operator can withdraw right now. 0 = locked.
- `isClosed` — if true, vault is no longer accepting deposits.
- `relationship` — `{"type": "child"}` for sub-vaults, `{"type": "parent"}` for parent vaults, `{"type": "normal"}` for standalone vaults. Previously observed as `null` for standalone vaults — API was updated to use an explicit value.
- `allowDeposits` — whether public deposits are currently accepted.
- `portfolio` — embedded NAV and PnL history across 4 timespans. Same data as the standalone `portfolio` endpoint.

### How is operator address linked to vault address?

`vaultDetails.leader` IS the operator address. Always present, always a valid hex address.

**Reverse lookup** (all vaults for an operator): No direct endpoint. Use `userVaultEquities` on the operator address to see which vaults they have deposited in — but this only shows vaults where the operator is a depositor, not all vaults they operate. There is no "get all vaults by operator" query.

**Implication for schema:** We must maintain our own `operators` table and populate it from `vaultDetails.leader` during vault ingestion.

---

## Vault Hierarchy (Critical Finding)

**HLP has a parent-child vault structure:**
- `0xdfc24b077bc1425ad1dea75bcb6f8158e10df303` = "Hyperliquidity Provider (HLP)" — the **parent**
- `0x010461c14e146ac35fe42271bdc1134ee31c703a` = "HLP Strategy A" — a **child**
- `0x63c621a33714ec48660e32f2374895c8026a3a00` = "Liquidator" — another vault

Sub-vaults have `relationship: {"type": "child"}`. Their `leader` field points to the **parent vault address** (not a human operator). This means `leader` is not always a human — it can be another vault.

**Check `userRole(leader)` to determine if the leader is a vault or a user.**

For HLP Strategy A: `userRole(leader)` → `{"role": "vault"}` — leader is the HLP parent vault.
For HLP: `userRole(leader)` → `{"role": "user"}` — leader is a human operator.

---

## Trade History

### What endpoint returns trade history for a vault?

```
POST /info  {"type": "userFills", "user": "0x<vault_address>"}
```

Works on vault addresses — same as for regular users. Returns up to 2000 most recent fills.

### What does a single fill object look like?

All fields, from HLP Strategy A (an active market-maker vault):
```json
{
  "coin": "SAND",
  "px": "0.082478",
  "sz": "235.0",
  "side": "B",
  "time": 1773532848304,
  "startPosition": "201370.0",
  "dir": "Open Long",
  "closedPnl": "0.0",
  "hash": "0x53b80c4b07b033725531043712612601cd002430a2b35244f780b79dc6b40d5c",
  "oid": 349163041648,
  "crossed": true,
  "fee": "0.0",
  "tid": 116251791316602,
  "feeToken": "USDC",
  "twapId": null
}
```

**Field reference:**
| Field | Type | Notes |
|---|---|---|
| `coin` | string | Asset ticker, e.g. "BTC", "ETH", "SAND" |
| `px` | string (decimal) | Execution price |
| `sz` | string (decimal) | Size filled |
| `side` | string | "B" = bid fill (buy), "S" = sell fill, "A" = ask fill (also sell) — translate "A" → "sell" |
| `time` | number | Unix timestamp in milliseconds |
| `startPosition` | string (decimal) | Position size **before** this fill |
| `dir` | string | Human-readable: "Open Long", "Close Long", "Open Short", "Close Short" |
| `closedPnl` | string (decimal) | Realized PnL for this fill. "0.0" for opens. |
| `hash` | string | Transaction hash |
| `oid` | number | Order ID |
| `crossed` | boolean | true = taker (crossed the spread), false = maker |
| `fee` | string (decimal) | Fee paid in feeToken |
| `tid` | number | Trade ID (unique per fill) |
| `feeToken` | string | Always "USDC" observed |
| `twapId` | number \| null | Non-null if fill was part of a TWAP order |

**`pnl` field does NOT exist.** Use `closedPnl`. For opening fills, `closedPnl` = "0.0".
**All numeric values are returned as strings** — must parse with `parseFloat()`.

### How do you paginate through full history?

```
POST /info  {
  "type": "userFillsByTime",
  "user": "0x...",
  "startTime": <epoch_ms>,
  "endTime": <epoch_ms>
}
```

Returns up to 2000 fills in the time window. Paginate by using the **last fill's `time`** as the next `startTime`.

**Warning:** If multiple fills share the same timestamp at a page boundary, you may miss some. Use `tid` (trade ID) for deduplication.

### How far back does history go?

Tested HLP Strategy A: requesting Jan 2024, Jan 2023, Jan 2022 all return 0 fills.
This vault was created as part of HLP which launched in 2023. The 2000-fill window for this vault covers only ~16 minutes (it trades at extremely high frequency — thousands of fills per hour).

**History depth depends on vault trading frequency.** HLP-style market makers will have shallow windows. Retail directional vaults may have full history going back to vault creation.

The `portfolio` endpoint in `vaultDetails` provides `accountValueHistory` starting from vault creation — this is the authoritative source for historical NAV.

### Are closed PnL figures included per trade?

**Yes.** `closedPnl` is present on every fill. For opening trades it is "0.0". For closing trades it is the realized PnL for that specific fill. No additional calculation needed for realized PnL per fill.

**Cumulative funding** is NOT in fills — it's in `clearinghouseState.assetPositions[n].position.cumFunding`.

---

## Positions and State

### How do you get current open positions for a vault?

```
POST /info  {"type": "clearinghouseState", "user": "0x<vault_address>"}
```

Full response shape:
```json
{
  "marginSummary": {
    "accountValue": "121671239.576643",
    "totalNtlPos": "17021132.702718",
    "totalRawUsd": "119730590.155969",
    "totalMarginUsed": "851056.635079"
  },
  "crossMarginSummary": {
    "accountValue": "121671239.576643",
    "totalNtlPos": "17021132.702718",
    "totalRawUsd": "119730590.155969",
    "totalMarginUsed": "851056.635079"
  },
  "crossMaintenanceMarginUsed": "170211.326947",
  "withdrawable": "121671239.576643",
  "assetPositions": [
    {
      "type": "oneWay",
      "position": {
        "coin": "BTC",
        "szi": "32.2509",
        "leverage": {"type": "cross", "value": 20},
        "entryPx": "70776.0",
        "positionValue": "2294909.5422",
        "unrealizedPnl": "12317.805541",
        "returnOnEquity": "0.107928",
        "liquidationPx": null,
        "marginUsed": "114745.477",
        "maxLeverage": 50,
        "cumFunding": {
          "allTime": "-620935.909186",
          "sinceOpen": "12557.346692",
          "sinceChange": "0.0"
        }
      }
    }
  ],
  "time": 1773532723116
}
```

**Position field reference:**
| Field | Type | Notes |
|---|---|---|
| `coin` | string | Asset |
| `szi` | string (decimal) | Signed position size. Positive = long, negative = short |
| `leverage.type` | string | "cross" or "isolated" |
| `leverage.value` | number | Current effective leverage |
| `entryPx` | string (decimal) | Average entry price |
| `positionValue` | string (decimal) | Current mark value of position |
| `unrealizedPnl` | string (decimal) | Unrealized PnL at current mark price |
| `returnOnEquity` | string (decimal) | unrealizedPnl / marginUsed |
| `liquidationPx` | string \| null | Liquidation price. null if no liquidation risk |
| `marginUsed` | string (decimal) | Margin allocated to this position |
| `maxLeverage` | number | Max allowed leverage for this asset |
| `cumFunding.allTime` | string (decimal) | Total funding paid/received since position opened (can reset on changes) |
| `cumFunding.sinceOpen` | string (decimal) | Funding since current position was opened |
| `cumFunding.sinceChange` | string (decimal) | Funding since last position size change |

**Negative `cumFunding` = net payer (long in positive funding regime).**

### How do you get current equity / NAV?

`clearinghouseState.marginSummary.accountValue` — this is the total account value (NAV) including unrealized PnL.

Alternatively, `vaultDetails` embeds NAV history in `portfolio[*].accountValueHistory`.

### How do you get leverage utilization?

From `clearinghouseState`:
- `marginSummary.totalNtlPos` / `marginSummary.accountValue` = notional leverage ratio
- `marginSummary.totalMarginUsed` / `marginSummary.accountValue` = margin utilization ratio
- Per-position: `position.leverage.value` = current leverage for that specific position

### How do you get funding payments received?

**Not directly available as a standalone endpoint.** Two approximation methods:

1. **From positions:** `position.cumFunding.allTime` gives cumulative funding received/paid since position was opened. This resets when position is closed or significantly changed.

2. **From global rates + position history:** `fundingHistory` returns global funding rates per asset per 8-hour period. Multiply by position size to compute expected payment. This requires maintaining position snapshots.

3. **`userFunding` endpoint** — exists per the docs but not yet tested. May return per-address funding history directly. **TODO: test this endpoint.**

---

## Rate Limits

### What is the actual practical rate limit on the public API?

**Sustained throughput:** ~5 requests/second (tested with sequential requests — no parallelism).

Tests run:
- 120 sequential requests: 0 errors in 23.9 seconds → 5.0 req/sec
- 200 sequential requests: 0 errors in 39.5 seconds → 5.1 req/sec

No rate limit errors were encountered in either test. The observed 5 req/sec may be a network/latency effect rather than a hard API limit.

**The `userRateLimit` endpoint reports quota usage — should be queried to understand hard limits.**

```
POST /info  {"type": "userRateLimit", "user": "0x..."}
```
Returns request quota and cumulative volume. **TODO: test this.**

### Does it differ between REST and WebSocket?

Not yet tested for WebSocket. Presumably WebSocket has different limits — typically more lenient for subscriptions.

### What does a rate limit error response look like?

**Not observed in testing.** No errors at 200 req in ~40 seconds.
Expected to be HTTP 429 with a JSON body — not yet confirmed.

### How many vaults can you ingest per minute on the public API?

At 5 req/sec × 60 sec = ~300 req/min theoretical.
Each vault requires at minimum: `vaultDetails` + `clearinghouseState` + `userFills` = 3 requests.
**Theoretical: ~100 vaults/min** for basic ingestion. More for full history.

Using a private RPC from day one (Chainstack/HypeRPC, ~$50-100/mo) is strongly recommended to avoid production rate issues.

---

## Operator Linking

### Can you query all vaults by a given operator address?

**No direct endpoint.** `userVaultEquities` returns vaults a user has **deposited** in, not vaults they **operate**. The operator could own equity in their vault but this is not guaranteed.

The only reliable reverse-lookup is: maintain our own `operators` table populated from `vaultDetails.leader` during vault ingestion.

### Is operator address always present on vault data?

**Yes.** `vaultDetails.leader` is always present and is always a valid hex address. However, the leader may itself be a **vault address** (in the case of sub-vaults like HLP Strategy A). Always check `userRole(leader)` to determine if the operator is a human or another vault.

### Can one address be both a regular trader and an operator?

**Yes.** An address can be type `"user"` (regular trader) AND be listed as `leader` on one or more vaults. There is no restriction.

Confirmed: HLP's leader (`0x677d831aef5328190852e24f13c46cac05f984e7`) is `role: "user"` but operates HLP.

---

## Auxiliary Endpoints Confirmed Working

### `userVaultEquities`
```
POST /info  {"type": "userVaultEquities", "user": "0x..."}
```
Response: array of `{vaultAddress, equity, lockedUntilTimestamp}` for all vaults the address is deposited in.
Useful for: finding vaults an operator has deposited in (operator skin-in-game).

### `portfolio`
```
POST /info  {"type": "portfolio", "user": "0x...", "timespan": "allTime"}
```
Returns the same structure as `vaultDetails.portfolio`. Timespans: `"day"`, `"week"`, `"month"`, `"allTime"`, `"perpDay"`, `"perpWeek"`, `"perpMonth"`, `"perpAllTime"`.
The first 4 are aggregate (perps + spot); the `perp*` variants are perps-only. Use `"allTime"` for NAV history backfill.
Each timespan has `accountValueHistory: [[timestamp_ms, value_string], ...]` and `pnlHistory: [[timestamp_ms, value_string], ...]`.

### `fundingHistory`
```
POST /info  {"type": "fundingHistory", "coin": "BTC", "startTime": <ms>, "endTime": <ms>}
```
Returns global 8-hour funding rates for an asset. Up to 500 records per request. Paginate via last timestamp.
```json
{"coin": "BTC", "fundingRate": "0.0000125", "premium": "-0.0003218", "time": 1770940800092}
```

---

## Unexpected Findings

1. **No vault discovery endpoint exists.** This is a significant architecture constraint — vault registry must be maintained externally.

2. **HLP has a parent/child vault structure.** Sub-vaults (`relationship.type: "child"`) have `leader` pointing to the parent vault address, not a human. Must handle this case.

3. **HLP vault (`0xdfc24b...`) returns 0 fills from `userFills`.** Protocol-level vaults may not expose fill data directly. Only sub-vaults (HLP Strategy A, etc.) return fills.

4. **`closedPnl` is per-fill but resets on position changes.** It's NOT a running total — it's the PnL for just this specific fill/close. Sum all `closedPnl` across fills to get total realized PnL.

5. **All numeric values are returned as strings**, including prices, sizes, PnL, and equity. Must parse with `parseFloat()` or `BigNumber` for precision.

6. **`followerState` is null** unless you're querying as an authenticated depositor. We'll always see null in read-only ingestion mode. The `followers` array provides all depositor data without authentication.

7. **`portfolio.vlm` is always "0.0"** in observed responses. Volume may be tracked differently.

8. **Rate limits feel like ~5 req/sec** in sequential testing but no hard error was triggered. Actual limit is likely higher with parallelism — needs concurrent testing.

9. **`portfolio` returns 8 timespans, not 4.** (Discovered 2026-03-14 during first ingestion run.) In addition to `"day"`, `"week"`, `"month"`, `"allTime"`, the API now also returns `"perpDay"`, `"perpWeek"`, `"perpMonth"`, `"perpAllTime"` — a perps/spot breakdown. The original 4 appear to be aggregate totals; the `perp*` variants are perps-only. Schema updated to accept all 8 values.

10. **`relationship.type` can be `"normal"`.** (Discovered 2026-03-14.) In addition to `"parent"` and `"child"`, regular standalone vaults now return `{"type": "normal"}` instead of `null`. Previously observed as `null` for top-level vaults — the API was updated to use an explicit enum value. Zod schema updated accordingly.

11. **Fill `side` has three values: `"B"`, `"S"`, and `"A"`.** (First seen 2026-03-14, meaning confirmed 2026-03-15.) Initial assumption that "A" = auto-deleveraged (ADL) was WRONG. Confirmed meaning from data analysis across 567k fills:
    - `"B"` = bid-side fill — buy-direction trades (Open Long, Close Short, Short→Long)
    - `"A"` = ask-side fill — sell-direction trades (Close Long, Open Short, Long→Short)
    - `"S"` = sell-side fill — sell-direction trades (appears in some vaults but not others; possibly taker sells vs maker sells)
    - **"A" is a regular sell-side fill, not a rare risk event.** Market-making vaults (Growi HF, HLP Strategy A) have ~50% "A" fills and zero "S" fills — they trade exclusively on bid/ask. Directional vaults have a mix of "B", "S", and "A".
    - Translate `"A"` → `side: "sell"`. The `is_adl_event` field should remain in the schema but requires separate detection logic (not from `side = "A"`). True ADL events are likely not distinguishable from fill data alone — they may require the `userFunding` or position history endpoints.

---

## Data Quality Notes

- All decimal values come back as strings, including equity (`"423048081.53"`). Parse carefully — JavaScript floats lose precision on large values. Use `parseFloat()` for display, consider BigInt or decimal libraries for computation.
- `liquidationPx` is `null` when position has no liquidation risk (typically cross-margin with enough collateral).
- `twapId` is `null` for regular orders, numeric for TWAP order fills.
- `startPosition` is the size before the fill, not after. Positive = was long, negative = was short, "0.0" = was flat.
- Timestamps throughout are Unix milliseconds.
- `cumFunding.allTime` is **negative** for longs paying funding (most common scenario in bull markets). Positive = received funding (shorts in bull market or longs in bear market).

---

## Open Questions (Not Yet Answered)

- [ ] `userFunding` endpoint — does it return per-address funding payments directly?
- [ ] `userRateLimit` endpoint — what are the actual hard quota limits?
- [ ] Can `clearinghouseState` return isolated-margin positions differently?
- [ ] What does `marginSummary` vs `crossMarginSummary` differ on when isolated positions exist?
- [ ] WebSocket — what subscription types exist for vaults? Can we get real-time fill updates?
- [ ] `spotClearinghouseState` — do vaults hold spot positions?
- [ ] How to discover vault addresses at scale (community sources, scraping approach)

---

## Schema Decisions

_Based on real API findings — written before any DB code._

**`raw_trades` table:**
Columns map directly to fill fields: `vault_address`, `tid` (unique), `coin`, `px`, `sz`, `side`, `time`, `start_position`, `dir`, `closed_pnl`, `fee`, `fee_token`, `hash`, `oid`, `crossed`, `twap_id`.
Use `tid` as the unique key for deduplication. `time` is the partition key for TimescaleDB hypertable.

**`vault_snapshots` table:**
Sourced from `clearinghouseState.marginSummary.accountValue` polled on a schedule (e.g. every 15 min).
Also from `portfolio.accountValueHistory` for historical backfill.
Columns: `vault_address`, `time`, `account_value`, `total_ntl_pos`, `total_margin_used`, `withdrawable`.

**`vault_positions` table:**
From `clearinghouseState.assetPositions`. One row per (vault, coin, snapshot_time).
Columns: `vault_address`, `coin`, `szi`, `entry_px`, `position_value`, `unrealized_pnl`, `margin_used`, `leverage_type`, `leverage_value`, `liquidation_px`, `cum_funding_all_time`, `snapshot_time`.

**`operators` table:**
Populated from `vaultDetails.leader` during vault ingestion.
Columns: `operator_address`, `role` (user/vault), `vault_addresses[]`.
Must handle: leader can be a vault address (sub-vault case).

**`vaults` table:**
One row per vault, from `vaultDetails`.
Columns: `vault_address`, `name`, `description`, `leader_address`, `apr`, `is_closed`, `allow_deposits`, `always_close_on_withdraw`, `leader_fraction`, `leader_commission`, `relationship_type` (parent/child/null), `last_updated`.

**Vault discovery:**
External registry required. Seeded manually from HL leaderboard, expanded via BFS from follower lists. Store in `vaults` table with `discovered_at` timestamp and `discovery_source`.

---

## Translation Layer (Added 2026-03-15)

### Why this exists

OpenVault is built platform-agnostic. Hyperliquid is the first platform but not the last. Each platform has different field names, different event types, and different data quirks. The metrics engine must never know which platform data came from.

The translation layer is the bridge between Hyperliquid's raw field names and our normalized internal schema. Translation happens ONCE during ingestion, in `packages/hyperliquid/translator.ts`. Everything downstream uses normalized field names.

### Hyperliquid → Normalized field mapping

| HL Raw Field | Normalized Field | Notes |
|---|---|---|
| `tid` | `tradeId` | Unique fill ID |
| `coin` | `asset` | Market/instrument |
| `px` | `price` | Execution price (string → number) |
| `sz` | `size` | Position size (string → number) |
| `side: "B"` | `side: "buy"` | Buy fill |
| `side: "S"` | `side: "sell"` | Sell fill |
| `side: "A"` | `side: "buy"\|"sell" + isAdlEvent: true` | ADL — determine direction from startPosition |
| `time` | `time` | Unix ms → Date |
| `closedPnl` | `realizedPnl` | Per-fill realized PnL (string → number) |
| `fee` | `fee` | Fee paid (string → number) |
| `feeToken` | `feeAsset` | Fee currency |
| `startPosition` | `positionBefore` | Size before fill (string → number) |
| `dir` | `direction` | "Open Long" etc. — keep as-is |
| `hash` | `rawHash` | Transaction hash |
| `twapId` | `isTwap` | null → false, non-null → true |
| `crossed` | `isTaker` | Whether fill crossed the book |
| `oid` | `orderId` | Order ID |

### ADL direction inference

When `side = "A"`, the fill is auto-deleveraged. Direction must be inferred:
- If `startPosition > 0` → was long → ADL closed a long → treat as `side: "sell"`
- If `startPosition < 0` → was short → ADL closed a short → treat as `side: "buy"`
- Set `isAdlEvent: true` regardless

### Normalized fill interface (canonical)

```typescript
interface NormalizedFill {
  tradeId: string
  platform: string          // "hyperliquid"
  vaultAddress: string
  asset: string
  price: number
  size: number
  side: "buy" | "sell"
  time: Date
  realizedPnl: number
  fee: number
  feeAsset: string
  positionBefore: number
  direction: string
  isAdlEvent: boolean
  isTwap: boolean
  isTaker: boolean
  orderId: number
  rawHash: string
}
```

### Future platform translators

When adding a new platform:
1. Create `packages/<platform>/translator.ts`
2. Map that platform's raw fields → `NormalizedFill`
3. Handle that platform's equivalent of ADL (or set `isAdlEvent: false` if no equivalent)
4. Produce identical `NormalizedFill` shape
5. Metrics engine requires zero changes

### Files

- `packages/hyperliquid/translator.ts` — Hyperliquid raw → NormalizedFill
- `packages/hyperliquid/types.ts` — Zod schemas for HL raw API types (keep separate from normalized types)
- `packages/db/normalized-types.ts` — canonical NormalizedFill, NormalizedVaultSnapshot, NormalizedPosition interfaces

