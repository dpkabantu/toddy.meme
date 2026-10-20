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
import { dailyConfig, seasonTrayConfig } from '../../games/moon-brew/src/levels.js';
import { dailyCase } from '../../games/scam-lab/src/daily.js';
import { scoreDaily, strongClues, scoreCase, scoreRush } from '../../games/scam-lab/src/engine.js';
import { CASES as LAB } from '../games/scam-lab-cases.js';
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
function scamRun(night) { const c = dailyCase(night); const marks = {}; strongClues(c).forEach((k) => { marks[k] = 'flag'; }); const seconds = 40; return { marks, decision: c.best_action, seconds, score: scoreDaily(c, { marks, decision: c.best_action, seconds }).total, stars: scoreDaily(c, { marks, decision: c.best_action, seconds }).stars }; }
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
r = await post('/api/run/start', { game: 'coffee-rush', night: '2026-12-08' }, mira); check(r.status === 400 && r.body.error === 'game_not_supported', 'start for a game that is not connected (made-up id): refused cleanly');
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
{ const si = await get('/api/season', null); check(si.status === 200 && si.body.night.key === '2026-12-08' && si.body.games.length === 3 && si.body.games.find((g) => g.id === 'scam-lab').ready === true && si.body.rules.bandPoints.join() === '8,12,16,20' && si.body.season.status === 'draft' && !JSON.stringify(si.body).includes('TDY-'), 'public /api/season: works without sign-in, shows the night, games and rules, nothing personal'); }
check(/cash value/.test(dash.body.note), 'dashboard states points have no cash value');

// A full week: 7 nights, Mira plays all three games each night, Noor never plays. All-Rounder is paid once.
let totalClaimed = t1;
for (let d = 0; d < 7; d++) {
  NOW = Date.parse('2026-12-14T13:30:00Z') + d * 86400000;; const night = nightKey(NOW);   // Monday night to Sunday night of one full week
  for (const game of ['full-moon', 'moon-brew', 'scam-lab']) {
    const sid = (await post('/api/run/start', { game, night }, mira)).body.runId;
    const run = game === 'full-moon' ? fullMoonRun(night) : game === 'scam-lab' ? scamRun(night) : brewRun(night); NOW += run.seconds * 1000 + 1000;
    const out = await post('/api/run/finish', { runId: sid, ...(game === 'full-moon' ? { drops: run.drops, endTick: run.endTick, score: run.score } : game === 'scam-lab' ? { marks: run.marks, decision: run.decision, seconds: run.seconds, score: run.score } : { log: run.log }) }, mira);
    if (!(out.status === 200 && out.body.counted)) { check(false, 'week: ' + game + ' night ' + night + ' failed: ' + JSON.stringify(out.body)); }
    totalClaimed += out.body.points ? out.body.points.total : 0;
  }
}
const bonuses = db.prepare("SELECT source_type, SUM(amount) a, COUNT(*) c FROM points_ledger WHERE player_id='TDY-AAAA0001' AND source_type IN ('consistency5','consistency7','allrounder','active_night') GROUP BY source_type").all().reduce((o, x) => ({ ...o, [x.source_type]: x }), {});
check(bonuses.active_night.c === 8 && bonuses.active_night.a === 96, 'week: active night paid once per night (1 earlier + 7 this week = 8)');
check(bonuses.consistency5.c === 1 && bonuses.consistency5.a === 40 && bonuses.consistency7.c === 1 && bonuses.consistency7.a === 20, 'week: consistency bonuses paid once each (40 + 20 = 60)');
check(bonuses.allrounder && bonuses.allrounder.c === 1 && bonuses.allrounder.a === 15, 'week: All-Rounder +15 paid once when all three games were played');
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

