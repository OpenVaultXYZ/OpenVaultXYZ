# OpenVault — CLAUDE.md
## Read this first, every session

**Repo:** github.com/openvault-trade/OpenVaultXYZ
**Live at:** openvault.trade
**What we build:** Independent vault analytics and ratings platform for Hyperliquid — the research layer that sits between capital allocators and the vaults they deposit into.

---

## The Four Files and When to Use Them

| File | Purpose | Updated when |
|---|---|---|
| `CLAUDE.md` | Coding context — stack, focus, conventions | End of every Claude Code session |
| `CONTEXT.md` | Business strategy, pricing, phase roadmap | After Claude chat decisions |
| `FINDINGS.md` | Interesting data observations → X posts | Any time you see something worth sharing |
| `packages/hyperliquid/EXPLORATION.md` | Technical API findings — Hyperliquid specific | During API exploration, when new findings emerge |

---

## Current Focus

**Phase: UI — MVP Complete**

UI complete as of 2026-03-16:
- `apps/web/` — Next.js 15 App Router, Tailwind CSS dark theme (TradingView-inspired)
- Leaderboard homepage — 435 vaults, sortable/filterable table, client-side sort/filter
- Vault detail pages — NAV chart (Recharts), metrics grid (Performance/Risk/Alpha/Beta/Activity sections), strategy badge, risk score meter
- Search — debounced `useTransition` router.push, server-rendered results
- `pnpm build` passes clean with no TypeScript errors

**Next task: deploy to production (Vercel frontend + Railway/Render for DB) + set up daily cron for metrics refresh.**

**After deploy → Stripe + auth (subscriptions).**

When you finish a phase, update Current Focus and Current State before closing.

---

## Session Workflow

### Starting a session
1. Read Current Focus above
2. Read Current State at the bottom
3. Know exactly what you're working on before writing a line

### During a session
- Platform-specific API findings → `packages/hyperliquid/EXPLORATION.md`
- Interesting data observations → `FINDINGS.md` (one line is enough, plain language)
- Decisions made → working notes at bottom of this file

### Ending a session
1. Update **Current State** — check off what's done
2. Update **Working Notes** — one line per key finding or decision

---

## What OpenVault Is

OpenVault is independent vault analytics for Hyperliquid. We help capital allocators — from retail depositors to institutional funds — evaluate vaults before committing capital.

**The core product:** vault pages with risk-adjusted metrics, strategy fingerprinting, regime analysis, and peer benchmarking. The leaderboard shows a line chart and a return number. OpenVault shows everything that actually matters for a capital allocation decision.

**Operator profiles are a supporting feature, not the core product.** Allocators invest in vaults. Operator context (track record across multiple vaults, consistency, drawdown behavior) informs that decision — it's valuable due diligence context, not the primary unit of analysis.

**We are not an exchange.** Read-only analytics + UX deposit routing. Never custody funds.

**Primary revenue:** subscriptions ($19/mo Pro, $199/mo Institutional, 30-day trial no card)
**Full business context in CONTEXT.md**

---

## Multi-Platform Architecture (Critical Design Constraint)

OpenVault will eventually support multiple platforms beyond Hyperliquid: Lighter, dYdX v4, GMX, and others. Each platform has different API field names, different platform-specific events, and different data quirks.

**The rule:** the metrics engine must never know which platform data came from.

**How this works:**

```
Platform-specific ingestion (translator)     Normalized internal schema     Metrics engine
─────────────────────────────────────────    ──────────────────────────    ──────────────
Hyperliquid:                                                                
  side = "B"/"S"/"A"          ──────────►   NormalizedFill {               
  px, sz, closedPnl, tid                      price, size, realizedPnl,    ──────────►  
  fee, hash, coin, time                       fee, tradeId, asset, time,    Sharpe()
                                              isAdlEvent: boolean,          Drawdown()
Lighter (future):                             platform: "hyperliquid"       WinRate()
  [different field names]     ──────────►     ...                           etc.
                                            }
dYdX v4 (future):
  [different field names]     ──────────►
```

**Concrete examples of what translation means:**
- Hyperliquid `side = "A"` → `isAdlEvent: true` in our schema
- Hyperliquid `px` → `price` in our schema
- Hyperliquid `sz` → `size` in our schema
- Hyperliquid `closedPnl` → `realizedPnl` in our schema
- Hyperliquid `tid` → `tradeId` in our schema

The translation happens ONCE in the Hyperliquid ingestion package. Everything downstream uses normalized field names. A future Lighter translator produces the same NormalizedFill shape — the metrics engine runs unchanged.

**The metrics package must never import from the hyperliquid package.**

---

## The Moat Plan (inform every build decision)

