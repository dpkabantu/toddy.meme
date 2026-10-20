// Daily runs from the games: start, finish (server replays and decides), and the player's points page data.
import { json, nowMs, randomToken, sameOriginPost, readJson, limited, callerKey, isoTime } from './lib/util.js';
import { sessionPlayer } from './auth.js';
import { nightKey, nightEndMs, weekOfNight, shiftNight, lastNights } from './clock.js';
import { RULES, bandPoints } from './rules.js';
import { planAwards, planUpgrade, ruleVersionId, weekFacts, streakFrom } from './points.js';
import * as moonBrew from './games/moon-brew.js';
import * as fullMoon from './games/full-moon.js';

const ADAPTERS = { 'moon-brew': moonBrew, 'full-moon': fullMoon };
export const MIN_SECONDS_PER_TAP = 0.35;   // Moon Brew: faster than this on average is not a person
const SLACK_MS = 5000;                     // the run's own clock may be 20% / 5 s faster than the wall clock, no more

async function ctx(request, env) {
  if (!env.DB) return { err: json(503, { ok: false, error: 'not_configured' }) };
  if (!sameOriginPost(request)) return { err: json(403, { ok: false, error: 'forbidden' }) };
  const p = await sessionPlayer(request, env);
  if (!p) return { err: json(401, { ok: false, error: 'sign_in_first' }) };
  return { p };
}
const pointsOn = async (env) => { const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'points_enabled'").first(); return !r || r.value !== '0'; };
async function seasonOpen(env) { const r = await env.DB.prepare('SELECT status FROM seasons WHERE id = ?1').bind(RULES.seasonId).first(); return !!r && ['draft', 'rehearsal', 'live'].includes(r.status); }

export async function runStart(request, env) {
  const c = await ctx(request, env); if (c.err) return c.err; const p = c.p;
  const ip = await callerKey(request, env);
  if (await limited(env, 'rstart:' + p.id, 60, 3600) || await limited(env, 'rstart-ip:' + ip, 300, 3600)) return json(429, { ok: false, error: 'rate' });
  const body = await readJson(request);
  if (!body || !ADAPTERS[body.game]) return json(400, { ok: false, error: 'game_not_supported' });
  const now = nowMs(env), night = nightKey(now);
  if (body.night !== night) return json(409, { ok: false, error: 'clock_off', night });
  if (!(await seasonOpen(env))) return json(409, { ok: false, error: 'season_closed' });
  const done = await env.DB.prepare('SELECT MAX(band) band FROM run_meta WHERE player_id = ?1 AND game_id = ?2 AND night_key = ?3 AND counted = 1 OR (player_id = ?1 AND game_id = ?2 AND night_key = ?3 AND points > 0)').bind(p.id, body.game, night).first();
  if (done && done.band !== null && done.band >= 3) return json(200, { ok: true, runId: null, night, alreadyCounted: true });   // top band already reached tonight
  const id = 'run_' + randomToken(12), week = weekOfNight(night);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO game_runs (id, player_id, season_id, game_id, mode, seed, rules_version, status, submitted_at) VALUES (?1, ?2, ?3, ?4, 'daily', ?5, ?6, 'pending', ?7)").bind(id, p.id, RULES.seasonId, body.game, night, RULES.version, isoTime(now)),
    env.DB.prepare('INSERT INTO run_meta (run_id, player_id, game_id, night_key, week, started_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(id, p.id, body.game, night, week, now),
  ]);
  return json(200, { ok: true, runId: id, night, week, counting: await pointsOn(env) });
}

async function reject(env, run, now, reason) {
  await env.DB.batch([
    env.DB.prepare("UPDATE game_runs SET status = 'rejected', reject_reason = ?2 WHERE id = ?1").bind(run.run_id, reason),
    env.DB.prepare('UPDATE run_meta SET finished_ms = ?2, flags = ?3 WHERE run_id = ?1').bind(run.run_id, now, reason),
  ]);
}

