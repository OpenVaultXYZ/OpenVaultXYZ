# OpenVault — Business Context & Strategy

**Company:** OpenVault
**Domain:** openvault.trade (primary) — openvault.xyz ($3k), openvault.io ($6k) deferred until revenue established
**Stage:** Pre-build — entity formation in progress (March 2026)

---

## What OpenVault Is

OpenVault is the infrastructure layer for evaluating on-chain trading talent — built for anyone whose job is deciding where to allocate capital based on someone else's ability to generate returns.

The vault ecosystem on Hyperliquid has grown faster than the information infrastructure around it. Hundreds of vault operators are managing hundreds of millions of dollars in depositor capital. The tools to evaluate those operators — the due diligence layer — do not exist. OpenVault builds that layer.

**We are not a trading platform. We are not an exchange.** We are the research and evaluation infrastructure that sits between capital allocators and the operators they allocate to.

---

## The Core Insight

Every vault depositor is making the same decision a professional fund allocator makes: *should I give this person my money to trade?*

Most retail depositors don't think of it that way. They look at a raw return number on a leaderboard and make a gut decision. OpenVault reframes the decision correctly — as a talent evaluation and capital allocation problem — and gives them the tools to make it well.

This reframe has a compounding effect: as retail depositors learn to think like allocators, they demand allocator-grade tools. As the product matures, it naturally evolves to serve actual professional allocators. The retail and institutional customer bases converge around the same product because they're solving the same problem at different scales.

---

## The Vault Operator Is the Asset

The most important product decision in OpenVault is this: **we analyze operators, not just vaults.**

A vault is a vehicle. The operator is the talent. An operator might run multiple vaults across different strategies. Their aggregate track record, their consistency, their behavior under stress, their communication with depositors — that is what a capital allocator actually needs to evaluate.

Every trade on Hyperliquid is on-chain and immutable. An operator's full trading history is a verifiable, unfalsifiable professional credential. OpenVault is the platform that surfaces, standardizes, and presents that credential in the language institutional capital allocation already speaks.

This is not just a feature difference from Hyperliquid's leaderboard — it's a different product philosophy entirely.

---

## The Market Context

### What Hyperliquid Is

Hyperliquid is a custom Layer-1 blockchain built for high-performance decentralized perpetual futures trading:
- Processes up to 200,000 transactions per second via HyperBFT consensus
- Fully on-chain order book (HyperCore) — every trade, position, liquidation is transparent and verifiable
- Zero gas fees on the trading layer
- $2.9 trillion in trading volume in 2025
- 500,000+ unique wallets, $4.15B TVL
- $844M in annual revenue in 2025
- No KYC — permissionless, self-custody

### Why the US Can't Access It (Yet)

Hyperliquid is geo-blocked for US users — it offers leveraged perpetual derivatives without CFTC registration. As of March 2026 this is actively changing:
- CFTC Chairman Selig announced perps frameworks coming "within weeks" (March 3, 2026)
- SEC and CFTC launched joint "Project Crypto" — pathways to onshore DeFi perp products
- Innovation exemptions and sandbox frameworks in draft
- New DCM registration category for retail-facing leveraged crypto platforms previewed

OpenVault as an analytics and deposit routing layer has no meaningful legal ambiguity — we are not the exchange. We serve a global market today and a US market as regulation opens.

### The Vault Ecosystem

Anyone can deploy a vault on Hyperliquid:
- Executes trading strategies on behalf of depositors
- Earns 10% performance fees if profitable
- Publicly visible on Hyperliquid's leaderboard
- Shares the same liquidation engine as normal accounts

The leaderboard shows: raw P&L, all-time return, total depositors, operator's own stake, and a basic equity curve. That's the entire disclosure. A depositor is handed a line chart going up and to the right and expected to make a capital allocation decision from it.

---

## The Problem Stack

### Problem 1: No operator-level evaluation exists

An operator might run multiple vaults. Their aggregate track record, consistency across strategies, behavior during drawdowns, and responsiveness to market regime changes — none of this is visible or aggregated anywhere. Depositors evaluate vaults in isolation when they should be evaluating the talent behind them.

### Problem 2: No risk-adjusted performance metrics

The leaderboard shows raw returns. It shows nothing about:
- How much risk was taken to generate those returns (Sharpe, Sortino, Calmar)
- Whether returns are genuine alpha or just leveraged market beta
- How the strategy performs in different market regimes
- What the drawdown profile looks like in detail
- How close the vault is to liquidation right now

### Problem 3: No peer benchmarking

