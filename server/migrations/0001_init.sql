-- TODDY Seasons: migration 0001 (initial tables). SQLite / Cloudflare D1.
-- Safe to run twice: every statement is IF NOT EXISTS / INSERT OR IGNORE.
-- Times are UTC text like 2027-01-04T00:00:00.000Z. Money-like values do not exist here: points are plain whole numbers.
-- Not collected on purpose: real names, phone numbers, precise location, wallet addresses, anything about holdings.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- A season is data. Dates stay empty (NULL) until the owner decides them; Season 2 is just another row.
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','rehearsal','live','review','closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Every version of the rules for a season (caps, category limits, dates). Never edited after use; add a new version.
CREATE TABLE IF NOT EXISTS rule_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  version INTEGER NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '{}',
  effective_from TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (season_id, version)
);

-- The game registry. "adapter" names the code that checks a run for that game; new games add a row and an adapter.
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  adapter TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','beta','live','parked','retired')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Which games count in which season, and each game's own point settings. Raw scores of different games are never added.
CREATE TABLE IF NOT EXISTS season_games (
  season_id TEXT NOT NULL REFERENCES seasons(id),
  game_id TEXT NOT NULL REFERENCES games(id),
  points_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (season_id, game_id)
);

-- A Passport. Guests have no row until they sign in.
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,                       -- permanent Passport ID, for example TDY-7F3A91C2
  username TEXT COLLATE NOCASE UNIQUE,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  join_week TEXT,
  signin_method TEXT,
  referral_code TEXT UNIQUE,
  invited_by TEXT REFERENCES players(id),
  adult_confirmed_at TEXT,                   -- the 18+ tick and when
  terms_version TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','held','removed')),
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS linked_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  provider TEXT NOT NULL,                    -- google now; telegram and discord later
  provider_hash TEXT NOT NULL,               -- salted hash, never the raw id
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (provider, provider_hash)
);

CREATE TABLE IF NOT EXISTS device_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  device_hash TEXT,
  network_hash TEXT,
  country TEXT,
  browser_family TEXT,
  seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  delete_after TEXT                          -- 90 days after the season ends
);

CREATE TABLE IF NOT EXISTS game_runs (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id),
  season_id TEXT REFERENCES seasons(id),
  game_id TEXT NOT NULL REFERENCES games(id),
  mode TEXT NOT NULL,                        -- daily or free
  seed TEXT,
  rules_version TEXT,                        -- game rules version, so old runs can still be replayed
  log_json TEXT,                             -- the move or choice log; raw logs are deleted after the retention date
  score INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reject_reason TEXT,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  raw_delete_after TEXT
);

-- The authoritative record. Every total comes from here.
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  rule_version_id INTEGER REFERENCES rule_versions(id),
  source_type TEXT,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','reversed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  settled_at TEXT,
  actor TEXT NOT NULL DEFAULT 'system',      -- 'system' or the named admin
  reverses_id INTEGER REFERENCES points_ledger(id)
);

CREATE TABLE IF NOT EXISTS daily_activity (
  player_id TEXT NOT NULL REFERENCES players(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  day TEXT NOT NULL,                         -- UTC date, for example 2027-01-04
  games_played INTEGER NOT NULL DEFAULT 0,
  accepted_runs INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, season_id, day)
);

CREATE TABLE IF NOT EXISTS weekly_summary (
  player_id TEXT NOT NULL REFERENCES players(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  week INTEGER NOT NULL,
  points_json TEXT NOT NULL DEFAULT '{}',    -- points by category
  active_days INTEGER NOT NULL DEFAULT 0,
  rank_band TEXT,
  PRIMARY KEY (player_id, season_id, week)
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id TEXT NOT NULL REFERENCES players(id),
  invitee_id TEXT NOT NULL UNIQUE REFERENCES players(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  qualified_at TEXT,
  still_active_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','held','qualified','rejected'))
);

CREATE TABLE IF NOT EXISTS quest_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  quest_id TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (player_id, season_id, quest_id)
);

CREATE TABLE IF NOT EXISTS contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  type TEXT NOT NULL,
  content TEXT,
  reviewer TEXT,
  tier TEXT CHECK (tier IN ('meets','good','featured')),
  outcome TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS trust_scores (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  score INTEGER NOT NULL DEFAULT 0,
  band TEXT NOT NULL DEFAULT 'new',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS trust_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  type TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_by TEXT,
  resolved_at TEXT,
  outcome TEXT,
  evidence_delete_after TEXT
);

-- Who did what, when and why. Written by code only, never edited.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  reason TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS final_standings (
  season_id TEXT NOT NULL REFERENCES seasons(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  totals_json TEXT NOT NULL,
  rank_band TEXT,
  frozen_at TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (season_id, player_id)
);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  type TEXT NOT NULL CHECK (type IN ('export','delete')),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  outcome TEXT
);

-- Lookups the later stages need.
CREATE INDEX IF NOT EXISTS idx_runs_player_game ON game_runs (player_id, season_id, game_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_runs_status ON game_runs (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_ledger_player ON points_ledger (player_id, season_id, status);
CREATE INDEX IF NOT EXISTS idx_ledger_season_cat ON points_ledger (season_id, category, status);
-- The same source can never pay the same category twice (blocks double awards and replayed requests).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_source ON points_ledger (source_type, source_id, category) WHERE source_id IS NOT NULL AND reverses_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_signals_player ON device_signals (player_id);
CREATE INDEX IF NOT EXISTS idx_signals_device ON device_signals (device_hash);
CREATE INDEX IF NOT EXISTS idx_signals_network ON device_signals (network_hash);
CREATE INDEX IF NOT EXISTS idx_flags_open ON trust_flags (resolved_at, player_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log (target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_players_joined ON players (joined_at);

-- Starting rows. Season 1 has NO dates yet on purpose.
INSERT OR IGNORE INTO seasons (id, name, status) VALUES ('season-1', 'Season 1', 'draft');
INSERT OR IGNORE INTO games (id, title, adapter, status) VALUES ('moon-brew', 'Moon Brew', 'moon-brew', 'beta');
INSERT OR IGNORE INTO games (id, title, adapter, status) VALUES ('scam-lab', 'Scam Lab', 'scam-lab', 'beta');
INSERT OR IGNORE INTO games (id, title, adapter, status) VALUES ('full-moon', 'Full Moon', 'full-moon', 'beta');
INSERT OR IGNORE INTO games (id, title, adapter, status) VALUES ('night-shift', 'Night Shift', NULL, 'parked');
INSERT OR IGNORE INTO games (id, title, adapter, status) VALUES ('coffee-rush', 'Coffee Rush', NULL, 'planned');
INSERT OR IGNORE INTO season_games (season_id, game_id) VALUES ('season-1', 'moon-brew');
INSERT OR IGNORE INTO season_games (season_id, game_id) VALUES ('season-1', 'scam-lab');
INSERT OR IGNORE INTO season_games (season_id, game_id) VALUES ('season-1', 'full-moon');

INSERT OR IGNORE INTO schema_migrations (version, name) VALUES ('0001', 'init');
