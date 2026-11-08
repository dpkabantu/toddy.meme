-- Accounts step 2: one saved-progress blob per player per game (merged by the game before it is saved).
CREATE TABLE IF NOT EXISTS progress (
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,                 -- 'moon-brew' | 'full-moon' | 'scam-lab'
  data       TEXT NOT NULL,                 -- JSON, at most 64 KB
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, game)
);