export async function runFinish(request, env) {
  const c = await ctx(request, env); if (c.err) return c.err; const p = c.p;
  if (await limited(env, 'rfin:' + p.id, 60, 3600)) return json(429, { ok: false, error: 'rate' });
  const body = await readJson(request, 120000);
  if (!body || typeof body.runId !== 'string' || body.runId.length > 40) return json(400, { ok: false, error: 'bad_request' });
  const run = await env.DB.prepare('SELECT m.*, g.status gstatus FROM run_meta m JOIN game_runs g ON g.id = m.run_id WHERE m.run_id = ?1 AND m.player_id = ?2 AND m.finished_ms IS NULL').bind(body.runId, p.id).first();
  if (!run) return json(404, { ok: false, error: 'run_not_found' });
  const now = nowMs(env);
  if (now > nightEndMs(run.night_key) + RULES.graceMs) { await reject(env, run, now, 'night_over'); return json(422, { ok: false, error: 'night_over' }); }
  const t0 = performance.now();
  const v = ADAPTERS[run.game_id].verify(run.night_key, body);
  const replayMs = Math.round(performance.now() - t0);
  if (!v.ok) { await reject(env, run, now, v.error); return json(422, { ok: false, error: v.error }); }
  const elapsed = now - run.started_ms;
  if (elapsed < v.seconds * 800 - SLACK_MS) { await reject(env, run, now, 'too_fast'); return json(422, { ok: false, error: 'too_fast' }); }
  if (run.game_id === 'moon-brew' && v.seconds < body.log.length * MIN_SECONDS_PER_TAP) { await reject(env, run, now, 'too_fast'); return json(422, { ok: false, error: 'too_fast' }); }

  const logJson = JSON.stringify(run.game_id === 'moon-brew' ? body.log : { drops: body.drops, endTick: body.endTick });
  const finishRun = [
    env.DB.prepare("UPDATE game_runs SET status = 'accepted', score = ?2, duration_ms = ?3, log_json = ?4, raw_delete_after = ?5 WHERE id = ?1").bind(run.run_id, v.score, Math.round(v.seconds * 1000), logJson, RULES.rawDeleteAfter),
  ];
  const plain = [...finishRun, env.DB.prepare('UPDATE run_meta SET finished_ms = ?2, band = ?3, replay_ms = ?4 WHERE run_id = ?1').bind(run.run_id, now, v.band, replayMs)];
  const counting = await pointsOn(env);
  const bestRow = await env.DB.prepare('SELECT MAX(band) band, SUM(counted) c FROM run_meta WHERE player_id = ?1 AND game_id = ?2 AND night_key = ?3').bind(p.id, run.game_id, run.night_key).first();
  const best = bestRow && bestRow.c > 0 ? bestRow : null;
  const answer = (extra) => json(200, { ok: true, score: v.score, band: v.band, bandName: RULES.bandNames[v.band], ...extra });
  if (!counting) { await env.DB.batch(plain); return answer({ counted: false, reason: 'points_paused', points: { total: 0, items: [] } }); }
  if (best) {
    // Already counted tonight for this game. Only a better band pays, and only the difference.
    const f = await weekFacts(env, p.id, run.game_id, run.week, run.night_key);
    const night = await env.DB.prepare('SELECT COALESCE(SUM(points),0) a FROM run_meta WHERE player_id = ?1 AND game_id = ?2 AND night_key = ?3').bind(p.id, run.game_id, run.night_key).first();
    const up = v.band > best.band ? planUpgrade(RULES, { game: run.game_id, band: v.band, awardedNight: night.a, gamePointsWeek: f.gamePointsWeek, seasonTotal: f.seasonTotal }) : null;
    if (!up) { await env.DB.batch(plain); return answer({ counted: false, reason: 'not_better', points: { total: 0, items: [] } }); }
    const st = p.status === 'held' ? 'pending' : 'settled', rv = await ruleVersionId(env);
    await env.DB.batch([
      ...finishRun,
      env.DB.prepare('UPDATE run_meta SET finished_ms = ?2, band = ?3, points = ?4, replay_ms = ?5 WHERE run_id = ?1').bind(run.run_id, now, v.band, up.amount, replayMs),
      env.DB.prepare('INSERT INTO points_ledger (player_id, season_id, category, amount, reason, rule_version_id, source_type, source_id, status, settled_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)').bind(p.id, RULES.seasonId, up.category, up.amount, up.reason, rv, 'run_upgrade', run.run_id, st, st === 'settled' ? isoTime(now) : null),
      env.DB.prepare('UPDATE daily_activity SET points = points + ?4 WHERE player_id = ?1 AND season_id = ?2 AND day = ?3').bind(p.id, RULES.seasonId, run.night_key, up.amount),
    ]);
    return answer({ counted: true, upgraded: true, held: st === 'pending', points: { total: up.amount, items: [{ label: up.reason, amount: up.amount }] } });
  }

  const facts = await weekFacts(env, p.id, run.game_id, run.week, run.night_key);
  const plan = planAwards(RULES, { ...facts, game: run.game_id, band: v.band });
  const rvid = await ruleVersionId(env);
  const status = p.status === 'held' ? 'pending' : 'settled';
  const gameplayPts = plan.filter((x) => x.key === 'run').reduce((a, x) => a + x.amount, 0), total = plan.reduce((a, x) => a + x.amount, 0);
  const sourceId = (x) => (x.key === 'run' ? run.run_id : x.key === 'active_night' ? p.id + ':' + run.night_key : p.id + ':' + run.week);
  const sourceType = (x) => (x.key === 'run' ? 'run' : x.key);
  const stmts = [
    ...finishRun,
    env.DB.prepare('UPDATE run_meta SET finished_ms = ?2, band = ?3, counted = 1, points = ?4, replay_ms = ?5 WHERE run_id = ?1').bind(run.run_id, now, v.band, gameplayPts, replayMs),
    ...plan.map((x) => env.DB.prepare('INSERT INTO points_ledger (player_id, season_id, category, amount, reason, rule_version_id, source_type, source_id, status, settled_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)')
      .bind(p.id, RULES.seasonId, x.category, x.amount, x.reason, rvid, sourceType(x), sourceId(x), status, status === 'settled' ? isoTime(now) : null)),
    env.DB.prepare('INSERT INTO daily_activity (player_id, season_id, day, games_played, accepted_runs, points) VALUES (?1, ?2, ?3, 1, 1, ?4) ON CONFLICT(player_id, season_id, day) DO UPDATE SET games_played = games_played + 1, accepted_runs = accepted_runs + 1, points = points + ?4').bind(p.id, RULES.seasonId, run.night_key, total),
    env.DB.prepare('UPDATE players SET last_active_at = ?2 WHERE id = ?1').bind(p.id, isoTime(now)),
  ];
  try { await env.DB.batch(stmts); }
  catch (e) {
    // Two finishes at the same moment: the database lets only one run count. The other is kept, without points.
    if (!/UNIQUE|constraint/i.test(String((e && e.message) || e))) throw e;
    await env.DB.batch(plain); return answer({ counted: false, reason: 'already_counted', points: { total: 0, items: [] } });
  }
  return answer({ counted: true, held: status === 'pending', points: { total, items: plan.map((x) => ({ label: x.reason, amount: x.amount })) } });
}

