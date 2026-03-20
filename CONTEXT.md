# OpenVault — Business Context & Strategy

**Company:** OpenVault LLC (Wyoming — filing in progress)
**Domain:** openvault.trade (primary) — openvault.xyz ($3k), openvault.io ($6k) deferred
**Stage:** Data pipeline complete, translation layer next (March 2026)

---

## What OpenVault Is

OpenVault is independent vault analytics for Hyperliquid. We are the research layer that sits between capital allocators and the vaults they deposit into.

The vault ecosystem on Hyperliquid has grown dramatically faster than the information infrastructure around it. Hundreds of vaults manage hundreds of millions in depositor capital. The leaderboard shows a return number and a line chart. That's it. OpenVault provides everything a serious capital allocator actually needs to make an informed decision.

**We are not a trading platform. We are not an exchange.** We are a read-only analytics product.

---

## The Core Product Framing

**The vault is the primary product unit.** Capital allocators deposit into vaults, not operators. Vault pages — with risk-adjusted metrics, strategy fingerprinting, regime analysis, ADL risk signals, drawdown behavior, and peer benchmarking — are the core of what OpenVault provides.

**Operator profiles are valuable supporting context.** An operator running multiple vaults has an aggregate track record worth seeing. Their consistency, their behavior during drawdowns, their skin in the game — this informs the vault evaluation. But depositors write checks to vaults, not to people.

This framing matters for product decisions: vault pages come first, operator pages are Phase 2 depth.

---

## Why Hyperliquid First

Hyperliquid has >80% of DEX perps market share. $2.9T in 2025 trading volume. $4.15B TVL. 500k+ wallets. It's the dominant venue and the right place to establish methodology credibility and community trust before expanding.

**OpenVault is built platform-agnostic from day one.** The metrics engine never knows which platform data came from. Each platform (Hyperliquid today, Lighter and dYdX v4 later) has its own ingestion translator that normalizes raw API data into our internal schema. The metrics engine runs identically regardless of source.

This means: adding a second platform is a translator build + registry expansion, not a metrics rewrite. Cross-platform operator profiles — showing a manager's combined track record across Hyperliquid and Lighter — become possible in Phase 3+ without architectural rework.

---

## The Information Gap We Fill

What Hyperliquid shows on a vault page:
- Raw P&L and return percentage
- TVL and depositor count
- Basic equity curve (line going up)
- Self-reported description (unverified, can say anything)

What a serious depositor actually needs:
- Risk-adjusted returns (Sharpe, Sortino, Calmar)
- Drawdown profile (max, duration, recovery — not just the number, the shape)
- Strategy verification (what is this vault actually doing vs. what it claims)
- ADL event history (forced position reductions — a severe risk signal invisible on the leaderboard)
- Regime performance (did this vault only make money in one trending month?)
- Liquidation proximity (how close to blowing up right now)
- Peer benchmarking (is this good for a momentum strategy or just mediocre?)
- Operator context (does this operator have other vaults? track record across all of them?)

The gap between those two lists is the entire OpenVault product.

---

## The Market Context

### Hyperliquid
- Custom L1 blockchain, HyperBFT consensus, 200k TPS
- Fully on-chain order book (HyperCore) — every trade verifiable
- Zero gas fees on trading layer
- $2.9T trading volume in 2025, $844M revenue
- 500k+ wallets, $4.15B TVL
- No KYC, permissionless

### US Regulatory Tailwind (March 2026)
- CFTC Chairman Selig: perps frameworks coming "within weeks"
- SEC + CFTC joint "Project Crypto" — pathways to onshore DeFi perp products
- OpenVault as analytics layer has no meaningful legal ambiguity — we're not the exchange

### The ADL Finding (March 2026)
During first ingestion run, discovered `side = "A"` fills in Hyperliquid's API — auto-deleveraged fills. ADL happens when a counterparty is liquidated and the insurance fund runs out — the exchange force-closes your profitable position at a below-market price. One vault (Orbit Value Strategies) had repeated ADL events in a single window. Depositors cannot see this anywhere on the leaderboard. This is exactly the category of hidden risk signal OpenVault exists to surface.

---

## Customer Stack

