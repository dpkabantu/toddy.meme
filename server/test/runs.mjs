// End-to-end tests of runs and points through the real Worker code, with SQLite instead of D1.
// Run: node --no-warnings server/test/runs.mjs      (Not run on Cloudflare itself: only the preview does that.)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handle } from '../index.js';
import { fakeD1 } from './fake-d1.mjs';
import { sha256Hex } from '../lib/util.js';
import * as FM from '../games/full-moon-core.js';
import { generate, newGame, tap, hint, canRoll, frozen } from '../../games/moon-brew/src/core.js';
import { dailyConfig } from '../../games/moon-brew/src/levels.js';
import { planAwards, planUpgrade } from '../points.js';
import { RULES } from '../rules.js';
import { nightKey, nightEndMs } from '../clock.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let bad = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) bad++; };
const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON');
const migDir = path.join(here, '..', 'migrations');
for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(path.join(migDir, f), 'utf8'));
let NOW = Date.parse('2026-12-08T13:30:00Z');
const env = { DB: fakeD1(db), ID_SALT: 'salt', __NOW: () => NOW };
const ORIGIN = 'https://toddy.meme';

async function mkPlayer(id, name, status = 'active') {
  db.prepare("INSERT INTO players (id, username, status) VALUES (?1, ?2, ?3)").run(id, name, status);
  const tok = 'tok-' + id + '-xxxxxxxxxxxxxxxxxxxxxxxx';
  db.prepare('INSERT INTO sessions (token_hash, player_id, created_at, expires_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?3)').run(await sha256Hex(tok), id, NOW, NOW + 30 * 86400000);
  return '__Host-tp_session=' + tok;
}
const post = async (p, body, cookie, extra = {}) => { const r = await handle(new Request(ORIGIN + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Requested-With': 'toddy-passport', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: JSON.stringify(body) }), env); return { status: r.status, body: await r.json() }; };
const get = async (p, cookie) => { const r = await handle(new Request(ORIGIN + p, { headers: cookie ? { Cookie: cookie } : {} }), env); return { status: r.status, body: await r.json() }; };

// bots that make real, valid logs
let sr = 987654; const rnd = () => (sr = (sr * 1664525 + 1013904223) >>> 0) / 4294967296;
function fullMoonRun(night) {
  const seed = FM.dateSeed(new Date(night + 'T12:00:00Z')), tw = FM.twistForDate(seed), s = FM.newGame(seed, tw), drops = [];
  while (!s.over && s.tick < 40000) { if (FM.canDrop(s) && rnd() < 0.5) { const x = Math.floor(FM.FIELD.L + rnd() * (FM.FIELD.R - FM.FIELD.L)); if (FM.drop(s, x)) drops.push([s.tick, x]); } FM.step(s); s.events.length = 0; }
  return { drops, endTick: s.tick, score: s.score, seconds: s.tick / 60 };
}
function brewBurnRun(night) { const g = newGame(generate(dailyConfig(new Date(night + 'T12:00:00Z')))); let t = 1000, guard = 0;
  while (g.status === 'playing' && guard++ < 300) { let b = g.beans.find((x) => !x.gone && x.awake && !frozen(g, x) && !canRoll(g, x)); if (!b) b = hint(g); if (!b) break; tap(g, b, t); t += 900; }
  return { log: g.log, seconds: t / 1000, status: g.status }; }
function brewRun(night) { const g = newGame(generate(dailyConfig(new Date(night + 'T12:00:00Z')))); let t = 1000; while (g.status === 'playing') { const b = hint(g); if (!b) break; tap(g, b, t); t += 900; } return { log: g.log, seconds: t / 1000 }; }
const ledgerSum = (id) => db.prepare("SELECT COALESCE(SUM(amount),0) s FROM points_ledger WHERE player_id = ?1 AND status IN ('settled','pending')").get(id).s;

// ---- planAwards on its own (the arithmetic) ----
{
  const base = { game: 'moon-brew', band: 3, gamePointsWeek: 0, nightsBefore: 0, gameNights: {}, have: new Set(), seasonTotal: 0, isNewNight: true };
  let p = planAwards(RULES, base); check(p.map((x) => x.amount).join() === '20,12', 'plan: Gold night gives 20 + active night 12');
  p = planAwards(RULES, { ...base, band: 0, isNewNight: false }); check(p.length === 1 && p[0].amount === 8, 'plan: just playing (band 0) gives 8, no second active-night bonus');
  p = planAwards(RULES, { ...base, gamePointsWeek: 130 }); check(p[0].amount === 10 && /weekly limit/.test(p[0].reason), 'plan: weekly limit per game cuts 20 to 10 when 130 are already earned');
  p = planAwards(RULES, { ...base, gamePointsWeek: 140 }); check(!p.some((x) => x.key === 'run') && p.some((x) => x.key === 'active_night'), 'plan: at the weekly limit the game gives 0 but the active night still counts');
  p = planAwards(RULES, { ...base, nightsBefore: 4 }); check(p.some((x) => x.key === 'consistency5' && x.amount === 40), 'plan: 5th night of the week gives +40');
  p = planAwards(RULES, { ...base, nightsBefore: 6, have: new Set(['consistency5']) }); check(p.some((x) => x.key === 'consistency7' && x.amount === 20) && !p.some((x) => x.key === 'consistency5'), 'plan: 7th night gives +20 more (60 in total), 5-night bonus never twice');
  p = planAwards(RULES, { ...base, gameNights: { 'moon-brew': 2, 'full-moon': 3, 'scam-lab': 3 } }); check(p.some((x) => x.key === 'allrounder' && x.amount === 15), 'plan: All-Rounder +15 when every game has 3 nights');
  p = planAwards(RULES, { ...base, gameNights: { 'moon-brew': 2, 'full-moon': 3 } }); check(!p.some((x) => x.key === 'allrounder'), 'plan: All-Rounder needs ALL three games');
  p = planAwards(RULES, { ...base, seasonTotal: 9995 }); check(p.reduce((a, x) => a + x.amount, 0) === 5, 'plan: nobody can pass the season maximum (10,000)');
}

{
  const u = planUpgrade(RULES, { game: 'moon-brew', band: 3, awardedNight: 8, gamePointsWeek: 8, seasonTotal: 20 }); check(u && u.amount === 12, 'upgrade plan: Played (8) to Gold (20) pays only the 12 difference');
  check(planUpgrade(RULES, { game: 'moon-brew', band: 3, awardedNight: 20, gamePointsWeek: 20, seasonTotal: 20 }) === null, 'upgrade plan: nothing more to pay at the top band');
  check(planUpgrade(RULES, { game: 'moon-brew', band: 3, awardedNight: 8, gamePointsWeek: 138, seasonTotal: 20 }).amount === 2, 'upgrade plan: still respects the weekly limit of the game');
}
// ---- the routes ----
const mira = await mkPlayer('TDY-AAAA0001', 'Mira');
let r = await post('/api/run/start', { game: 'full-moon', night: '2026-12-08' }, null); check(r.status === 401, 'start without signing in: 401');
r = await post('/api/run/start', { game: 'full-moon', night: '2026-12-08' }, mira, { Origin: 'https://evil.example' }); check(r.status === 403, 'start from another website: 403');
r = await post('/api/run/start', { game: 'scam-lab', night: '2026-12-08' }, mira); check(r.status === 400 && r.body.error === 'game_not_supported', 'start for a game not checked yet (Scam Lab): refused cleanly');
r = await post('/api/run/start', { game: 'full-moon', night: '2026-12-07' }, mira); check(r.status === 409 && r.body.error === 'clock_off' && r.body.night === '2026-12-08', 'start with the wrong night (device clock off): told the real night');

// Full Moon run 1 (counts)
const fm1 = fullMoonRun('2026-12-08');
r = await post('/api/run/start', { game: 'full-moon', night: '2026-12-08' }, mira); const id1 = r.body.runId; check(r.status === 200 && /^run_/.test(id1), 'Full Moon: run started');
let res = await post('/api/run/finish', { runId: id1, drops: fm1.drops, endTick: fm1.endTick, score: fm1.score }, mira);
check(res.status === 422 && res.body.error === 'too_fast', 'Full Moon: finishing at once (faster than real time) is refused');
check(db.prepare("SELECT status FROM game_runs WHERE id=?").get(id1).status === 'rejected' && ledgerSum('TDY-AAAA0001') === 0, 'Full Moon: refused run left no points');
r = await post('/api/run/start', { game: 'full-moon', night: '2026-12-08' }, mira); const id2 = r.body.runId;
NOW += fm1.seconds * 1000 + 1000;
res = await post('/api/run/finish', { runId: id2, drops: fm1.drops, endTick: fm1.endTick, score: fm1.score + 5 }, mira); check(res.status === 422 && res.body.error === 'mismatch', 'Full Moon: a claimed score that is wrong is refused');
r = await post('/api/run/start', { game: 'full-moon', night: '2026-12-08' }, mira); const id3 = r.body.runId; NOW += fm1.seconds * 1000 + 1000;
res = await post('/api/run/finish', { runId: id3, drops: fm1.drops, endTick: fm1.endTick, score: fm1.score }, mira);
check(res.status === 200 && res.body.counted && res.body.score === fm1.score, 'Full Moon: honest run accepted and counted, score ' + fm1.score + ', ' + res.body.bandName);
const first = res.body; const expectFirst = first.points.items.reduce((a, x) => a + x.amount, 0);
check(first.points.total === expectFirst && ledgerSum('TDY-AAAA0001') === expectFirst && first.points.items.some((x) => x.label === 'Active night'), 'Full Moon: ledger holds exactly what was shown (' + expectFirst + ' points)');
check(db.prepare('SELECT rule_version_id FROM points_ledger LIMIT 1').get().rule_version_id > 0, 'every point row names its rules version');
res = await post('/api/run/finish', { runId: id3, drops: fm1.drops, endTick: fm1.endTick }, mira); check(res.status === 404, 'sending the same run twice: second one refused');
// a second Full Moon run the same night: no points
r = await post('/api/run/start', { game: 'full-moon', night: '2026-12-08' }, mira); check(r.status === 200 && (typeof r.body.runId === "string" || r.body.alreadyCounted === true), 'Full Moon: a second run the same night is allowed unless the top band is already reached');
// another player cannot use mira's open run
const noor = await mkPlayer('TDY-AAAA0002', 'Noor');
const stolen = (await post('/api/run/start', { game: 'moon-brew', night: '2026-12-08' }, mira)).body.runId;
const brew = brewRun('2026-12-08'); NOW += brew.seconds * 1000 + 1000;
res = await post('/api/run/finish', { runId: stolen, log: brew.log }, noor); check(res.status === 404, 'another player cannot finish my run');
res = await post('/api/run/finish', { runId: stolen, log: brew.log }, mira);
check(res.status === 200 && res.body.counted && res.body.points.items.length === 1 && !res.body.points.items.some((x) => x.label === 'Active night'), 'Moon Brew: counted, active night is NOT paid twice on the same night');
const t1 = ledgerSum('TDY-AAAA0001');
// Tampered Moon Brew log
const stolen2 = (await post('/api/run/start', { game: 'moon-brew', night: '2026-12-08' }, noor)).body.runId; NOW += brew.seconds * 1000 + 1000;
res = await post('/api/run/finish', { runId: stolen2, log: brew.log.map((e, i) => (i === 1 ? [e[0], e[1], e[2] - 5] : e)).slice(0, -1) }, noor); check(res.status === 422, 'Moon Brew: an edited log is refused (' + res.body.error + ')');
check(ledgerSum('TDY-AAAA0002') === 0, 'refused runs earn nothing');
// A lost Moon Brew try counts as played (band 0); a later win pays only the difference
NOW = Date.parse('2026-12-10T14:00:00Z'); const up = await mkPlayer('TDY-AAAA0006', 'Upg');
const burnt = brewBurnRun('2026-12-10'); check(burnt.status === 'burnt', 'test helper: the lost try really burns the tray');
let us = (await post('/api/run/start', { game: 'moon-brew', night: '2026-12-10' }, up)).body.runId; NOW += burnt.seconds * 1000 + 1000;
res = await post('/api/run/finish', { runId: us, log: burnt.log }, up); check(res.status === 200 && res.body.counted && res.body.band === 0 && res.body.points.total === 20, 'lost Moon Brew try: counted as played, 8 + 12 active night = 20');
us = (await post('/api/run/start', { game: 'moon-brew', night: '2026-12-10' }, up)).body.runId; check(typeof us === 'string', 'after a lost try the player can start again');
const win = brewRun('2026-12-10'); NOW += win.seconds * 1000 + 1000; res = await post('/api/run/finish', { runId: us, log: win.log }, up);
check(res.status === 200 && res.body.counted && res.body.upgraded && res.body.points.total === 12 && ledgerSum('TDY-AAAA0006') === 32, 'win after a lost try: pays the 12 difference only (night total 32, never double)');
r = await post('/api/run/start', { game: 'moon-brew', night: '2026-12-10' }, up); check(r.body.alreadyCounted === true, 'top band reached: no more points tonight for this game');
db.prepare("UPDATE run_meta SET flags=flags WHERE 1=0").run();
// Dashboard
NOW = Date.parse('2026-12-08T14:30:00Z') + 20 * 60000 * 0 + 3600000 * 0;
let dash = await get('/api/me/points', mira);
check(dash.status === 200 && dash.body.points.season === t1 && dash.body.points.week === t1 && dash.body.streak.current === 1 && dash.body.games.length === 3, 'dashboard: totals match the ledger (' + t1 + '), streak 1');
check(dash.body.games.find((g) => g.id === 'full-moon').playedTonight && dash.body.games.find((g) => g.id === 'moon-brew').playedTonight && !dash.body.games.find((g) => g.id === 'scam-lab').playedTonight, 'dashboard: tonight shows which games are done');
check((await get('/api/me/points', null)).status === 401, 'dashboard needs sign-in');
{ const si = await get('/api/season', null); check(si.status === 200 && si.body.night.key === '2026-12-08' && si.body.games.length === 3 && si.body.games.find((g) => g.id === 'scam-lab').ready === false && si.body.rules.bandPoints.join() === '8,12,16,20' && si.body.season.status === 'draft' && !JSON.stringify(si.body).includes('TDY-'), 'public /api/season: works without sign-in, shows the night, games and rules, nothing personal'); }
check(/cash value/.test(dash.body.note), 'dashboard states points have no cash value');

// A full week: 7 nights, Mira plays both ready games each night (Scam Lab not built yet), Noor never plays. All-Rounder cannot happen without Scam Lab.
let totalClaimed = t1;
for (let d = 0; d < 7; d++) {
  NOW = Date.parse('2026-12-14T13:30:00Z') + d * 86400000;; const night = nightKey(NOW);   // Monday night to Sunday night of one full week
  for (const game of ['full-moon', 'moon-brew']) {
    const sid = (await post('/api/run/start', { game, night }, mira)).body.runId;
    const run = game === 'full-moon' ? fullMoonRun(night) : brewRun(night); NOW += run.seconds * 1000 + 1000;
    const out = await post('/api/run/finish', { runId: sid, ...(game === 'full-moon' ? { drops: run.drops, endTick: run.endTick, score: run.score } : { log: run.log }) }, mira);
    if (!(out.status === 200 && out.body.counted)) { check(false, 'week: ' + game + ' night ' + night + ' failed: ' + JSON.stringify(out.body)); }
    totalClaimed += out.body.points ? out.body.points.total : 0;
  }
}
const bonuses = db.prepare("SELECT source_type, SUM(amount) a, COUNT(*) c FROM points_ledger WHERE player_id='TDY-AAAA0001' AND source_type IN ('consistency5','consistency7','allrounder','active_night') GROUP BY source_type").all().reduce((o, x) => ({ ...o, [x.source_type]: x }), {});
check(bonuses.active_night.c === 8 && bonuses.active_night.a === 96, 'week: active night paid once per night (1 earlier + 7 this week = 8)');
check(bonuses.consistency5.c === 1 && bonuses.consistency5.a === 40 && bonuses.consistency7.c === 1 && bonuses.consistency7.a === 20, 'week: consistency bonuses paid once each (40 + 20 = 60)');
check(!bonuses.allrounder, 'week: no All-Rounder without Scam Lab (needs all three games)');
check(ledgerSum('TDY-AAAA0001') === totalClaimed, 'week: ledger total equals the sum of what each finish reported (' + totalClaimed + ')');
const wk = db.prepare("SELECT game_id, week, SUM(points) p FROM run_meta WHERE player_id='TDY-AAAA0001' AND counted=1 GROUP BY game_id, week").all();
check(wk.every((x) => x.p <= RULES.weeklyCapPerGame), 'week: no game went over its weekly limit (' + wk.map((x) => x.game_id + ' ' + x.week + '=' + x.p).join(', ') + ')');
dash = await get('/api/me/points', mira);
check(dash.body.streak.current === 7 && dash.body.streak.last7.every((x) => x.played), 'dashboard: 7-night streak shows');

// Night boundary and grace
NOW = Date.parse('2026-12-20T12:50:00Z');                           // night 12-19 is nearly over
const nb = await mkPlayer('TDY-AAAA0003', 'Late');
const sid = (await post('/api/run/start', { game: 'moon-brew', night: '2026-12-19' }, nb)).body.runId; const run19 = brewRun('2026-12-19');
NOW = Date.parse('2026-12-20T13:05:00Z'); res = await post('/api/run/finish', { runId: sid, log: run19.log }, nb);
check(res.status === 200 && res.body.counted && db.prepare('SELECT night_key FROM run_meta WHERE run_id=?').get(sid).night_key === '2026-12-19', 'a run started before 13:00 UTC and finished a few minutes after still counts for the night it started');
NOW = Date.parse('2026-12-19T20:00:00Z'); const sid2 = (await post('/api/run/start', { game: 'full-moon', night: '2026-12-19' }, nb)).body.runId; NOW = nightEndMs('2026-12-19') + 21 * 60000;
res = await post('/api/run/finish', { runId: sid2, drops: [[0, 400]], endTick: 10 }, nb); check(res.status === 422 && res.body.error === 'night_over', 'finishing more than 20 minutes after the night ended is refused');

// Held player: points wait
NOW = Date.parse('2026-12-21T14:00:00Z'); const hd = await mkPlayer('TDY-AAAA0004', 'Held', 'held');
const hs = (await post('/api/run/start', { game: 'moon-brew', night: '2026-12-21' }, hd)).body.runId; const hb = brewRun('2026-12-21'); NOW += hb.seconds * 1000 + 1000;
res = await post('/api/run/finish', { runId: hs, log: hb.log }, hd);
check(res.body.counted && res.body.held && db.prepare("SELECT status FROM points_ledger WHERE player_id='TDY-AAAA0004'").all().every((x) => x.status === 'pending'), 'a player under review: points are recorded as pending, not settled');
dash = await get('/api/me/points', hd); check(dash.body.points.season === 0 && dash.body.points.pending > 0, 'dashboard shows pending points separately');

// Kill switch
db.prepare("UPDATE settings SET value='0' WHERE key='points_enabled'").run();
NOW = Date.parse('2026-12-22T14:00:00Z'); const ks = await mkPlayer('TDY-AAAA0005', 'Switch');
const ks1 = (await post('/api/run/start', { game: 'moon-brew', night: '2026-12-22' }, ks)).body.runId; const kb = brewRun('2026-12-22'); NOW += kb.seconds * 1000 + 1000;
res = await post('/api/run/finish', { runId: ks1, log: kb.log }, ks); check(res.status === 200 && res.body.counted === false && res.body.reason === 'points_paused' && ledgerSum('TDY-AAAA0005') === 0, 'kill switch: runs are kept, no points are given');
db.prepare("UPDATE settings SET value='1' WHERE key='points_enabled'").run();

// Season closed
db.prepare("UPDATE seasons SET status='closed' WHERE id='season-1'").run(); NOW += 86400000;
r = await post('/api/run/start', { game: 'moon-brew', night: nightKey(NOW) }, ks); check(r.status === 409 && r.body.error === 'season_closed', 'closed season: no new runs');
db.prepare("UPDATE seasons SET status='draft' WHERE id='season-1'").run();

// Bad input
r = await post('/api/run/finish', { runId: 5 }, mira); check(r.status === 400, 'finish with a wrong type: 400');
const big = await handle(new Request(ORIGIN + '/api/run/finish', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Requested-With': 'toddy-passport', Cookie: mira }, body: JSON.stringify({ runId: 'x', pad: 'a'.repeat(130000) }) }), env); check(big.status === 400, 'oversized body refused');
r = await post('/api/run/finish', { runId: "x'; DROP TABLE points_ledger;--" }, mira); check(r.status === 404 && db.prepare('SELECT COUNT(*) c FROM points_ledger').get().c > 0, 'SQL text in a field is only data (table still there)');
check(db.prepare("SELECT COUNT(*) c FROM game_runs WHERE log_json IS NOT NULL AND raw_delete_after IS NULL").get().c === 0, 'every stored move log has a deletion date');

console.log(bad ? 'PROBLEMS: ' + bad : 'runs and points ok'); if (bad) process.exitCode = 1;