Allocators don't think in absolute terms — they think in relative terms. "Is this a good momentum trader?" requires knowing where this operator ranks among all momentum traders on the platform. That comparison infrastructure doesn't exist.

### Problem 4: Track records are not legible to institutional capital

On-chain trade data is public but raw. Institutional allocators — family offices, funds, employers of traders — need track records in a standardized, auditable, presentation-ready format. Nobody has translated Hyperliquid on-chain data into the language institutional capital allocation already speaks.

### Problem 5: No integrated action layer

Even if a user completes their own research, they navigate away to Hyperliquid to deposit. The research-to-action loop is broken. No integrated flow exists from "I've evaluated this operator" to "I'm deploying capital."

---

## The Customer Stack

### Today — Retail Allocators
Vault depositors putting in $1k–$100k making personal capital allocation decisions. They need the tools to evaluate operators properly. OpenVault teaches them to think like allocators, which builds loyalty and willingness to pay. Free tier builds habit. Pro tier serves serious retail allocators.

### Near Term — Emerging Professional Allocators
Crypto-native family offices, DAO treasuries, group investment structures where one person manages pooled capital. Already doing informal due diligence. OpenVault formalizes and systematizes their process. High willingness to pay for institutional-grade tools.

### Medium Term — Fund-of-Funds on Hyperliquid
As on-chain perps become institutionally legitimate, fund-of-funds structures will emerge — pools of capital allocated across multiple vault operators. OpenVault is the research database and screening infrastructure they run on. Annual contracts. Significant ACV.

### Long Term — Employers of Traders
Prop firms, trading desks, and funds evaluating or recruiting traders will use OpenVault track records as verifiable professional credentials. A vault operator's Hyperliquid history becomes their resume — immutable, verifiable, impossible to falsify. OpenVault certifies and presents it.

---

## The Product

### Core: Vault Analytics + Operator Profiles

**Vault pages** — deep analytics on individual vaults:
- Full risk-adjusted metrics: Sharpe, Sortino, Calmar ratios
- Drawdown analysis: max, average, duration, recovery time
- Regime performance: how did this vault perform in trending / ranging / risk-off / high-volatility periods
- Strategy fingerprinting: what is this vault actually doing (momentum, mean reversion, funding arb, HF market making, leveraged beta)
- Alpha/beta decomposition: how much return is skill vs. market exposure
- Funding rate income as % of total return
- Leverage utilization over time
- Liquidation proximity indicator
- Peer benchmarking: where does this vault rank among comparable strategy types

**Operator pages** — aggregate evaluation of the person behind the vaults:
- All vaults managed, current and historical
- Aggregate AUM across all vaults
- Aggregate performance across all vaults (normalized)
- Consistency score: how stable is performance across different vaults and time periods
- Drawdown behavior analysis: what does this operator do when strategy stops working — cut, hold, or double down
- Track record length and depth
- Operator ranking within strategy peer group
- Capital raised over time (indicator of community trust)

**Manager screening (Institutional tier)**
- Filter by: strategy type, minimum track record, max drawdown threshold, AUM range, regime performance, consistency score
- Shortlist and compare operators side by side
- Export track records in standardized format
- API access for programmatic screening

### Layer 2: Integrated Deposit Interface (Phase 2)

Research-to-action in one flow. User evaluates an operator, clicks deposit, connects wallet, done. No navigating away to Hyperliquid. The value is conversion and retention — keeping the user inside OpenVault at the moment of decision.

Note: builder code fees do NOT apply to vault deposit transactions (confirmed March 2026 — see working notes). Deposit routing is a UX feature, not a revenue feature.

### Layer 3: Verified Track Record Product (Phase 3)

Operators pay to have their track record certified by OpenVault and formatted for institutional presentation. Produces a standardized, shareable report that capital allocators recognize. Revenue from operators who want to raise capital. Trust from allocators who rely on OpenVault's independent certification.

This creates a two-sided marketplace dynamic: operators want to be on OpenVault because it helps them raise capital. Allocators want to use OpenVault because the track records are independently verified.

---

## Revenue Model

### Primary: Subscriptions

#### Pricing Philosophy
Build the moat through ubiquity first, margin second. TradingView — the closest analog — starts at $12.95/month serving 100 million users across every asset class on earth. OpenVault serves a niche ecosystem of ~500k users. Pricing needs to make subscription a near-impulse decision for anyone with real capital in a vault, while the institutional tier carries the revenue load.

No planned price increases. Grandfathered pricing for all existing subscribers forever — this builds loyalty, word of mouth, and the reputation that IS the moat in a community-driven ecosystem. A subscriber who joined at $19/month and never sees a price increase becomes an advocate. Advocates are worth more than margin.

