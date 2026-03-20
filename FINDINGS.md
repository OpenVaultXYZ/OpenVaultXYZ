# OpenVault — FINDINGS.md

## What This File Is

Every time you pull data and notice something interesting — a vault behaving unexpectedly, a pattern in the data, a gap between what the leaderboard shows and what the API actually contains — write it here in plain language immediately.

This is your content pipeline for building in public on X.
No code here. No jargon. Just observations a depositor would care about.

---

## How to Use It

**While building:**
When you notice something interesting, write one line here before moving on.
Format: `[date] [TAG] — observation — why it matters to a depositor`

**When posting on X:**
Open this file. Pick the most compelling unused entry.
Write the post (10 minutes max). Mark it `[POSTED MM/DD]`.

**What makes a good finding:**
- Counterintuitive — the leaderboard says one thing, the data says another
- Specific — a real vault, a real number, a real discrepancy
- Actionable — a depositor could make a better decision knowing this
- Visual — can be shown with a screenshot or simple chart

---

## Tags

`[VAULT]` — specific vault behavior or metrics
`[OPERATOR]` — operator-level patterns
`[RISK]` — risk signals hidden from leaderboard
`[REGIME]` — performance during specific market periods
`[STRATEGY]` — strategy classification observations
`[ECOSYSTEM]` — patterns across the whole vault ecosystem
`[LEADERBOARD GAP]` — cases where HL leaderboard actively misleads
`[ADL]` — auto-deleveraging events specifically

---

## Findings Log

_Newest at top._

### From UI exploration (2026-03-17)

[Mar 2026] [ECOSYSTEM] — Sorting 435 vaults by Sharpe ratio descending (6+ month filter) produces a surprisingly clean list of vaults worth looking at. The top of the list has strong risk-adjusted returns, reasonable max drawdowns, and believable track records. Reversing the sort — lowest Sharpe first — gives almost exactly the vaults you'd want to avoid: negative returns, extreme drawdowns, or blown-up accounts. Sharpe alone is a better single filter than the HL leaderboard's raw return sort.

[Mar 2026] [RISK] — Max Drawdown is the most readable risk signal on the leaderboard at a glance. Vaults with >50% max drawdown almost always have other red flags (high leverage, low win rate, short track record). A vault can have a high Sharpe and still have a 70% max drawdown — combination sorting on both columns identifies the rare vaults with both strong risk-adjusted returns and tight risk management. These are the ones worth serious due diligence.

[Mar 2026] [LEADERBOARD GAP] — The HL leaderboard sorts by APR with no drawdown visibility. A vault at +3000% APR with 87% max drawdown sits above a vault at +1400% APR with 17% max drawdown. The second vault is almost certainly the better capital allocation. This ordering difference is the core value proposition of OpenVault's Sharpe-first default.

### From first metrics run (2026-03-16)

[Mar 2026] [ECOSYSTEM] — First metrics run across 435 active Hyperliquid vaults. Significant portion have -100% annualized returns — wiped out accounts still sitting in the registry. The leaderboard only shows vaults with positive recent performance. The full distribution tells a very different story.

[Mar 2026] [VAULT] — HLP Strategy A (sub-vault of HLP) scores risk=1.0 — the lowest possible risk rating. Near-zero max drawdown, extremely high Sharpe. This is a high-frequency market-making vault operating under HLP. Its risk profile is structurally different from directional vaults, yet it's listed alongside them on the leaderboard with no distinction.

[Mar 2026] [ECOSYSTEM] — BFS vault discovery from 33 seed vaults reached 519 total vaults — a 15x expansion. These aren't all active: many are abandoned or blown-up accounts. The "3200+ vaults" on HL includes a long tail of dead vaults that nobody is watching.

[Mar 2026] [STRATEGY] — Strategy classification across 435 vaults: momentum is the most common label (catch-all for directional trading without enough signal for a more specific type). Meaningful clusters in hf_market_making and directional_macro. True funding_arb vaults are rare — only a handful show funding income >40% of total return.

### From first ingestion run (2026-03-15)

[Mar 2026] [ECOSYSTEM] — First full ingestion: 33 vaults, 563,925 fills in database. Growi HF has 71,433 fills since November 2025 — ~450 fills per day average. This is almost certainly high-frequency market making or arbitrage. The leaderboard shows a return number. The fill count alone tells you the strategy type.

