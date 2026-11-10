-- SpamInThai — Passive Spam Signal Collection (v3.1.6)
-- D1 schema for the hashed, opt-in crowdsourced call-signal pipeline.
-- Privacy: only SHA-256(E.164 + SIGNAL_SALT) is ever stored. No raw numbers,
-- no contact names, no device identifiers beyond an anonymous install id used
-- solely for rate-limiting and distinct-installs counting.
-- Apply:  wrangler d1 execute spaminthai-signals --file functions/api/signals-schema.sql

-- Raw hashed signals (retention: 180 days, purged by the hourly job).
CREATE TABLE IF NOT EXISTS call_signals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  h          TEXT    NOT NULL,            -- SHA-256(E.164 + salt), 64 hex chars
  event      TEXT    NOT NULL,            -- rejected | short_call | blocked | reported
  ts         INTEGER NOT NULL,            -- client event time (unix seconds)
  prefix     TEXT,                        -- 4-digit dialling prefix (coarse, non-identifying)
  install_id TEXT    NOT NULL,            -- anonymous install id (rate-limit + distinct count only)
  created_at INTEGER NOT NULL             -- server receive time (unix seconds)
);
CREATE INDEX IF NOT EXISTS idx_cs_h_created  ON call_signals (h, created_at);
CREATE INDEX IF NOT EXISTS idx_cs_created    ON call_signals (created_at);
CREATE INDEX IF NOT EXISTS idx_cs_h_event    ON call_signals (h, event);

-- Aggregated risk per hashed number (rebuilt hourly from call_signals).
CREATE TABLE IF NOT EXISTS number_risk (
  h            TEXT    PRIMARY KEY,
  score        TEXT    NOT NULL DEFAULT 'none',  -- none | suspicious | likely_spam | spam
  reports_24h  INTEGER NOT NULL DEFAULT 0,       -- distinct installs reporting in last 24h
  installs_24h INTEGER NOT NULL DEFAULT 0,       -- distinct installs (neg events) last 24h
  installs_7d  INTEGER NOT NULL DEFAULT 0,       -- distinct installs (any event) last 7d
  last_seen    INTEGER,                          -- most recent signal ts (unix seconds)
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nr_score ON number_risk (score);

-- Scoring thresholds — config, NOT hardcoded. Edit this row to tune without a redeploy.
CREATE TABLE IF NOT EXISTS signal_config (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
INSERT OR IGNORE INTO signal_config (k, v) VALUES (
  'scoring_v1',
  '{"neg_events":["rejected","short_call","blocked"],"suspicious":{"installs_24h":3},"likely_spam":{"installs_7d":10},"spam":{"require_reported":true,"installs_7d":5}}'
);
INSERT OR IGNORE INTO signal_config (k, v) VALUES ('retention_days', '180');
INSERT OR IGNORE INTO signal_config (k, v) VALUES ('daily_cap_per_install', '500');

-- Per-install daily counter for the 500/day/install rate limit.
CREATE TABLE IF NOT EXISTS install_daily (
  install_id TEXT    NOT NULL,
  day        TEXT    NOT NULL,            -- YYYY-MM-DD (UTC)
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (install_id, day)
);