const rulesSummary = () => ({ bandPoints: [0, 1, 2, 3].map((b) => bandPoints(b)), activeNight: RULES.activeNight, weeklyCap: RULES.weeklyCapPerGame, consistency5Nights: 5, consistency5: RULES.consistency[5], consistency7Extra: RULES.consistency[7] - RULES.consistency[5], allRounder: RULES.allRounderWeek, allRounderNights: RULES.allRounderNights });

// ---- GET /api/season: public facts for the Season page (works for guests, nothing personal) ----
export async function seasonInfo(request, env) {
  if (!env.DB) return json(503, { ok: false, error: 'not_configured' });
  const now = nowMs(env), night = nightKey(now);
  const s = await env.DB.prepare('SELECT id, name, status, starts_at, ends_at FROM seasons WHERE id = ?1').bind(RULES.seasonId).first();
  return json(200, { ok: true, season: s ? { id: s.id, name: s.name, status: s.status, startsAt: s.starts_at, endsAt: s.ends_at } : null,
    night: { key: night, endsAt: isoTime(nightEndMs(night)), week: weekOfNight(night) },
    games: RULES.games.map((id) => ({ id, title: RULES.names[id], ready: id in ADAPTERS })), rules: rulesSummary(), rulesVersion: RULES.version });
}