Four things make OpenVault hard to replicate:

**1. Methodology credibility**
Publish rating methodology openly. Version it. Invite criticism. Fix it publicly when wrong.
Hold ratings under pressure — never change for relationship reasons, only for data reasons.
When a vault we flagged blows up, document it publicly. This is how trust compounds.

**2. Operator network effects**
Operators who rate well share their OpenVault rating to attract deposits — they become advocates.
Operator verification program (Phase 2): verified operators get richer profiles. Not pay-to-play.
Reach out to top 20 vault operators personally before launch.

**3. Institutional relationships**
Find early institutional participants: family offices, DAO treasuries, crypto funds with HL exposure.
Serve them with relationships, not just software. Their feedback = product roadmap.
Quarterly ecosystem reports — free, public, referenced by media and analysts.

**4. Community trust**
Weekly risk-adjusted rankings — every week, same format, same methodology, no exceptions.
Be right in public. When predictions come true, document it clearly.
Never optimize for short-term revenue at the expense of credibility.

---

## Tech Stack

**Backend:** TypeScript (Node.js), TimescaleDB, Redis (pre-computed cache), BullMQ (job queue)
**Frontend:** Next.js App Router, Tailwind CSS, Recharts or TradingView Lightweight Charts
**Wallet (Phase 2 only):** wagmi + viem
**Hosting:** Vercel (frontend) + Railway or Render (backend + DB)
**Payments:** Stripe

**Hyperliquid endpoints:**
- REST: `https://api.hyperliquid.xyz/info`
- WebSocket: `wss://api.hyperliquid.xyz/ws`
- Testnet: `https://api.hyperliquid-testnet.xyz/info`
- Docs: `https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api`

**RPC:** Private provider from day one (Chainstack or HypeRPC ~$50-100/mo)
Never use public RPC in production — rate limited ~100 req/min

---

## Normalized Internal Schema (Translation Layer Output)

These are our field names. Platform translators produce these. Metrics engine consumes these.

```typescript
interface NormalizedFill {
  // Identity
  tradeId: string           // unique fill ID (HL: tid)
  platform: string          // "hyperliquid" | "lighter" | "dydx" etc.
  vaultAddress: string      // vault this fill belongs to

  // Trade data
  asset: string             // coin/market (HL: coin)
  price: number             // execution price (HL: px)
  size: number              // position size (HL: sz)
  side: "buy" | "sell"      // direction (HL: "B"/"S" → normalized, "A" → isAdlEvent)
  time: Date                // execution timestamp (HL: time ms → Date)

  // PnL
  realizedPnl: number       // closed PnL for this fill (HL: closedPnl)
  fee: number               // fee paid (HL: fee)
  feeAsset: string          // currency of fee (HL: feeToken)

  // Position context
  positionBefore: number    // size before fill (HL: startPosition)
  direction: string         // "Open Long" | "Close Short" etc. (HL: dir)

  // Risk flags
  isAdlEvent: boolean       // auto-deleveraged fill (HL: side === "A")
  isTwap: boolean           // part of a TWAP order (HL: twapId !== null)

  // Raw reference
  rawHash: string           // transaction hash (HL: hash)
}

interface NormalizedVaultSnapshot {
  vaultAddress: string
  platform: string
  time: Date
  nav: number               // net asset value / account value
  totalNotional: number     // total position size
  totalMarginUsed: number
  withdrawable: number
}

interface NormalizedPosition {
  vaultAddress: string
  platform: string
  asset: string
  size: number              // positive = long, negative = short
  entryPrice: number
  markPrice: number
  unrealizedPnl: number
  marginUsed: number
  leverage: number
  liquidationPrice: number | null
  isIsolated: boolean
  snapshotTime: Date
}
```

---

## Data Architecture

```
Platform-specific ingestion packages
  packages/hyperliquid/    ← Hyperliquid API client + translator
  packages/lighter/        ← (future)
  packages/dydx/           ← (future)
       ↓ NormalizedFill, NormalizedVaultSnapshot, NormalizedPosition
  packages/db/             ← writes normalized data to TimescaleDB
       ↓
  TimescaleDB
  ├── normalized_fills      (NormalizedFill rows)
  ├── vault_snapshots       (NormalizedVaultSnapshot rows)
  ├── vault_positions       (NormalizedPosition rows)
  ├── vaults                (vault registry — one row per vault)
  └── operators             (operator_address → vault_addresses mapping)
       ↓
  packages/metrics/        ← pure functions, platform-agnostic
  ├── performance.ts        (TWR, win rate, profit factor)
  ├── risk.ts               (Sharpe, Sortino, Calmar, drawdown)
  ├── beta.ts               (beta to BTC/ETH, alpha/beta decomp)
  ├── regime.ts             (regime tagging and performance by period)
  ├── classifier.ts         (strategy type classification)
  └── score.ts              (composite risk score 1-10)
       ↓
  BullMQ worker             ← recomputes metrics on schedule
       ↓
  Redis                     ← pre-computed results cache
       ↓
  Next.js API routes → Frontend
```