#### Pricing
- **Pro: $19/month** (or $15/month billed annually)
- **Institutional: $199/month** (or $149/month billed annually = $1,788/year)
- All existing subscribers grandfathered at signup price permanently
- No card required for 30-day trial

#### Profitability math
- Monthly infrastructure: ~$76 (RPC $50 + Workspace $6 + hosting $20)
- Break even: 4 Pro subscribers
- Covers meaningful founder time: ~100 Pro subscribers = $1,900/month
- Serious business: ~500 Pro subscribers = $9,500/month + any institutional
- 10 institutional customers = $1,990/month — covers all infrastructure and salary alone
- One institutional customer = equivalent of 10.5 Pro subscribers

#### Trial Mechanic — 30-Day Full Access
30-day full Pro trial, no credit card required. Matches TradingView's trial length. Long enough for users to experience multiple market cycles, see alerts fire, watch a vault risk score change, and build genuine dependency before the cutoff.

On day 31, these go dark: regime analysis, alerts, portfolio view, operator profile depth, strategy fingerprint detail. The habit is deeper than a 14-day trial — they feel the loss more acutely and know exactly what they're missing.

Free tier remains permanently useful so users keep returning — every return visit is a conversion opportunity.

#### Tier Breakdown

**Free Forever**
Always available, no account required for browsing:
- Full vault leaderboard with sorting
- Sharpe ratio + max drawdown for every vault
- Risk score (1-10)
- Strategy type label
- 30-day return and basic equity curve
- Top 3 vaults by risk-adjusted return
- Basic operator profile (name, vault count, total AUM)

Already dramatically better than Hyperliquid's native leaderboard. Shareable — people screenshot and post on CT. Builds the habit of coming to OpenVault first.

**30-Day Free Trial (full Pro, no card)**
Full Pro access for 30 days. Establishes deep daily usage habit before cutoff.

**Pro — $19/month ($15/month annual)**
Positioned as: "make capital allocation decisions like a professional"
- Full regime analysis
- Complete drawdown statistics (duration, recovery, average)
- Strategy fingerprint with supporting evidence
- BTC/ETH beta decomposition
- Funding rate income breakdown
- Full equity curve with drawdown overlay
- Liquidation proximity indicator
- Full operator profiles with aggregate track records
- Drawdown behavior analysis
- Peer benchmarking (percentile ranking within strategy type)
- Vault and operator comparison side by side
- Portfolio view across all positions
- In-app + email alerts
- Unlimited saved watchlists
- Downloadable PDF reports

**Institutional — $199/month ($149/month annual)**
Positioned as: "allocator infrastructure for professional capital deployment"
- Everything in Pro
- Manager screening tool (filter, shortlist, compare operators)
- Track record export in standardized format
- API access for programmatic screening
- Bulk operator analysis
- Contagion and cascade risk modeling
- Custom reporting
- White-label options

### Secondary: Verified Track Record Product (Phase 3)
Operators pay for certified, formatted track record reports to share with capital allocators. Pricing TBD — likely $200-500 per report or subscription model for active operators. Creates two-sided marketplace dynamic: operators on OpenVault because it helps raise capital, allocators on OpenVault because track records are independently verified.

### Future: Builder Code Revenue (Phase 3+)
If direct trading interface added, order fills generate builder code fees (up to 0.1% per perps fill). Not applicable to vault deposits — confirmed March 2026. Significant upside if trading interface is ever built.

---

## Technical Architecture

### Data Sources
- **Hyperliquid Info API (REST):** vault state, trade history, positions, funding rates, liquidations — all public, no auth required
- **Hyperliquid WebSocket:** real-time trade streams, position changes, order book updates
- **HyperEVM RPC:** EVM-compatible smart contract layer

### Infrastructure
- Public RPC rate-limited at ~100 req/min — use private RPC from day one
- Private RPC providers: Chainstack (~$50-100/month), HypeRPC — both support Hyperliquid as of 2026
- TimescaleDB for time-series metric storage
- Redis for pre-computed metric cache — never compute on request
- BullMQ for batch metric computation jobs

### Data Flow
```
Hyperliquid Info API
       ↓
  Ingestion worker (polls + websocket)
       ↓
  TimescaleDB (raw trade history, positions, funding rates)
       ↓
  Metrics computation worker (batch, scheduled)
       ↓
  Redis (pre-computed vault + operator metrics)
       ↓
  Next.js API routes
       ↓
  Frontend UI
```

---

## Competitive Landscape