**Today — Retail Allocators**
Vault depositors putting in $1k–$100k. Making the same decision as a fund allocator without the tools. OpenVault gives them those tools at $19/month — less than the fee on a single bad vault decision.

**Near Term — Emerging Professional Allocators**
Crypto-native family offices, DAO treasuries, group investment structures. Doing informal due diligence already. OpenVault formalizes it. High willingness to pay for institutional-grade tools.

**Medium Term — Institutional Capital**
As US regulation opens and on-chain perps become institutionally legitimate, real institutional money wants independent ratings they can point to. OpenVault's verified methodology is the credential.

**Long Term — Cross-Platform Allocators**
As OpenVault expands to multiple platforms, the product becomes the only place to evaluate a manager's complete on-chain track record regardless of where they trade.

---

## Phase Roadmap

### Phase 1 — Vault Analytics MVP (now → first revenue)
**Goal:** best independent vault analytics on Hyperliquid. Become the default research tool.
- Translation layer: NormalizedFill schema, Hyperliquid translator
- Metrics engine: Sharpe, drawdown, win rate, beta, ADL frequency, regime analysis, risk score
- Strategy classification (rule-based v1)
- Basic operator profiles (aggregate across vaults — supporting context, not primary feature)
- Web UI: vault rankings, vault detail pages, basic operator pages
- Free tier + Pro tier ($19/mo) with Stripe + 30-day trial
**Revenue:** subscriptions. Break even at 4 Pro subscribers. Serious business at 500.

### Phase 2 — Depth + Deposit Interface (3-4 months post-launch)
**Goal:** deepen the product, close the research-to-action loop.
- Full operator profiles: drawdown behavior analysis, peer benchmarking, track record presentation
- Institutional tier ($199/mo): manager screening, track record export, API access
- Deposit routing: wallet connection, research-to-deposit without leaving OpenVault
- Portfolio dashboard: track all vault positions in one place
- Alerts: drawdown thresholds, risk score changes, liquidation proximity
**Revenue:** subscriptions grow. Deposit routing is UX/conversion only — no builder code revenue on vault deposits (confirmed).

### Phase 3 — Verified Track Records (12-18 months)
**Goal:** become the credentialing layer for on-chain vault operators raising capital.
- Operators pay OpenVault to certify and format their track record for institutional presentation
- Standardized, auditable report that allocators can reference in due diligence
- Creates two-sided dynamic: operators want certification to raise capital, allocators trust it because it's independent
- Requires Phase 1 methodology credibility to be established first — can't rush this
**Revenue:** operator certification fees ($200-500/report or subscription). New revenue stream on top of subscriptions.

### Phase 4 — Execution Interface + Builder Code (18-24 months)
**Goal:** extend from research into execution for active traders.
- Direct trading interface: users place perp orders through OpenVault's UI
- Builder code fees on every fill (up to 0.1% per perps fill) — the large revenue opportunity
- Redundant order routing, failover, emergency position management during outages
- This is a different product with higher technical stakes — bugs cost real money
- Requires established trust from Phases 1-3 before traders route real orders through you
**Revenue:** builder code fees scale with trading volume. At Hyperliquid's scale, meaningful even with small market share.

### Phase 5 — Institutional OMS (24+ months)
**Goal:** prime brokerage adjacent infrastructure for institutional on-chain trading.
- Execution algos adapted for 24/7 perpetuals (TWAP, VWAP, funding-rate-aware)
- Multi-account management, portfolio-level risk engine
- Compliance reporting hooks (US regulation fully open by this point)
- Cross-platform execution across Hyperliquid + other venues
**Revenue:** institutional SaaS at meaningful ACV. Natural evolution of institutional relationships from Phase 1-3.

---

## Revenue Model

### Pricing
- **Pro: $19/month** ($15/month annual)
- **Institutional: $199/month** ($149/month annual = $1,788/year)
- 30-day full trial, no card required
- Grandfathered pricing for all existing subscribers — never raise prices on existing customers

### Philosophy
Build moat through ubiquity first, margin later. TradingView starts at $12.95/month. OpenVault serves a smaller niche — price needs to feel like an impulse buy for anyone with real capital in a vault. Volume builds the community trust that no competitor can buy.

