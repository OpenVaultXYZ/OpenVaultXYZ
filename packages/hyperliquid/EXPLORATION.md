# Hyperliquid API — EXPLORATION.md

## What This File Is

Technical findings from exploring the Hyperliquid API.
Written before any production code. Updated as exploration progresses.
This is the source of truth for what the API actually returns — not what the docs say it returns.

Lives at: `packages/hyperliquid/EXPLORATION.md`

---

## How to Use It

During API exploration in Claude Code:
- Run requests against the testnet first, then mainnet
- Paste actual response shapes here, not assumed shapes
- Note anything unexpected, undocumented, or different from what docs say
- Check off items in CLAUDE.md API Exploration Checklist as you answer them

Production code should be written from what's documented here, not from assumptions.

---

## Exploration Status

Started: [ ]
Testnet confirmed working: [ ]
All checklist items answered: [ ]
Schema designed from findings: [ ]

---

## Endpoints Explored

_Document each endpoint as you explore it._

### Template for each endpoint:

```
## Endpoint: [name]
**URL:** POST https://api.hyperliquid.xyz/info
**Request body:**
{
  "type": "..."
}

**Response shape:**
{
  // paste actual response here
}

**Notes:**
- What this returns
- Any gotchas or unexpected behavior
- Rate limit observations
- Pagination behavior if applicable
```

---

## Vault Discovery

### How to get all active vaults
[ ] Not yet explored

---

## Trade History

### Trade/fill object shape
[ ] Not yet explored

### Pagination behavior
[ ] Not yet explored

---

## Positions and State

### Current positions endpoint
[ ] Not yet explored

### Equity / NAV endpoint
[ ] Not yet explored

### Funding payments endpoint
[ ] Not yet explored

---

## Operator Linking

### Operator → vault relationship
[ ] Not yet explored

---

## Rate Limits

### Observed limits
[ ] Not yet tested

### Rate limit error response
[ ] Not yet observed

### Practical throughput test
[ ] Not yet run
Methodology: send requests in a loop, count how many succeed per minute before errors appear

---

## Unexpected Findings

_Document anything the docs didn't mention or that behaved differently than expected._

(none yet)

---

## Data Quality Notes

_Edge cases, missing fields, null values, inconsistencies found in real data._

(none yet)

---

## Schema Decisions

_Decisions made about how to store data based on what the API actually returns._
_Written after exploration is complete, before writing any DB schema code._

(exploration not yet complete)