// ---- Weekly missions: full points in the mission's week, half points after, each stage pays once ----
{
  RULES.startNight = '2027-02-01';
  RULES.missions.push({ id: 'test-m', game: 'full-moon', week: 2, kind: 'weekly-puzzle', title: 'Weekly Challenge', seed: 900300, twist: 2,
    stages: [{ id: 'a', minBand: 0, points: 40, label: 'Played' }, { id: 'b', minBand: 1, points: 10, label: 'Bronze' }] });
  const botW = (rate, sd) => { let q = sd; const rr = () => (q = (q * 1664525 + 1013904223) >>> 0) / 4294967296; const g = FM.newGame(900300, 2), drops = [];
    while (!g.over && g.tick < 40000) { if (FM.canDrop(g) && rr() < rate) { const x = Math.floor(FM.FIELD.L + rr() * (FM.FIELD.R - FM.FIELD.L)); if (FM.drop(g, x)) drops.push([g.tick, x]); } FM.step(g); g.events.length = 0; }
    return { drops, endTick: g.tick, score: g.score, seconds: g.tick / 60, band: FM.bandFor(g.score, 2) }; };
  const weak = botW(0.1, 2), strong = botW(0.1, 1);
  check(weak.band === 0 && strong.band === 1, 'weekly test bots: one run is band 0, the other band 1');
  const missionRows = (id) => db.prepare("SELECT amount, reason, source_id FROM points_ledger WHERE player_id = ?1 AND source_type = 'mission' ORDER BY id").all(id);
  const play = async (cookie, bot, tamper) => {
    const night = nightKey(NOW), st = await post('/api/run/start', { game: 'full-moon', mode: 'weekly', mission: 'test-m', night }, cookie);
    if (!st.body.runId) return { st };
    NOW += bot.seconds * 1000 + 1000;
    const fin = await post('/api/run/finish', { runId: st.body.runId, drops: bot.drops, endTick: bot.endTick, score: tamper ? bot.score + 1 : bot.score }, cookie);
    return { st, fin };
  };
  db.prepare("UPDATE seasons SET status='live' WHERE id='season-1'").run();

  // before the mission opens (the Season is live): locked
  NOW = Date.parse('2027-02-08T12:00:00Z'); const early = await mkPlayer('TDY-AAAA0010', 'Early');
  let pub = await get('/api/season'); check(pub.body.missions.some((m) => m.id === 'test-m' && m.state === 'locked' && m.week === 2), 'public Season info: the mission shows as locked before its week');
  r = await post('/api/run/start', { game: 'full-moon', mode: 'weekly', mission: 'test-m', night: nightKey(NOW) }, early); check(r.status === 409 && r.body.error === 'mission_locked', 'a locked mission cannot be started');

  // on time: both stages at full points, never twice
  NOW = Date.parse('2027-02-09T14:00:00Z'); const ontime = await mkPlayer('TDY-AAAA0011', 'OnTime');
  pub = await get('/api/season'); check(pub.body.missions.some((m) => m.id === 'test-m' && m.state === 'open'), 'public Season info: the mission is open during its week');
  let x = await play(ontime, weak); check(x.fin.status === 200 && x.fin.body.counted && x.fin.body.points.total === 40 && !x.fin.body.late, 'on time: the first stage pays the full 40');
  check(db.prepare("SELECT COUNT(*) c FROM run_meta WHERE player_id='TDY-AAAA0011' AND counted = 1").get().c === 0 && db.prepare("SELECT COUNT(*) c FROM daily_activity WHERE player_id='TDY-AAAA0011'").get().c === 0, 'a weekly run is not a nightly run: no active night, no night medal');
  x = await play(ontime, weak); check(x.fin.body.counted === false, 'playing the same level again pays nothing more');
  x = await play(ontime, strong); check(x.fin.body.counted && x.fin.body.points.total === 10, 'on time: reaching the next stage pays its 10 once');
  x = await play(ontime, strong); check(x.st.body.runId === null && x.st.body.alreadyCounted, 'every stage done: a new try is allowed to start for fun but sends nothing');
  check(ledgerSum('TDY-AAAA0011') === 50 && missionRows('TDY-AAAA0011').length === 2, 'on time total is 50 in two ledger rows');
  const d1 = await get('/api/me/points', ontime); check(d1.body.missions.some((m) => m.id === 'test-m' && m.done && m.stages.every((st) => st.done)) && d1.body.points.season === 50, 'dashboard lists the mission as done and the season total matches');

  // late: half points, rounded down
  NOW = Date.parse('2027-02-16T14:00:00Z'); const late = await mkPlayer('TDY-AAAA0012', 'Late2');
  pub = await get('/api/season'); check(pub.body.missions.some((m) => m.id === 'test-m' && m.state === 'late'), 'public Season info: the mission shows as late after its week');
  x = await play(late, strong); check(x.fin.body.counted && x.fin.body.late && x.fin.body.points.total === 25 && x.fin.body.points.items.every((i) => /late, half points/.test(i.label)), 'late: both stages at half (20 + 5 = 25)');

  // starts in the week, finishes the next week: on-time part full, late part half
  NOW = Date.parse('2027-02-14T10:00:00Z'); const split = await mkPlayer('TDY-AAAA0013', 'Split');
  x = await play(split, weak); check(x.fin.body.points.total === 40, 'split player: stage one on time pays 40');
  NOW = Date.parse('2027-02-16T09:00:00Z');
  x = await play(split, strong); check(x.fin.body.counted && x.fin.body.late && x.fin.body.points.total === 5, 'split player: stage two done after the deadline pays half (5)');
  check(ledgerSum('TDY-AAAA0013') === 45, 'split player total is 45');

  // run that STARTS in time but FINISHES after the deadline is paid by the finish time
  NOW = Date.parse('2027-02-15T12:55:00Z'); const edge = await mkPlayer('TDY-AAAA0014', 'Edge');
  const es = await post('/api/run/start', { game: 'full-moon', mode: 'weekly', mission: 'test-m', night: nightKey(NOW) }, edge);
  NOW = Date.parse('2027-02-15T13:05:00Z');
  const ef = await post('/api/run/finish', { runId: es.body.runId, drops: weak.drops, endTick: weak.endTick, score: weak.score }, edge);
  check(ef.body.counted && ef.body.late && ef.body.points.total === 20, 'started before the deadline but finished after: half points by the finish time');

  // safety
  NOW = Date.parse('2027-02-10T14:00:00Z'); const cheat = await mkPlayer('TDY-AAAA0015', 'Cheat');
  x = await play(cheat, strong, true); check(x.fin.status === 422 && x.fin.body.error === 'mismatch' && ledgerSum('TDY-AAAA0015') === 0, 'a wrong score on a weekly run is refused, no points');
  r = await post('/api/run/start', { game: 'full-moon', mode: 'weekly', mission: 'nope', night: nightKey(NOW) }, cheat); check(r.status === 400 && r.body.error === 'mission_not_found', 'unknown mission is refused');
  r = await post('/api/run/start', { game: 'moon-brew', mode: 'weekly', mission: 'test-m', night: nightKey(NOW) }, cheat); check(r.status === 400, 'a mission cannot be started through another game');
  const hw = await mkPlayer('TDY-AAAA0016', 'HeldW', 'held'); x = await play(hw, weak);
  check(x.fin.body.counted && x.fin.body.held && db.prepare("SELECT status FROM points_ledger WHERE player_id='TDY-AAAA0016'").all().every((y) => y.status === 'pending'), 'a player under review: mission points wait as pending');
  db.prepare("UPDATE settings SET value='0' WHERE key='points_enabled'").run(); const ks2 = await mkPlayer('TDY-AAAA0017', 'Sw2'); x = await play(ks2, weak);
  check(x.fin.body.counted === false && x.fin.body.reason === 'points_paused' && ledgerSum('TDY-AAAA0017') === 0, 'kill switch also stops mission points');
  db.prepare("UPDATE settings SET value='1' WHERE key='points_enabled'").run();
  db.prepare("UPDATE seasons SET status='draft' WHERE id='season-1'").run();
  RULES.missions.pop();
}

