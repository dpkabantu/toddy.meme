// Tests for the Season server, Stage 1. Run: node server/test/run.mjs
// Uses real SQLite (node:sqlite) as a stand-in for Cloudflare D1. It checks the SQL and the Worker code.
// It does NOT run Cloudflare's own runtime; only the Cloudflare preview shows that.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handle, EXPECTED_TABLES, EXPECTED_SCHEMA } from '../index.js';
import { toPaste } from '../make-paste.mjs';
import { fakeD1 } from './fake-d1.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.join(here, '..', 'migrations');
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
check(files[0] === '0001_init.sql' && files.every((f, i) => f.startsWith(String(i + 1).padStart(4, '0'))), 'migration files are numbered without gaps: ' + files.join(', '));
const sql = files.map((f) => readFileSync(path.join(migDir, f), 'utf8')).join('\n');

const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON');
db.exec(sql); db.exec(sql);                               // twice in a row must not break
check(true, 'migration applies, and applies again without error');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
check(EXPECTED_TABLES.every((t) => tables.includes(t)) && tables.length === EXPECTED_TABLES.length, 'tables match the list the Worker expects (' + tables.length + ')');
check(db.prepare('SELECT COUNT(*) c FROM schema_migrations').get().c === files.length, 'schema_migrations has one row per migration after two runs');
const s1 = db.prepare("SELECT * FROM seasons WHERE id='season-1'").get();
check(s1 && s1.starts_at === null && s1.ends_at === null && s1.status === 'draft', 'Season 1 exists with NO dates (launch date still open)');
check(db.prepare('SELECT COUNT(*) c FROM season_games WHERE season_id=?').get('season-1').c === 3, 'Season 1 lists the 3 live games');
check(db.prepare("SELECT status FROM games WHERE id='night-shift'").get().status === 'parked', 'Night Shift is parked');
check(db.prepare('SELECT COUNT(*) c FROM players').get().c === 0 && db.prepare('SELECT COUNT(*) c FROM points_ledger').get().c === 0, 'no player or points rows are created by the migration');

// The paste-safe copy for the dashboard Console must build the very same database
for (const f of files) {
  const pf = readFileSync(path.join(here, '..', 'paste', f.replace('.sql', '.paste.sql')), 'utf8');
  check(pf === toPaste(readFileSync(path.join(migDir, f), 'utf8')), 'paste file for ' + f + ' is up to date (run: node server/make-paste.mjs)');
  check(!/--/.test(pf) && pf.trim().split('\n').length === 1, 'paste file for ' + f + ' has no comments and is a single line');
}
const dbP = new DatabaseSync(':memory:');
for (const f of files) dbP.exec(readFileSync(path.join(here, '..', 'paste', f.replace('.sql', '.paste.sql')), 'utf8'));
const shape = (d) => JSON.stringify(d.prepare("SELECT type,name,tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()) + JSON.stringify(['seasons','games','season_games','schema_migrations','terms_versions'].map((t) => d.prepare('SELECT COUNT(*) c FROM ' + t).get().c));
check(shape(dbP) === shape(db), 'paste versions build exactly the same tables, indexes and starting rows');

// Rules the data must enforce
const throws = (f) => { try { f(); return false; } catch (e) { return true; } };
db.prepare("INSERT INTO players (id, username) VALUES ('TDY-AAAA0001','Mira')").run();
check(throws(() => db.prepare("INSERT INTO players (id, username) VALUES ('TDY-AAAA0002','mira')").run()), 'usernames are unique, ignoring capital letters');
check(throws(() => db.prepare("INSERT INTO players (id, status) VALUES ('TDY-AAAA0003','banana')").run()), 'player status only takes allowed words');
const award = () => db.prepare("INSERT INTO points_ledger (player_id, season_id, category, amount, reason, source_type, source_id) VALUES ('TDY-AAAA0001','season-1','gameplay',40,'daily run','game_run','run-1')").run();
award();
check(throws(award), 'the same run cannot pay the same category twice');
db.prepare("INSERT INTO points_ledger (player_id, season_id, category, amount, reason, source_type, source_id, reverses_id) VALUES ('TDY-AAAA0001','season-1','gameplay',-40,'reversal','game_run','run-1',1)").run();
check(true, 'a reversal of that award is allowed');
check(throws(() => db.prepare("INSERT INTO points_ledger (player_id, season_id, category, amount, reason) VALUES ('TDY-NOBODY','season-1','gameplay',1,'x')").run()), 'points need a real player (no orphans)');
check(throws(() => db.prepare("INSERT INTO game_runs (id, game_id, mode, status) VALUES ('r2','full-moon','daily','maybe')").run()), 'run status only takes allowed words');
check(throws(() => db.prepare("INSERT INTO game_runs (id, game_id, mode) VALUES ('r3','no-such-game','daily')").run()), 'runs need a game from the registry');

// Worker behaviour
const env = { DB: fakeD1(db), ASSETS: { fetch: async () => new Response('static', { status: 200 }) } };
const req = (p, m = 'GET') => new Request('https://toddy.meme' + p, { method: m });
let r = await handle(req('/api/health'), env); let b = await r.json();
check(r.status === 200 && b.ok && b.db === 'connected' && b.schema === EXPECTED_SCHEMA && b.missing.length === 0, 'health: 200, database connected, schema ' + b.schema);
check(r.headers.get('cache-control') === 'no-store' && r.headers.get('x-content-type-options') === 'nosniff' && /application\/json/.test(r.headers.get('content-type')), 'health: JSON, no-store, nosniff');
check(!('set-cookie' in Object.fromEntries(r.headers)), 'health: sets no cookies');
r = await handle(req('/api/health/'), env); check(r.status === 200, 'health: trailing slash works');
r = await handle(req('/api/health', 'HEAD'), env); check(r.status === 200 && (await r.text()) === '', 'health: HEAD has no body');
r = await handle(req('/api/health', 'POST'), env); check(r.status === 405 && /GET/.test(r.headers.get('allow')), 'health: POST gets 405 with Allow');
r = await handle(req('/api/nothing'), env); b = await r.json(); check(r.status === 404 && b.error === 'not_found', '/api/nothing: JSON 404');
r = await handle(req('/api'), env); check(r.status === 404, '/api: JSON 404');
r = await handle(req('/games/full-moon/'), env); check((await r.text()) === 'static', 'non-API address falls through to the static site');
r = await handle(req('/api/health'), { ASSETS: env.ASSETS }); b = await r.json(); check(r.status === 503 && b.db === 'not configured', 'no database bound: 503 "not configured", no crash');
const broken = { prepare() { throw new Error('secret table name leak'); } };
r = await handle(req('/api/health'), { DB: broken }); const txt = await r.text();
check(r.status === 503 && !/secret/.test(txt), 'database error: 503 and the error text is not shown to the caller');
const old = new DatabaseSync(':memory:'); old.exec('CREATE TABLE schema_migrations (version TEXT, name TEXT, applied_at TEXT)');
r = await handle(req('/api/health'), { DB: fakeD1(old) }); b = await r.json(); check(r.status === 503 && !b.ok && b.missing.length > 0, 'half-built database: 503 and lists what is missing');

console.log(bad ? 'PROBLEMS: ' + bad : 'server tests ok'); if (bad) process.exitCode = 1;
