# OpenVault — CLAUDE.md
## Read this first, every session

**Repo:** github.com/openvault-trade/OpenVaultXYZ
**Live at:** openvault.trade
**What we build:** Vault + operator evaluation platform for capital allocators on Hyperliquid

---

## The Four Files and When to Use Them

| File | Purpose | Updated when |
|---|---|---|
| `CLAUDE.md` | Coding context — stack, focus, conventions | End of every Claude Code session |
| `CONTEXT.md` | Business strategy, pricing, moat plan | After Claude chat decisions |
| `FINDINGS.md` | Interesting data observations → X posts | Any time you see something worth sharing |
| `packages/hyperliquid/EXPLORATION.md` | Technical API findings | During API exploration phase |

---

## Current Focus

**Phase: API Exploration**
Do not write production code until this phase is complete.
All findings go in `packages/hyperliquid/EXPLORATION.md`.

**After API exploration → Project scaffolding**
**After scaffolding → Data pipeline**

When you finish a phase, update the Current Focus here before closing the session.

---

## Session Workflow

### Starting a session
1. Read Current Focus above
2. Read Current State at the bottom
3. Know exactly what you're working on before writing a line

### During a session
- API findings → `packages/hyperliquid/EXPLORATION.md`
- Interesting data observations → `FINDINGS.md` (one line is enough)
- Decisions made → working notes at bottom of this file

### Ending a session
Update these two things before closing:
1. **Current State** — check off what's done
2. **Working Notes** — one line per key finding or decision

---

## What OpenVault Is

The infrastructure layer for evaluating on-chain trading talent on Hyperliquid.
We serve capital allocators — anyone deciding where to put money based on someone else's ability to generate returns.

**Two core data objects — both first-class, always linked:**
- **Vault** — the vehicle. `vault.operator_address` always present.
- **Operator** — the talent. `operator.vault_addresses[]` always present.

**We are not an exchange.** Read-only analytics + UX deposit routing. Never custody funds.

**Primary revenue:** subscriptions ($19/mo Pro, $199/mo Institutional, 30-day trial no card)

---

## The Moat Plan (inform every build decision)

We build genuine importance — not just a product. Four things make us hard to replicate:

**1. Methodology credibility**
Publish rating methodology openly. Version it. Invite criticism. Fix it publicly when wrong.
Hold ratings under pressure — never change for relationship reasons, only for data reasons.
When a vault we flagged blows up or an operator we rated highly keeps performing, document it.

**2. Operator network effects**
Operators who rate well become advocates — they share their OpenVault rating to attract deposits.
Operator verification program: verified operators get richer profiles. Not pay-to-play — rating stays independent. Operators participate because it helps them raise capital.
Reach out to top 20 vault operators personally before launch. Build relationships, not just data.

**3. Institutional relationships**
Find early institutional participants in the HL ecosystem (family offices, DAO treasuries, funds).
Serve them with relationships, not just software. Their feedback = product roadmap.
Verified Track Record product (Phase 3): operators pay for certified reports. Allocators require them.
Quarterly ecosystem reports — free, public, referenced by media and analysts.

**4. Community trust**
Weekly risk-adjusted rankings — every week, same format, same methodology, no exceptions.
Never optimize for short-term revenue at the expense of credibility.
Be right in public. When predictions come true, document it clearly.

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

## API Exploration Checklist

Work through in order. Document every answer in `packages/hyperliquid/EXPLORATION.md`.

**Vault discovery**
- [ ] How do you get a list of all active vaults?
- [ ] What does a vault address look like?
- [ ] What fields does a vault object contain?
- [ ] How do you distinguish a vault from a regular account?
- [ ] How is operator address linked to vault address?

**Trade history**
- [ ] What endpoint returns trade history for a vault?
- [ ] What does a single trade/fill object look like? (all fields and types)
- [ ] How do you paginate through full history?
- [ ] How far back does history go?
- [ ] Are closed PnL figures included per trade or must they be calculated?

**Positions and state**
- [ ] How do you get current open positions for a vault?
- [ ] How do you get current equity / NAV?
- [ ] How do you get funding payments received?
- [ ] How do you get leverage utilization?