// ---- Scam Lab launch mission: Season Chapters (a chapter = 20 cases in order; one chapter opens per day; 15 points every 5 cases) ----
{
  RULES.startNight = '2027-02-22';   // Scam Lab joins in week 2: night 1 opens 1 Mar 13:00 UTC, the week ends 8 Mar 13:00 UTC
  const labLog = (id, over = {}) => {   // what a careful player's game would send for this case
    const c = LAB[id];
    if (c.cards) { const answers = {}; c.cards.forEach((k) => { answers[k.id] = k.scam ? 'scam' : 'safe'; }); const left = Math.floor(c.seconds / 2);
      return { answers, secondsLeft: left, quickAnswer: c.quick_check.answer, seconds: c.seconds - left, score: scoreRush(c, answers, left, c.quick_check.answer).total, ...over }; }
    const marks = {}; strongClues(c).forEach((k) => { marks[k] = 'flag'; });
    const board = c.board ? { verdict: c.board.answer, picks: strongClues(c).slice(0, c.board.pick) } : null;
    const log = { marks, decision: c.best_action, quickAnswer: c.quick_check ? c.quick_check.answer : undefined, seconds: 40, hints: 0, seen: c.duel ? Object.keys(c.clues) : null, board };
    return { ...log, score: scoreCase(c, log).total, ...over };
  };
  const ch1 = Array.from({ length: 20 }, (_, i) => 'c1-' + String(i + 1).padStart(2, '0'));
  const M = 'scam-lab-season';
  const playCase = async (cookie, id, over = {}, wait = 41, mission = M) => {
    const st = await post('/api/run/start', { game: 'scam-lab', mode: 'weekly', mission, case: id, night: nightKey(NOW) }, cookie);
    if (!st.body.runId) return { st };
    NOW += wait * 1000;
    return { st, fin: await post('/api/run/finish', { runId: st.body.runId, ...labLog(id, over) }, cookie) };
  };
  const rows = (id) => db.prepare("SELECT amount FROM points_ledger WHERE player_id = ?1 AND source_type = 'mission' ORDER BY id").all(id).map((x) => x.amount);
  db.prepare("UPDATE seasons SET status='live' WHERE id='season-1'").run();

  NOW = Date.parse('2027-03-02T14:00:00Z'); const a = await mkPlayer('TDY-AAAA0020', 'ChapA');
  const pub = await get('/api/season'); const chm = pub.body.missions.filter((m) => m.game === 'scam-lab');
  check(chm.length === 1 && chm[0].id === M && chm[0].week === 2 && chm[0].cases.length === 140 && chm[0].stages.length === 28 && chm[0].stages.every((st) => st.points === 15) && chm[0].stages.reduce((n, st) => n + st.points, 0) === 420, 'public Season info lists one Scam Lab launch mission in week 2: 7 chapters = 140 cases, 28 checkpoints of 15 = 420 points');
  check(chm[0].state === 'open' && chm[0].nights.length === 7 && chm[0].nights[0].open && chm[0].nights[1].open && !chm[0].nights[2].open, 'one chapter opens per day: on the second day chapters 1 and 2 are open, 3 is not');
  let x = await playCase(a, ch1[0], {}, 41, 'scam-lab-ch1'); check(x.st.status === 400 && x.st.body.error === 'mission_not_found', 'the old one-chapter missions are gone');
  x = await post('/api/run/start', { game: 'scam-lab', mode: 'weekly', mission: M, case: 'c3-01', night: nightKey(NOW) }, a); check(x.status === 409 && x.body.error === 'mission_locked', 'a chapter that has not opened yet is refused');
  x = await post('/api/run/start', { game: 'scam-lab', mode: 'weekly', mission: M, case: 'c8-01', night: nightKey(NOW) }, a); check(x.status === 400 && x.body.error === 'case_not_in_mission', 'a case from a chapter that does not exist is refused');
  x = await playCase(a, ch1[1]); check(x.st.status === 409 && x.st.body.error === 'tray_order', 'case 2 needs case 1 first');
  for (let i = 0; i < 4; i++) x = await playCase(a, ch1[i]);
  check(x.fin.body.counted === false && x.fin.body.progress.cases === 4 && x.fin.body.progress.nightDone === 4 && ledgerSum('TDY-AAAA0020') === RULES.activeNight, '4 cases: counted, no checkpoint yet, only the active-night points (paid once)');
  x = await playCase(a, ch1[0]); check(x.fin.body.progress.cases === 4 && !x.fin.body.counted, 'replaying a finished case does not add progress');
  x = await playCase(a, ch1[4]); check(x.fin.body.counted && x.fin.body.points.total === 15 && x.fin.body.progress.cases === 5, 'case 5 pays the first checkpoint (15)');
  for (let i = 5; i < 20; i++) x = await playCase(a, ch1[i]);
  check(rows('TDY-AAAA0020').join() === '15,15,15,15' && ledgerSum('TDY-AAAA0020') === 60 + RULES.activeNight, 'chapter done: 4 checkpoints, 60 points (plus the active night)');
  const ch2 = Array.from({ length: 5 }, (_, i) => 'c2-' + String(i + 1).padStart(2, '0'));
  for (const id of ch2) x = await playCase(a, id);
  check(x.fin.body.counted && rows('TDY-AAAA0020').join() === '15,15,15,15,15', 'chapter 2 opened on day 2: its first five cases pay the next checkpoint');
  const dash = await get('/api/me/points', a); const m1 = dash.body.missions.find((m) => m.id === M);
  check(m1 && !m1.done && m1.casesDone.length === 25 && dash.body.points.season === 75 + RULES.activeNight, 'dashboard: 25 of 140 cases done, mission not finished, season total 75 plus the active night');
  check(db.prepare("SELECT COUNT(*) c FROM run_meta WHERE player_id='TDY-AAAA0020' AND counted = 1").get().c === 0, 'chapter cases are not nightly runs (no night medals)');

  // late: half points rounded down (15 -> 7)
  NOW = Date.parse('2027-03-09T14:00:00Z'); const b = await mkPlayer('TDY-AAAA0021', 'ChapLate');
  for (const id of ch1) x = await playCase(b, id);
  check(rows('TDY-AAAA0021').join() === '7,7,7,7', 'late: every checkpoint pays half, rounded down (7)');
  { const all = []; for (let ch = 1; ch <= 7; ch++) for (let i = 1; i <= 20; i++) all.push('c' + ch + '-' + String(i).padStart(2, '0'));
    const z = await mkPlayer('TDY-AAAA0025', 'ChapAll'); let ok = true;
    for (const id of all) { x = await playCase(z, id, {}, 62); if (!x.fin || x.fin.status !== 200) { ok = false; console.log('  could not clear', id, x.st && x.st.body, x.fin && x.fin.body); break; } }
    check(ok && rows('TDY-AAAA0025').length === 28 && rows('TDY-AAAA0025').every((v) => v === 7), 'all 140 chapter cases can be cleared, in order: 28 checkpoints'); }

  // split: five cases in the week, the rest after the deadline
  NOW = Date.parse('2027-03-07T09:00:00Z'); const c = await mkPlayer('TDY-AAAA0022', 'ChapSplit');
  for (const id of ch1.slice(0, 5)) x = await playCase(c, id);
  NOW = Date.parse('2027-03-08T14:00:00Z');
  for (const id of ch1.slice(5)) x = await playCase(c, id);
  check(rows('TDY-AAAA0022').join() === '15,7,7,7', 'split: first checkpoint on time (15), the rest after the deadline (7 each)');

  // safety
  NOW = Date.parse('2027-03-03T10:00:00Z'); const d = await mkPlayer('TDY-AAAA0023', 'ChapCheat');
  x = await playCase(d, ch1[0], { score: 1 }); check(x.fin.status === 422 && x.fin.body.error === 'mismatch', 'a wrong score is refused');
  x = await playCase(d, ch1[0], { decision: null }); check(x.fin.status === 422 && x.fin.body.error === 'not_finished', 'a case with no decision is not finished');
  x = await playCase(d, ch1[0], { marks: { nope: 'flag' } }); check(x.fin.status === 422 && x.fin.body.error === 'bad_log', 'a clue that does not exist is refused');
  x = await playCase(d, ch1[0], {}, 5); check(x.fin.status === 422 && x.fin.body.error === 'too_fast', 'a case finished in 5 seconds of real time is refused');
  check(ledgerSum('TDY-AAAA0023') === 0, 'none of those paid anything');
  const e = await mkPlayer('TDY-AAAA0024', 'ChapHeld', 'held'); for (const id of ch1.slice(0, 5)) x = await playCase(e, id);
  check(x.fin.body.counted && x.fin.body.held && db.prepare("SELECT status FROM points_ledger WHERE player_id='TDY-AAAA0024'").all().every((y) => y.status === 'pending'), 'a player under review: Season points wait as pending');
  db.prepare("UPDATE seasons SET status='draft' WHERE id='season-1'").run();
}

