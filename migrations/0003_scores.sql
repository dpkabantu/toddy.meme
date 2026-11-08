-- Accounts step 4: one best Daily score per player, per game, per day (UTC). Weekly and Monthly boards take the best day in the period.
CREATE TABLE IF NOT EXISTS scores (
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  day        INTEGER NOT NULL,              -- YYYYMMDD (UTC)
  score      INTEGER NOT NULL,
  created_at INTEGER NOT NULL,              -- first time this score was saved (breaks ties: earlier wins)
  PRIMARY KEY (player_id, game, day)
);
CREATE INDEX IF NOT EXISTS scores_board ON scores(game, day, score DESC);