**What exists today:**
- Hyperliquid leaderboard — raw returns, no risk metrics, no operator profiles
- DefiLlama, Dune dashboards — generic, not vault/operator specific, no integrated action
- Community Dune dashboards — fragmented, no standardization, no deposit flow
- Chainstack, HypeRPC — RPC infrastructure, not analytics

**What doesn't exist:**
- Operator-level track record aggregation and evaluation
- Risk-adjusted metrics with peer benchmarking
- Regime-aware performance attribution
- Drawdown behavior analysis (what does the operator DO during drawdowns)
- Institutional-grade manager screening tools for on-chain operators
- Verified track record product for operator fundraising
- Integrated research-to-deposit flow

This is a genuine gap across every customer segment from retail to institutional.

---

## Phase Roadmap

### Phase 1 — Analytics MVP (6-10 weeks to first revenue)
- Data pipeline: ingest all active vault trade history
- Vault-level metrics: Sharpe, drawdown, win rate, BTC beta, regime performance
- Basic operator profiles: aggregate across vaults, consistency score
- Strategy classification: rule-based v1
- Web UI: vault rankings, vault detail pages, basic operator pages, risk scores
- Free tier + Pro tier with Stripe subscription
- 14-day trial, no card required

### Phase 2 — Operator Depth + Deposit Interface (3-4 months post-launch)
- Full operator profiles: drawdown behavior analysis, peer benchmarking, track record presentation
- Institutional tier: manager screening, track record export, API access
- Deposit routing interface: wallet connection, research-to-deposit flow
- Portfolio dashboard: track positions across vaults
- Alerts: drawdown, risk score changes, liquidation proximity

### Phase 3 — Verified Track Records + Trading Interface (12-18 months)
- Verified Track Record product: operator-paid certification for institutional fundraising
- Contagion and cascade risk modeling
- Compliance reporting hooks (US market opening)
- Evaluate direct trading interface for builder code revenue
- OMS foundation: execution algos, multi-account risk engine

---

## Key Risks

1. **Hyperliquid platform dependency** — >80% DEX perps market share, strong moat. Mitigated but real.
2. **Vault operator pushback** — operators who rate poorly may be adversarial. Independence is the product's core value. Prepare for it.
3. **API rate limits** — need private RPC from day one. Budget $50-100/month.
4. **Cold start on operator profiles** — operator pages are thin until we have enough data. Launch with vault pages, build operator depth in Phase 2.
5. **Builder code confirmed non-applicable to deposits** — primary revenue is subscriptions. Subscription model is clean and sufficient.
6. **Portfolio margin complexity** — Hyperliquid portfolio margin in testnet as of late 2025. Risk engine needs updating when it goes mainnet.
7. **US regulatory position** — analytics and deposit routing layer has minimal legal exposure. Monitor as rules formalize.

---

## Working Notes

_Dated entries capturing key decisions as the project evolves._

**March 2026**
- Company name: OpenVault
- Domain: openvault.trade (~$20/year). Premium domains deferred — revisit openvault.xyz when ~160 Pro subscribers covers the $3k cost in month one at $19/month.
- Entity: Wyoming LLC — in progress via Northwest Registered Agent (~$225 total)
- Infrastructure: hello@openvault.trade on Cloudflare routing → Gmail. GitHub org: openvault-trade (private membership).
- **Core reframe:** Product is manager/operator evaluation platform, not just vault analytics. The operator is the asset. Customers are capital allocators at every scale — retail today, institutional tomorrow.
- **Builder code RESOLVED:** Fees apply to order fills only, not vault deposits. Deposit routing is UX/conversion, not revenue. Confirmed by official Hyperliquid builder code documentation.
- **Primary revenue model confirmed:** Subscriptions. Builder code is Phase 3+ if direct trading interface is added.
- **Pricing:** $19/month Pro ($15/month annual). 30-day trial, no card required. Institutional $199/month ($149/month annual = $1,788/year). No planned price increases — build moat through volume and ubiquity. Grandfathered pricing for all existing subscribers forever. Institutional tier does heavy revenue lifting: 10 customers alone = $1,990/month.
- **Trial cutoff design:** Regime analysis, alerts, portfolio view, operator profiles, strategy fingerprint detail all go dark on day 31. 30-day trial matches TradingView — long enough for multiple market cycles and deep habit formation.
- **Build order:** Data pipeline → vault metrics → operator profiles (basic) → UI → subscriptions → operator profiles (deep) → deposit routing
- **Long-term vision:** Retail allocator tool (Phase 1) → professional allocator infrastructure (Phase 2) → verified track record marketplace + institutional OMS (Phase 3)