// ---- Moon Brew launch mission: Season Nights (7 nights x 20 trays, one night per day, trays in order, 15 every 5 trays) ----
{
  RULES.startNight = '2027-03-01';   // week 1: night 1 opens 1 Mar 13:00 UTC, night n opens n-1 days later; week ends 8 Mar 13:00 UTC
  db.prepare("UPDATE seasons SET status='live' WHERE id='season-1'").run();
  const solve = (n, t, other) => { const g = newGame(generate(seasonTrayConfig(other ? 7 : n, other ? 20 : t))); let at = 1000; while (g.status === 'playing') { const b = hint(g); if (!b) break; tap(g, b, at); at += 900; } return { log: g.log, seconds: at / 1000, status: g.status }; };
  const playTray = async (cookie, n, t, other) => {
    const st = await post('/api/run/start', { game: 'moon-brew', mode: 'weekly', mission: 'moon-brew-season', case: 'n' + n + 't' + t, night: nightKey(NOW) }, cookie);
    if (!st.body.runId) return { st };
    const r = solve(n, t, other); NOW += r.seconds * 1000 + 1000;
    return { st, fin: await post('/api/run/finish', { runId: st.body.runId, log: r.log }, cookie) };
  };
  const rows = (id) => db.prepare("SELECT amount FROM points_ledger WHERE player_id = ?1 AND source_type = 'mission' ORDER BY id").all(id).map((x) => x.amount);
  NOW = Date.parse('2027-03-01T14:00:00Z'); const a = await mkPlayer('TDY-AAAA0030', 'BrewA');
  const pub = await get('/api/season'); const sm = pub.body.missions.filter((m) => m.game === 'moon-brew');
  check(sm.length === 1 && sm[0].id === 'moon-brew-season' && sm[0].cases.length === 140 && sm[0].stages.length === 28 && sm[0].stages.reduce((x, y) => x + y.points, 0) === 420, 'Moon Brew has one launch mission: 7 nights x 20 trays, 28 checkpoints, 420 points');
  check(sm[0].nights.length === 7 && sm[0].nights[0].open && !sm[0].nights[1].open, 'on day 1 only Season night 1 is open');
  check(pub.body.missions.filter((m) => m.game === 'full-moon').length === 1 && pub.body.missions.find((m) => m.game === 'full-moon').week === 3, 'Full Moon has one launch mission, in week 3');
  check(pub.body.games.find((g) => g.id === 'moon-brew').dailyFromWeek === 2 && pub.body.games.find((g) => g.id === 'full-moon').dailyFromWeek === 4, 'each game\'s daily counts from the week after its launch week');
  let x = await post('/api/run/start', { game: 'moon-brew', night: nightKey(NOW) }, a); check(x.status === 409 && x.body.error === 'daily_not_open' && x.body.fromWeek === 2, 'no Daily Brew points in Moon Brew\'s launch week');
  x = await playTray(a, 2, 1); check(x.st.status === 409 && x.st.body.error === 'mission_locked', 'Season night 2 is locked on day 1');
  x = await playTray(a, 1, 2); check(x.st.status === 409 && x.st.body.error === 'tray_order', 'tray 2 needs tray 1 first');
  x = await playTray(a, 1, 1, true); check(x.fin.status === 422, 'a log from another tray (night 7, tray 20) is refused');
  for (let t = 1; t <= 4; t++) { x = await playTray(a, 1, t); }
  check(x.fin.body.progress.nightDone === 4 && rows('TDY-AAAA0030').length === 0 && ledgerSum('TDY-AAAA0030') === RULES.activeNight, '4 trays: no checkpoint yet, only the active-night points (paid once)');
  x = await playTray(a, 1, 5); check(x.fin.body.counted && x.fin.body.points.total === 15, 'tray 5 pays the first checkpoint (15)');
  for (let t = 6; t <= 20; t++) x = await playTray(a, 1, t);
  check(rows('TDY-AAAA0030').join() === '15,15,15,15', 'night 1 done: 4 checkpoints, 60 points');
  NOW = Date.parse('2027-03-02T14:00:00Z');
  x = await playTray(a, 2, 1); check(x.fin && x.fin.body.ok, 'day 2: Season night 2 opens');
  x = await playTray(a, 3, 1); check(x.st.status === 409 && x.st.body.error === 'mission_locked', 'day 2: night 3 still locked');
  check(db.prepare("SELECT COUNT(*) c FROM run_meta WHERE player_id='TDY-AAAA0030' AND counted = 1").get().c === 0, 'Season trays are not nightly runs');
  // week 1 has no Daily Brew: clearing a Season tray counts as playing that night, so the 5-night bonus can be reached
  const cc = await mkPlayer('TDY-AAAA0032', 'BrewDays');
  for (let d = 1; d <= 5; d++) { NOW = Date.parse('2027-03-0' + d + 'T14:00:00Z'); x = await playTray(cc, d, 1); }
  const types = db.prepare("SELECT source_type FROM points_ledger WHERE player_id='TDY-AAAA0032' ORDER BY id").all().map((r) => r.source_type);
  check(types.filter((t) => t === 'active_night').length === 5 && types.filter((t) => t === 'consistency5').length === 1 && !types.includes('consistency7'), 'Season trays on 5 different nights: 5 active nights and the 5-night bonus, once');
  x = await playTray(cc, 1, 2); check(db.prepare("SELECT COUNT(*) c FROM points_ledger WHERE player_id='TDY-AAAA0032' AND source_type='active_night'").get().c === 5, 'a second tray on the same night pays no second active night');
  // late: after week 1 every night is open, checkpoints pay half (15 -> 7), and the Daily Brew counts
  NOW = Date.parse('2027-03-09T14:00:00Z'); const b = await mkPlayer('TDY-AAAA0031', 'BrewLate');
  for (let t = 1; t <= 10; t++) x = await playTray(b, 7, t);
  check(rows('TDY-AAAA0031').join() === '7,7', 'late: night 7 opens, checkpoints pay half (7 + 7)');
  x = await post('/api/run/start', { game: 'moon-brew', night: nightKey(NOW) }, b); check(x.status === 200 && x.body.runId, 'week 2: the Daily Brew counts');
  x = await post('/api/run/start', { game: 'full-moon', night: nightKey(NOW) }, b); check(x.status === 409 && x.body.error === 'daily_not_open', 'week 2: Full Moon daily not yet (it joins in week 3, daily from week 4)');
  // every Season tray can be built and cleared; difficulty rises every tray and every night
  let all = true; for (let n = 1; n <= 7; n++) for (let t = 1; t <= 20; t++) if (solve(n, t).status !== 'won') all = false;
  check(all, 'all 140 Season trays can be cleared');
  db.prepare("UPDATE seasons SET status='draft' WHERE id='season-1'").run();
}

console.log(bad ? 'PROBLEMS: ' + bad : 'runs and points ok'); if (bad) process.exitCode = 1;
