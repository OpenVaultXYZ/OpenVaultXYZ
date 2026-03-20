-- OpenVault — TimescaleDB Schema
-- Run against a TimescaleDB instance (TimescaleDB extension must be enabled).
-- Apply in order: CREATE TABLE first, then create_hypertable.

-- ─── Vault registry ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vaults (
  vault_address       TEXT        PRIMARY KEY,
  name                TEXT,
  description         TEXT,
  leader_address      TEXT        NOT NULL,
  leader_is_vault     BOOLEAN     NOT NULL DEFAULT false,
  apr                 NUMERIC,                          -- from vaultDetails.apr (decimal, e.g. 0.12 = 12%)
  is_closed           BOOLEAN     NOT NULL DEFAULT false,
  allow_deposits      BOOLEAN,
  relationship_type   TEXT,                             -- 'parent' | 'child' | 'normal' | NULL
  leader_fraction     NUMERIC,                          -- fraction of vault equity owned by leader
  leader_commission   NUMERIC,                          -- profit share taken by leader (0-1)
  max_distributable   NUMERIC,
  max_withdrawable    NUMERIC,
  discovery_source    TEXT        NOT NULL DEFAULT 'manual',  -- 'manual' | 'bfs' | 'follower_scan'
  discovered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vaults_leader_address_idx ON vaults (leader_address);
CREATE INDEX IF NOT EXISTS vaults_is_closed_idx      ON vaults (is_closed);

-- ─── Operators ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operators (
  operator_address    TEXT        PRIMARY KEY,
  role                TEXT        NOT NULL,       -- 'user' | 'vault' (from userRole)
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Normalized fills (hypertable) ───────────────────────────────────────────
-- Platform-agnostic fill storage. All HL-specific field names translated before write.
-- Partitioned by time. Primary key is (vault_address, trade_id, time).

CREATE TABLE IF NOT EXISTS normalized_fills (
  vault_address   TEXT        NOT NULL REFERENCES vaults (vault_address),
  platform        TEXT        NOT NULL DEFAULT 'hyperliquid',
  trade_id        TEXT        NOT NULL,               -- platform-agnostic fill ID (HL: String(tid))
  asset           TEXT        NOT NULL,               -- coin/market (HL: coin)
  price           NUMERIC     NOT NULL,               -- execution price
  size            NUMERIC     NOT NULL,               -- size filled
  side            TEXT        NOT NULL CHECK (side IN ('buy', 'sell')),
  time            TIMESTAMPTZ NOT NULL,
  realized_pnl    NUMERIC     NOT NULL DEFAULT 0,     -- closed PnL; 0 for opens
  fee             NUMERIC     NOT NULL DEFAULT 0,
  fee_asset       TEXT,                               -- currency of fee
  position_before NUMERIC,                            -- signed size before this fill
  direction       TEXT,                               -- 'Open Long' | 'Close Short' etc.
  is_adl_event    BOOLEAN     NOT NULL DEFAULT false, -- auto-deleveraged fill
  is_twap         BOOLEAN     NOT NULL DEFAULT false,
  is_taker        BOOLEAN,                            -- true = crossed the spread
  order_id        BIGINT,
  raw_hash        TEXT,
  PRIMARY KEY (vault_address, trade_id, time)
);

SELECT create_hypertable('normalized_fills', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS normalized_fills_vault_time_idx ON normalized_fills (vault_address, time DESC);
CREATE INDEX IF NOT EXISTS normalized_fills_asset_idx      ON normalized_fills (asset);
CREATE INDEX IF NOT EXISTS normalized_fills_adl_idx        ON normalized_fills (vault_address, is_adl_event) WHERE is_adl_event = true;

-- ─── NAV / equity snapshots (hypertable) ─────────────────────────────────────
-- One row per vault per timestamp. Sourced from:
--   - portfolio.accountValueHistory (backfill at ~weekly cadence from HL)
--   - clearinghouseState polls (ongoing, every 15 min)

CREATE TABLE IF NOT EXISTS vault_snapshots (
  vault_address       TEXT        NOT NULL REFERENCES vaults (vault_address),
  time                TIMESTAMPTZ NOT NULL,
  account_value       NUMERIC     NOT NULL,   -- total NAV including unrealized PnL
  total_ntl_pos       NUMERIC,               -- total notional position value
  total_margin_used   NUMERIC,
  withdrawable        NUMERIC,
  source              TEXT        NOT NULL DEFAULT 'poll',  -- 'portfolio_history' | 'poll'
  PRIMARY KEY (vault_address, time)
);

SELECT create_hypertable('vault_snapshots', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS vault_snapshots_vault_time_idx ON vault_snapshots (vault_address, time DESC);

-- ─── Position snapshots (hypertable) ─────────────────────────────────────────
-- One row per (vault, coin, snapshot_time). Sourced from clearinghouseState polls.

CREATE TABLE IF NOT EXISTS vault_positions (
  vault_address           TEXT        NOT NULL REFERENCES vaults (vault_address),
  snapshot_time           TIMESTAMPTZ NOT NULL,
  coin                    TEXT        NOT NULL,
  szi                     NUMERIC     NOT NULL,   -- signed size (positive = long, negative = short)
  entry_px                NUMERIC,
  position_value          NUMERIC,
  unrealized_pnl          NUMERIC,
  leverage_type           TEXT,                   -- 'cross' | 'isolated'
  leverage_value          NUMERIC,
  liquidation_px          NUMERIC,               -- null if no liquidation risk
  margin_used             NUMERIC,
  cum_funding_all_time    NUMERIC,               -- cumulative funding since inception (negative = paid)
  cum_funding_since_open  NUMERIC,               -- cumulative funding since this position opened
  PRIMARY KEY (vault_address, snapshot_time, coin)
);

SELECT create_hypertable('vault_positions', 'snapshot_time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS vault_positions_vault_time_idx ON vault_positions (vault_address, snapshot_time DESC);
CREATE INDEX IF NOT EXISTS vault_positions_coin_idx        ON vault_positions (coin);

-- ─── Vault followers (point-in-time snapshot) ────────────────────────────────
-- Depositor list per vault at each ingestion run. Used for vault discovery BFS
-- and for computing AUM concentration / inflow trends.

CREATE TABLE IF NOT EXISTS vault_followers (
  vault_address   TEXT        NOT NULL REFERENCES vaults (vault_address),
  snapshot_time   TIMESTAMPTZ NOT NULL,
  user_address    TEXT        NOT NULL,
  vault_equity    NUMERIC     NOT NULL,
  pnl             NUMERIC,
  all_time_pnl    NUMERIC,
  days_following  INTEGER,
  entry_time      TIMESTAMPTZ,
  lockup_until    TIMESTAMPTZ,
  PRIMARY KEY (vault_address, snapshot_time, user_address)
);

SELECT create_hypertable('vault_followers', 'snapshot_time', if_not_exists => TRUE);

-- ─── Computed metrics (updated by metrics worker) ─────────────────────────────
-- Pre-computed. Never compute on request. Served from here (or Redis cache).

CREATE TABLE IF NOT EXISTS vault_metrics (
  vault_address       TEXT        PRIMARY KEY REFERENCES vaults (vault_address),
  computed_at         TIMESTAMPTZ NOT NULL,
  -- Performance
  annualized_return   NUMERIC,                    -- TWR annualized
  win_rate            NUMERIC,                    -- % of closing trades profitable
  profit_factor       NUMERIC,                    -- gross profit / gross loss
  -- Risk
  sharpe_ratio        NUMERIC,
  sortino_ratio       NUMERIC,
  calmar_ratio        NUMERIC,
  max_drawdown        NUMERIC,                    -- peak-to-trough, as positive decimal (0.15 = 15%)
  avg_drawdown        NUMERIC,
  max_drawdown_days   INTEGER,                    -- duration of worst drawdown in days
  -- Alpha / beta
  btc_beta            NUMERIC,
  eth_beta            NUMERIC,
  funding_income_pct  NUMERIC,                    -- funding income as % of total return
  -- Classification
  strategy_type       TEXT,                       -- 'momentum' | 'mean_reversion' | 'funding_arb' | 'hf_market_making' | 'directional_macro' | 'leveraged_beta'
  risk_score          NUMERIC,                    -- 1 (lowest risk) to 10 (highest)
  -- Flexible bag for additional fields without schema migration
  data                JSONB       NOT NULL DEFAULT '{}'
);

-- ─── Market reference prices (for beta computation) ───────────────────────────

CREATE TABLE IF NOT EXISTS market_prices (
  coin    TEXT        NOT NULL,
  time    TIMESTAMPTZ NOT NULL,
  price   NUMERIC     NOT NULL,
  PRIMARY KEY (coin, time)
);

SELECT create_hypertable('market_prices', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS market_prices_coin_time_idx ON market_prices (coin, time DESC);
