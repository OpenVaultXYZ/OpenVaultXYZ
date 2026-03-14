# OpenVault — FINDINGS.md

## What This File Is

Every time you pull data and notice something interesting — a vault behaving unexpectedly, a pattern in operator behavior, a gap between what the leaderboard shows and what the data actually says — write it here in plain language immediately.

This is your content pipeline for building in public on X.
No code here. No jargon. Just observations a depositor would care about.

---

## How to Use It

**While building or exploring data:**
When you notice something interesting, write one line here before moving on.
Format: `[date] — observation — why it matters`

**When posting on X:**
Open this file. Pick the most compelling unused observation.
Write the post (10 minutes). Mark it `[POSTED MM/DD]` so you don't repeat it.

**What makes a good finding:**
- Counterintuitive — the leaderboard says one thing, the data says another
- Specific — a real vault, a real number, a real discrepancy
- Actionable — a depositor could make a better decision knowing this
- Visual — something that can be shown with a screenshot or simple chart

---

## Finding Categories

Use these tags to organize entries:

`[VAULT]` — specific vault behavior or metrics
`[OPERATOR]` — operator-level patterns across multiple vaults
`[RISK]` — risk metrics that tell a different story than raw returns
`[REGIME]` — how something performed during a specific market period
`[STRATEGY]` — strategy classification observations
`[ECOSYSTEM]` — broader patterns across the whole vault ecosystem
`[LEADERBOARD GAP]` — cases where HL leaderboard misleads depositors

---

## Findings Log

_Add entries here as you find them. Newest at top._

### Pre-launch observations (from manual research)

[Mar 2026] [LEADERBOARD GAP] — Viewed a vault on Hyperliquid with $8.4M TVL and 88% APR. Currently has 19 open positions, nearly all showing 40-95% unrealized losses at 10-40x leverage. The 88% APR number is the only thing visible above the fold. A depositor would need to click through to Positions tab and understand cross-margin liquidation mechanics to understand the actual risk. Most won't. This is exactly the gap OpenVault fills.

[Mar 2026] [LEADERBOARD GAP] — Vault descriptions are entirely self-reported and unverified. One vault claims "mean-reversion strategy" in its description but its current positions tab shows 19 simultaneous directional longs. No independent verification of strategy claims exists anywhere on the platform.

---

## Post Ideas Backlog

_Refined post concepts ready to write when needed._

**"The 88% APR vault"**
Hook: Top Hyperliquid vault by TVL shows 88% APR. Here's what the positions tab actually shows.
Data: 19 open positions, avg unrealized loss 50%+, 10-40x leverage across the board.
Point: Raw APR hides everything that matters. This is what OpenVault will show instead.
Status: [ ] draft [ ] posted

**"Mean reversion or just long everything?"**
Hook: This vault describes itself as "mean-reversion." Here's what its actual positions look like.
Data: Screenshot of positions tab showing directional longs on 19 assets simultaneously.
Point: Strategy labels on Hyperliquid are self-reported and unverified. OpenVault fingerprints from actual trade data.
Status: [ ] draft [ ] posted

**"What Hyperliquid shows you vs. what you need to know"**
Hook: Side by side — what the leaderboard shows a depositor vs. what they actually need to make a good decision.
Data: TVL, return number, equity curve on one side. Risk score, Sharpe, drawdown, strategy type, regime performance on the other.
Point: The information gap is the product.
Status: [ ] draft [ ] posted

