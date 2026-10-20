-- TODDY Seasons: migration 0002 (sign-in, sessions, usernames). Safe to run twice.

-- One row per started Google sign-in. Single use, expires after 10 minutes.
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

-- Google said who they are, but they have not finished joining yet (18+ tick, terms, username). Expires after 30 minutes.
CREATE TABLE IF NOT EXISTS pending_signups (
  token_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Logged-in browsers. Only a hash of the cookie value is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions (player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

-- The contact email lives apart from everything else so "delete my data" is one clean step.
CREATE TABLE IF NOT EXISTS player_contacts (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS terms_versions (
  version TEXT PRIMARY KEY,
  published_at TEXT NOT NULL,
  note TEXT
);

-- Usernames. key = the name with capitals, underscores and look-alike digits removed, so Mira, mira and M_ira are one name.
-- When someone changes their name, the old name stays reserved for them (reserved_until) so nobody can grab it at once.
CREATE TABLE IF NOT EXISTS username_claims (
  key TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  display TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  claimed_at INTEGER NOT NULL,
  reserved_until INTEGER
);
CREATE INDEX IF NOT EXISTS idx_claims_player ON username_claims (player_id, is_current);

-- Simple counters that slow down abuse (sign-in starts, sign-ups, renames).
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

INSERT OR IGNORE INTO terms_versions (version, published_at, note) VALUES ('2026-10-draft', '2026-10-20T00:00:00.000Z', 'Draft terms for the Season 1 rehearsal. Replaced before public launch.');
INSERT OR IGNORE INTO schema_migrations (version, name) VALUES ('0002', 'auth');