// ---- GET /api/me/points: everything the Passport dashboard shows ----
export async function myPoints(request, env) {
  if (!env.DB) return json(503, { ok: false, error: 'not_configured' });
  const p = await sessionPlayer(request, env);
  if (!p) return json(401, { ok: false, error: 'sign_in_first' });
  const now = nowMs(env), night = nightKey(now), week = weekOfNight(night);
  const dow = new Date(night + 'T00:00:00Z').getUTCDay(), weekKeys = lastNights(shiftNight(night, 6 - ((dow + 6) % 7)), 7);   // Monday to Sunday of this week's nights
  const [tot, wk, perGame, tonight, nights, recent, have] = await env.DB.batch([
    env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN status='settled' THEN amount ELSE 0 END),0) settled, COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) pending FROM points_ledger WHERE player_id = ?1 AND season_id = ?2").bind(p.id, RULES.seasonId),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) s FROM points_ledger WHERE player_id = ?1 AND season_id = ?2 AND status IN ('settled','pending') AND ((source_type IN ('run','run_upgrade') AND source_id IN (SELECT run_id FROM run_meta WHERE player_id = ?1 AND week = ?3)) OR (source_type = 'active_night' AND source_id IN (?4,?5,?6,?7,?8,?9,?10)) OR (source_id = ?11 AND source_type IN ('consistency5','consistency7','allrounder')))").bind(p.id, RULES.seasonId, week, ...weekKeys.map((k) => p.id + ':' + k), p.id + ':' + week),
    env.DB.prepare('SELECT game_id, COUNT(DISTINCT CASE WHEN counted = 1 THEN night_key END) nights, COALESCE(SUM(points),0) pts FROM run_meta WHERE player_id = ?1 AND week = ?2 GROUP BY game_id').bind(p.id, week),
    env.DB.prepare('SELECT game_id, MAX(band) band FROM run_meta WHERE player_id = ?1 AND night_key = ?2 AND (counted = 1 OR points > 0) GROUP BY game_id').bind(p.id, night),
    env.DB.prepare('SELECT DISTINCT night_key FROM run_meta WHERE player_id = ?1 AND counted = 1 AND night_key >= ?2').bind(p.id, lastNights(night, 60)[0]),
    env.DB.prepare('SELECT created_at, reason, amount, status, category FROM points_ledger WHERE player_id = ?1 AND season_id = ?2 ORDER BY id DESC LIMIT 15').bind(p.id, RULES.seasonId),
    env.DB.prepare("SELECT source_type FROM points_ledger WHERE player_id = ?1 AND source_id = ?2 AND source_type IN ('consistency5','consistency7','allrounder') AND reverses_id IS NULL").bind(p.id, p.id + ':' + week),
  ]);
  const gm = {}; for (const r of perGame.results) gm[r.game_id] = r;
  const tmap = {}; for (const r of tonight.results) tmap[r.game_id] = r.band;
  const played = new Set(nights.results.map((r) => r.night_key));
  const weekNights = [...played].filter((k) => weekOfNight(k) === week).length;
  const gotBonus = new Set(have.results.map((r) => r.source_type));
  const games = RULES.games.map((id) => ({ id, title: RULES.names[id], weekPoints: (gm[id] || {}).pts || 0, weekCap: RULES.weeklyCapPerGame, nightsThisWeek: (gm[id] || {}).nights || 0, playedTonight: id in tmap, tonightBand: id in tmap ? RULES.bandNames[tmap[id]] : null, ready: id in ADAPTERS }));
  const allRounderDone = RULES.games.filter((id) => ((gm[id] || {}).nights || 0) >= RULES.allRounderNights).length;
  return json(200, {
    ok: true, rulesVersion: RULES.version, season: { id: RULES.seasonId },
    night: { key: night, endsAt: isoTime(nightEndMs(night)), week },
    points: { season: tot.results[0].settled, pending: tot.results[0].pending, week: wk.results[0].s, seasonMax: RULES.seasonMax },
    streak: { current: streakFrom(played, night), weekNights, last7: lastNights(night, 7).map((k) => ({ night: k, played: played.has(k) })) },
    rules: rulesSummary(),
    games,
    goals: [
      { id: 'allrounder', label: 'All-Rounder: ' + RULES.allRounderNights + ' nights in each game this week', progress: allRounderDone, target: RULES.games.length, reward: RULES.allRounderWeek, done: gotBonus.has('allrounder') },
      { id: 'consistency5', label: 'Play 5 nights this week', progress: Math.min(5, weekNights), target: 5, reward: RULES.consistency[5], done: gotBonus.has('consistency5') },
      { id: 'consistency7', label: 'Play all 7 nights this week', progress: Math.min(7, weekNights), target: 7, reward: RULES.consistency[7] - RULES.consistency[5], done: gotBonus.has('consistency7') },
    ],
    recent: recent.results.map((r) => ({ at: r.created_at, label: r.reason, amount: r.amount, status: r.status })),
    note: 'Points are a record of your activity in Season 1. They have no cash value.',
  });
}