**Rate limits**
- [ ] What is the actual practical rate limit on the public API?
- [ ] Does it differ between REST and WebSocket?
- [ ] What does a rate limit error response look like?
- [ ] How many vaults can you ingest per minute on the public API?

**Operator linking**
- [ ] Can you query all vaults by a given operator address?
- [ ] Is operator address always present on vault data?
- [ ] Can one address be both a regular trader and an operator?

---

## Data Architecture

```
Hyperliquid Info API + WebSocket
       ↓
  Ingestion worker (scheduled polls + live WS)
       ↓
  TimescaleDB
  ├── raw_trades        (vault_address, time, asset, side, size, price, pnl, fee)
  ├── vault_positions   (current open positions per vault)
  ├── vault_snapshots   (equity snapshots over time)
  ├── funding_payments  (funding rate income per vault)
  └── operators         (operator_address → vault_addresses mapping)
       ↓
  Metrics computation worker (batch, scheduled — never on request)
  ├── vault_metrics     (all computed vault metrics)
  └── operator_metrics  (aggregate across all operator vaults)
       ↓
  Redis cache (pre-computed, TTL-managed)
       ↓
  Next.js API routes → Frontend
```

---

## Metrics to Compute

**Vault — performance:** annualized return (TWR), win rate, profit factor, avg win/loss
**Vault — risk:** Sharpe, Sortino, Calmar, max drawdown, avg drawdown, drawdown duration + recovery, leverage over time
**Vault — alpha/beta:** beta to BTC, beta to ETH, funding income % of total return
**Vault — composite:** risk score (1-10), peer percentile rank within strategy type
**Vault — regime:** performance tagged by market period (trending bull / ranging / risk-off / high vol)

**Operator:** total AUM, capital-weighted aggregate return, consistency score, strategy diversity, drawdown behavior score (cut vs hold vs add), track record depth, peer ranking, capital raised over time

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
│   │   ├── EXPLORATION.md            ← API findings (written before any .ts)
│   │   ├── client.ts                 ← HL API client
│   │   ├── types.ts                  ← Zod schemas + TypeScript types
│   │   └── ingestion.ts              ← data ingestion logic
│   ├── metrics/                      ← pure functions, fully testable
│   ├── classifier/                   ← strategy classification
│   └── db/                           ← TimescaleDB schema, migrations, queries
└── infra/                            ← deployment config
```

---

## Coding Conventions

- TypeScript strict mode everywhere
- Zod for ALL external data validation — HL API schemas change without warning
- Metric computation = pure functions only, no side effects, fully testable
- Metrics always pre-computed from cache — never computed at request time
- Never store or log private keys
- Paginate all historical fetches — never pull all history in one request
- Vault and operator always linked — enforce at schema level

---

## Current State

- [ ] GitHub repo: OpenVaultXYZ ✓
- [ ] Domain: openvault.trade ✓
- [ ] Email: hello@openvault.trade ✓
- [ ] Wyoming LLC: in progress
- [ ] Twitter/X handle: pending
- [ ] CLAUDE.md + CONTEXT.md + FINDINGS.md in repo: pending
- [ ] API exploration: not started
- [ ] EXPLORATION.md: not started
- [ ] Project scaffolding: not started
- [ ] Data pipeline: not started
- [ ] Metrics engine: not started
- [ ] UI: not started
- [ ] Stripe + auth: not started

---

## Working Notes

_One line per key finding or decision. Add date. Update every session._

**March 2026**
- Stack: Next.js + Node.js + TimescaleDB + Redis + BullMQ
- Builder code confirmed non-applicable to vault deposits — subscriptions are primary revenue
- Pricing: $19/mo Pro, $199/mo Institutional, 30-day trial no card
- Moat strategy: methodology transparency + operator relationships + institutional trust + community consistency
- Build order: API exploration → scaffolding → data pipeline → metrics → UI → subscriptions → deposit routing
- Deposit routing is Phase 2 UX feature only — do not build until analytics validated
- Phase 3: verified track record product + direct trading interface (builder code revenue) + OMS