### Profitability
- Infrastructure: ~$76/month (RPC $50 + hosting $20 + Workspace $6)
- Break even: 4 Pro subscribers
- Covers founder time: ~100 Pro = $1,900/month
- Serious business: ~500 Pro = $9,500/month + institutional
- 10 institutional = $1,990/month alone

### Trial mechanic
30 days, no card. On day 31: regime analysis, alerts, portfolio view, operator depth, strategy fingerprint detail all go dark. User has built a daily habit — they feel the loss immediately.

### Tier breakdown

**Free Forever**
- Vault leaderboard with sorting
- Sharpe + max drawdown for every vault
- Risk score (1-10)
- Strategy type label
- 30-day return + basic equity curve
- Basic operator profile (name, vault count, AUM)

**Pro — $19/month**
- Full regime analysis
- Complete drawdown statistics
- Strategy fingerprint with evidence
- ADL event frequency and history
- BTC/ETH beta decomposition
- Funding rate income breakdown
- Full equity curve + drawdown overlay
- Liquidation proximity indicator
- Full operator profiles
- Drawdown behavior analysis
- Peer benchmarking (percentile rank)
- Vault + operator comparison
- Portfolio view
- In-app + email alerts
- Unlimited watchlists
- Downloadable PDF reports

**Institutional — $199/month**
- Everything in Pro
- Manager screening tool
- Track record export (standardized format)
- API access
- Bulk vault/operator analysis
- Contagion/cascade modeling
- Custom reporting
- White-label options

---

## The Moat

**Methodology credibility** — publish openly, version it, invite criticism, hold ratings under pressure. The community respects transparency. Being right publicly, repeatedly, is the compound interest of credibility.

**Operator network effects** — operators who rate well share their OpenVault page to attract deposits. They become advocates. Reach out to top 20 operators personally before launch.

**Institutional relationships** — serve institutional users with relationships, not just software. Their feedback = product roadmap. Quarterly ecosystem reports, free and public.

**Community trust** — weekly risk-adjusted rankings, same format, same methodology, forever. Be right in public. Never optimize short-term revenue at the expense of credibility.

---

## Key Risks

1. **Hyperliquid platform dependency** — mitigated by platform-agnostic architecture and planned expansion
2. **Metrics accuracy** — wrong metrics damage credibility irreparably. Get them right before going public.
3. **Vault operator pushback** — operators who rate poorly may be adversarial. Independence is the product. Prepare for it publicly.
4. **Phase 3 timing** — verified track records require market maturation. Don't count on this revenue materializing quickly.
5. **Phase 4 is a different business** — execution infrastructure has higher technical stakes and trust requirements. Don't rush it.
6. **Solo founder** — everything moves at one person's speed. Focus is the constraint. Go deep on Phase 1 before touching Phase 2.

---

## Working Notes

**March 2026**
- Company: OpenVault LLC, Wyoming, filing in progress (~$143 total via Northwest Registered Agent)
- Domain: openvault.trade. Premium domains deferred.
- Infrastructure: hello@openvault.trade, GitHub org openvault-trade (private membership)
- **Business reframe (March 2026):** Vault is primary product unit, operator is supporting context. Allocators invest in vaults.
- **Phase order finalized:** analytics → deposit routing → verified track records → execution interface (builder code) → OMS
- **Builder code confirmed:** non-applicable to vault deposits. Phase 4 execution interface is the builder code revenue opportunity.
- **Platform-agnostic architecture decision:** NormalizedFill translation layer built before metrics engine. Enables Lighter, dYdX v4, GMX expansion without metrics rewrite.
- **ADL finding (March 2026):** `side = "A"` fills = auto-deleveraged events. Critical risk signal invisible on leaderboard. Orbit Value Strategies vault had repeated ADL events. First real product differentiator confirmed in the data.
- **First ingestion (March 2026):** 33 vaults, 563,925 fills. Growi HF highest frequency (71k). Liquidator deprecated (last fill Aug 2023). Citadel oldest track record (Dec 2023, ~2.3 years). HLP returns 0 fills.
- **Pricing:** $19/mo Pro, $199/mo Institutional. 30-day trial, no card. No planned increases. Grandfathered forever.