[Mar 2026] [VAULT] — Liquidator vault (0x63c621...) last traded in August 2023. It still appears in the ecosystem. No indication on the leaderboard that it's inactive. Depositors could theoretically try to deposit into a dead vault.

[Mar 2026] [VAULT] — Citadel vault has trade history going back to December 2023 — the oldest in our dataset at ~2.3 years. That's a track record that spans multiple market regimes. Compare to vaults launched in late 2025 that only have bull market history. Track record depth is invisible on the leaderboard.

[Mar 2026] [ECOSYSTEM] — Hyperliquid's fill API uses three side values: "B" (bid fill = buy), "S" (sell), and "A" (ask fill = also sell). Market-making vaults like Growi HF have ~50% "A" fills and zero "S" fills — they trade purely on bid/ask sides. This three-value encoding is undocumented. The B/A split in a fill history is a direct signal of market-making behavior: high "A" percentage = posting asks constantly = market maker.

### Pre-launch observations (from manual research)

[Mar 2026] [LEADERBOARD GAP] — Vault with $8.4M TVL and 88% APR displayed. Positions tab shows 19 open positions, nearly all with 40-95% unrealized losses at 10-40x leverage. The 88% APR is the only number visible above the fold. A depositor needs to understand cross-margin liquidation mechanics to interpret the positions tab. Most won't. This is the gap.

[Mar 2026] [STRATEGY] [LEADERBOARD GAP] — Vault claims "quantitative mean-reversion strategy" in self-reported description. Positions tab shows 19 simultaneous directional longs across different assets. Strategy labels on Hyperliquid are entirely self-reported and unverified. OpenVault fingerprints strategy from actual trade data.

---

## Post Ideas Backlog

_Refined concepts ready to draft._

**"The hidden signal in Hyperliquid's fill data"** ← POST THIS FIRST
Hook: Hyperliquid's fill API has a third side value that nobody talks about.
Data: `side = "A"` = ask-side fill (maker sell). Market-making vaults have ~50% "A" fills, zero "S" fills. Directional vaults have a completely different distribution.
Point: The B/A/S breakdown in a vault's fill history is a free strategy fingerprint. OpenVault uses it. Building now.
Status: [ ] draft [ ] posted

**"450 fills per day"**
Hook: One vault in our database averages 450 fills per day. The leaderboard shows one return number.
Data: Growi HF — 71,433 fills since November 2025. That fill frequency tells you the strategy type before you run a single metric.
Point: Fill count is a free strategy signal that nobody surfaces. OpenVault will.
Status: [ ] draft [ ] posted

**"The 88% APR vault"**
Hook: Top Hyperliquid vault by TVL shows 88% APR. Here's what the positions tab actually shows.
Data: 19 open positions, avg unrealized loss 50%+, 10-40x leverage.
Point: Raw APR hides everything that matters.
Status: [ ] draft [ ] posted

**"Mean reversion or just long everything?"**
Hook: This vault claims "mean-reversion strategy." Here's what its positions show.
Data: 19 simultaneous directional longs.
Point: Strategy labels are self-reported. OpenVault fingerprints from actual trade data.
Status: [ ] draft [ ] posted

**"2.3 years of track record"**
Hook: One vault in our database has been trading since December 2023. Another launched 3 months ago. The leaderboard ranks them the same way.
Data: Citadel — oldest track record, multiple market regimes. vs. vaults with only 2025 bull market history.
Point: Track record depth and regime coverage are invisible on the leaderboard.
Status: [ ] draft [ ] posted

**"The full distribution"**
Hook: The Hyperliquid vault leaderboard shows you the winners. We ran metrics on 435 vaults. Here's the full distribution.
Data: Large share of vaults at -100% annualized return. Risk scores skewed heavily toward 8-10. The leaderboard is survivorship bias in product form.
Point: You can't evaluate a vault without knowing what the base rate of failure looks like.
Status: [ ] draft [ ] posted

**"The dead vault"**
Hook: This vault still appears in the Hyperliquid ecosystem. Its last trade was August 2023.
Data: Liquidator vault — zero activity for 18+ months, no leaderboard flag.
Point: OpenVault will flag inactive and deprecated vaults clearly.
Status: [ ] draft [ ] posted
