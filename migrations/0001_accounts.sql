-- Toddy accounts, step 1: players, sessions, guest links.
-- Run once on the D1 database (see server/README.md).
CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,            -- random internal id (never the Google id)
  google_sub    TEXT NOT NULL UNIQUE,        -- Google's anonymous account id
  email         TEXT NOT NULL,
  name          TEXT,                        -- name as Google gave it; owner-only, never shown to players
  nickname      TEXT,                        -- what other players may see
  nickname_key  TEXT UNIQUE,                 -- lower-case nickname, for "already taken" checks
  avatar        INTEGER NOT NULL DEFAULT 0,  -- which Toddy avatar picture
  show_on_boards INTEGER NOT NULL DEFAULT 1, -- 0 = hide me from leaderboards
  consent_at    INTEGER NOT NULL,            -- when they agreed to what we store (unix seconds)
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,              -- sha-256 of the cookie value; the cookie itself is never stored
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_player ON sessions(player_id);
CREATE TABLE IF NOT EXISTS anon_links (      -- which guest browser ids belong to which player
  anon_id     TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  linked_at   INTEGER NOT NULL
);