---

## Metrics to Compute

**Performance:** annualized return (TWR), win rate, profit factor, avg win/loss
**Risk:** Sharpe, Sortino, Calmar, max drawdown, avg drawdown, drawdown duration + recovery, leverage over time
**Alpha/Beta:** beta to BTC, beta to ETH, funding income % of total return, ADL event frequency
**Composite:** risk score (1-10), peer percentile rank within strategy type
**Regime:** performance by market period (trending bull / ranging / risk-off / high vol)

**Operator-level (from vault aggregation):**
Total AUM, capital-weighted aggregate return, consistency score, drawdown behavior score, track record depth, peer ranking

---

## Strategy Classification (Rule-Based v1)

| Type | Signals |
|---|---|
| Momentum / trend | Long hold, size increases with trend, low frequency |
| Mean reversion | Short hold, fades moves, high frequency |
| Funding rate arb | Consistent funding income %, hedged, low directional exposure |
| HF market making | Very high trade count, very short holds |
| Directional macro | Low frequency, large concentrated positions, long holds |
| Leveraged beta | BTC/ETH beta >0.8, high leverage, tracks market |

---

## Project Structure

```
OpenVaultXYZ/
├── CLAUDE.md                         ← coding context (this file)
├── CONTEXT.md                        ← business strategy
├── FINDINGS.md                       ← interesting observations → X posts
├── apps/
│   ├── web/                          ← Next.js frontend
│   └── api/                          ← Node.js backend
├── packages/
│   ├── hyperliquid/
│   │   ├── EXPLORATION.md            ← HL API findings
│   │   ├── client.ts                 ← HL API client (raw API calls)
│   │   ├── types.ts                  ← Zod schemas for HL raw API types
│   │   ├── translator.ts             ← HL raw → NormalizedFill etc.
│   │   └── ingestion.ts              ← orchestrates client + translator + db writes
│   ├── metrics/                      ← pure functions, platform-agnostic
│   ├── classifier/                   ← strategy classification
│   └── db/                           ← TimescaleDB schema, migrations, queries
└── infra/                            ← deployment config
```

---

## Coding Conventions

- TypeScript strict mode everywhere
- Zod for ALL external data validation — HL API schemas change without warning
- **metrics package never imports from hyperliquid package** — enforce strictly
- All metric computation = pure functions, no side effects, fully testable
- Metrics always pre-computed and cached — never computed at request time
- Never store or log private keys
- Paginate all historical fetches — never pull all history in one request
- Platform field names never appear outside their package (e.g. `px`, `sz`, `side = "A"` stay inside `packages/hyperliquid/`)

---

## API Exploration Checklist (Hyperliquid — complete)

All items complete as of 2026-03-14. See `packages/hyperliquid/EXPLORATION.md` for full findings.

Key findings summary:
- No vault discovery endpoint — must maintain external registry ← significant constraint
- `vaultDetails.leader` = operator address (but can be another vault for sub-vaults)
- `closedPnl` per fill — accurate, but NOT a running total. Sum across fills.
- `side = "A"` = ADL event — critical risk signal, not visible on leaderboard
- All numeric values returned as strings — parse carefully
- Rate limit ~5 req/sec sequential (~100 vaults/min at 3 req/vault)
- `relationship.type` = "normal" | "parent" | "child" (previously could be null)

Open items: WebSocket subscriptions, `userFunding` endpoint, `userRateLimit` hard limits

---

## Current State

- [x] GitHub repo: OpenVaultXYZ (github.com/openvault-trade/OpenVaultXYZ)
- [x] Domain: openvault.trade
- [x] Email: hello@openvault.trade
- [ ] Wyoming LLC: filing in progress (Northwest Registered Agent, ~$143 total)
- [ ] Twitter/X handle: pending
- [x] API exploration: complete (2026-03-14) — minor open items remain
- [x] EXPLORATION.md: complete
- [x] Project scaffolding: complete (2026-03-14)
- [x] Data pipeline: complete (2026-03-15) — 519 vaults, 3,140,111 fills in TimescaleDB
- [x] Translation layer: complete (2026-03-15) — normalized_fills table, translator.ts, 9 passing tests
- [x] BFS vault discovery: complete (2026-03-16) — 33 seeds → 519 vaults via follower BFS
- [x] Metrics engine: complete (2026-03-16) — 84 passing tests, 435 active vaults computed, vault_metrics table populated
- [x] market_prices: complete (2026-03-16) — 26,684 hourly BTC+ETH prices via CryptoCompare, 275/435 vaults have meaningful beta (±10 cap)
- [x] UI: complete (2026-03-16) — leaderboard, vault pages, search. pnpm build clean.
- [ ] Stripe + auth: not started

