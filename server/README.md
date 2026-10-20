# server/ — TODDY Seasons server (Cloudflare Worker)

Answers only `toddy.meme/api/*`. Every other address is the static site (see `wrangler.jsonc`, `run_worker_first`).

- `index.js` — the Worker. Stage 1: `GET /api/health` only.
- `migrations/NNNN_name.sql` — database changes, numbered. Never edit a migration that has been applied; add the next number. Each file must be safe to run twice (`IF NOT EXISTS`, `INSERT OR IGNORE`) and must end by recording itself in `schema_migrations`.
- `test/run.mjs` — `node server/test/run.mjs`. Uses real SQLite as a stand-in for Cloudflare D1 (needs Node 22). It does not run Cloudflare's own runtime.

Rules: no secrets in this repository (Cloudflare secrets only), no cookies in Stage 1, JSON answers are never cached, and raw scores of different games are never added together.
Seasons, games and their point settings are rows in the database, not code, so a new season or game does not need a rebuild.
