-- Stage 3: runs sent by the games, and the switch that can stop points. Safe to run twice.

-- Small owner-controlled switches. points_enabled = 0 stops all new points at once (kill switch).
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('points_enabled', '1');

-- One row per daily run the server has seen, next to its game_runs row. Everything the owner filters by is here.
CREATE TABLE IF NOT EXISTS run_meta (
  run_id TEXT PRIMARY KEY REFERENCES game_runs(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  game_id TEXT NOT NULL REFERENCES games(id),
  night_key TEXT NOT NULL,                   -- the night this run belongs to, for example 2026-12-08 (13:00 UTC to 13:00 UTC)
  week TEXT NOT NULL,                        -- for example 2026-W50
  started_ms INTEGER NOT NULL,
  finished_ms INTEGER,
  band INTEGER,                              -- 0 played, 1 bronze, 2 silver, 3 gold
  counted INTEGER NOT NULL DEFAULT 0,        -- 1 = this is the run that earns points for this game on this night
  points INTEGER NOT NULL DEFAULT 0,         -- gameplay points this run earned
  replay_ms INTEGER,                         -- how long the server check took
  flags TEXT                                 -- short notes such as too_fast
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_run_counted ON run_meta (player_id, game_id, night_key) WHERE counted = 1;
CREATE INDEX IF NOT EXISTS idx_run_meta_player ON run_meta (player_id, night_key);
CREATE INDEX IF NOT EXISTS idx_run_meta_week ON run_meta (week, game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_run_meta_open ON run_meta (finished_ms, started_ms);

INSERT OR IGNORE INTO schema_migrations (version, name) VALUES ('0003', 'runs');