---

## Working Notes

_One line per key finding or decision. Add date. Update every session._

**March 2026**
- Stack: Next.js + Node.js + TimescaleDB + Redis + BullMQ
- Builder code non-applicable to vault deposits — subscriptions are primary revenue
- Pricing: $19/mo Pro, $199/mo Institutional, 30-day trial no card
- Moat: methodology transparency + operator relationships + institutional trust + community consistency
- Build order: translation layer → metrics → UI → subscriptions → deposit routing → verified records → execution interface
- 2026-03-14: API exploration complete. No vault discovery endpoint — must maintain registry. ADL fills (`side = "A"`) are critical risk signal. All numerics as strings. Rate limit ~5 req/sec.
- 2026-03-14: Scaffolding complete. pnpm workspace, 3 packages compile: @openvault/hyperliquid, @openvault/db, @openvault/metrics.
- 2026-03-15: First ingestion complete. 33 vaults, 563,925 fills. Growi HF highest frequency (71k fills). Liquidator vault deprecated (last fill Aug 2023). Citadel oldest track record (Dec 2023). HLP returns 0 fills — protocol vault data not exposed.
- 2026-03-15: Translation layer complete. normalized_fills table (replaces raw_trades). translator.ts tested. Key discovery: HL side="A" = ask-side fill (maker sell), NOT ADL. B/A/S split ratio is a strategy classification signal — market makers have ~50% A fills, zero S fills.
- 2026-03-15: Architecture decision — build NormalizedFill translation layer before metrics engine. Metrics package must never import from hyperliquid package. Platform-agnostic metrics engine enables future expansion to Lighter, dYdX v4, GMX without rewriting metrics.
- 2026-03-15: Business reframe — vault is the primary product unit, operator is supporting due diligence context. Allocators invest in vaults. Phase order revised: analytics → deposit routing → verified track records → execution interface (builder code revenue) → OMS.
- 2026-03-16: BFS discovery complete. 33 seeds → 519 vaults. discovery_source bug fixed (ingestVaultMeta now accepts discoverySource param, defaults "manual"). 33 manual + 486 bfs. discovery.ts callers pass correct source.
- 2026-03-16: Metrics engine complete. 84 tests passing across 5 modules (returns, risk, beta, classification, score). 435 active vaults computed. Key observation: large portion of discovered vaults have -100% returns (blown up). HLP Strategy A risk=1.0 (near-perfect). Beta null for all until market_prices populated.
- 2026-03-16: NAV sanitization in compute-metrics.mjs strips pre-trading initialization artifacts and >5x deposit spikes — essential for accurate TWR. HLP Strategy A shows nav=92→2 after sanitization (initialization noise removed).
- 2026-03-16: Next focus — UI. Need market_prices table populated for beta before or during UI work.
- 2026-03-16: UI complete. Next.js 15 App Router, Tailwind dark theme, leaderboard/vault/search pages. Three type errors fixed: SortKey widening in LeaderboardTable, exactOptionalPropertyTypes in MetricsGrid, useSearchParams Suspense boundary in layout. All pages force-dynamic (no DB at build time). pnpm build passes clean.
- 2026-03-16: market_prices populated. 26,684 hourly BTC+ETH prices from CryptoCompare (2023-03-01→2026-03-17). Beta capped at ±10 in compute-metrics.mjs — extreme values from blown-up vaults are null. 275/435 vaults have meaningful btc/eth beta. Median BTC beta = 0.01 (most vaults are market-neutral). fetch-market-prices.mjs script added to scripts/.
- 2026-03-16: Metrics correctness fixes. (1) Removed firstFillTime filter from sanitizeNavSeries — it was silently discarding months of NAV history for BFS-discovered vaults (HyperGrowth: 11 → 41 nav points used, Sharpe now 1.84 instead of null, max DD now 53.9% instead of 2.7%). (2) Fixed Sharpe/Sortino annualization: uses periodsPerYear() from actual avg snapshot gap instead of hardcoded sqrt(365). (3) Fixed Calmar to use TWR annualizedReturn() instead of simple start/end ratio. (4) UI: dynamic "Total Return" vs "Annualized Return" label, data window banner, "Needs X more weeks" for missing ratios, tooltip definitions on all metrics, AUM disclosure note on chart. 84 tests still passing, pnpm build clean.
