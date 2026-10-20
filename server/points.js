// Season points. Pure planning (planAwards) plus the ledger reads used by the Passport dashboard.
// Raw scores of different games are never added: points come from a band (0 to 3) per game per night.
import { RULES, bandPoints } from './rules.js';

// What does one newly counted run earn? s = facts about the player's week so far (before this run).
export function planAwards(rules, s) {
  const items = []; let room = Math.max(0, rules.seasonMax - (s.seasonTotal || 0));
  const add = (key, category, amount, reason) => { const a = Math.min(amount, room); if (a > 0) { items.push({ key, category, amount: a, reason }); room -= a; } };
  const gameRoom = Math.max(0, rules.weeklyCapPerGame - (s.gamePointsWeek || 0));
  const name = rules.names[s.game] || s.game;
  const want = bandPoints(s.band);
  add('run', 'gameplay', Math.min(want, gameRoom), name + ' night: ' + rules.bandNames[Math.max(0, Math.min(3, s.band | 0))] + (want > gameRoom ? ' (weekly limit reached)' : ''));
  if (s.isNewNight) add('active_night', 'retention', rules.activeNight, 'Active night');
  const nights = (s.nightsBefore || 0) + (s.isNewNight ? 1 : 0);
  if (nights >= 5 && !s.have.has('consistency5')) add('consistency5', 'retention', rules.consistency[5], 'Consistency: 5 nights this week');
  if (nights >= 7 && !s.have.has('consistency7')) add('consistency7', 'retention', rules.consistency[7] - rules.consistency[5], 'Consistency: all 7 nights');
  const per = { ...(s.gameNights || {}) }; per[s.game] = (per[s.game] || 0) + 1;
  if (rules.games.every((g) => (per[g] || 0) >= rules.allRounderNights) && !s.have.has('allrounder')) add('allrounder', 'gameplay', rules.allRounderWeek, 'All-Rounder week: 3 nights in every game');
  return items;
}

// A later run on the same night that is better than the one already counted pays only the difference.
export function planUpgrade(rules, s) {
  const gameRoom = Math.max(0, rules.weeklyCapPerGame - (s.gamePointsWeek || 0)), seasonRoom = Math.max(0, rules.seasonMax - (s.seasonTotal || 0));
  const delta = Math.min(bandPoints(s.band) - (s.awardedNight || 0), gameRoom, seasonRoom);
  if (delta <= 0) return null;
  return { key: 'run_upgrade', category: 'gameplay', amount: delta, reason: (rules.names[s.game] || s.game) + ' night: improved to ' + rules.bandNames[Math.max(0, Math.min(3, s.band | 0))] };
}

export async function ruleVersionId(env) {
  await env.DB.prepare('INSERT OR IGNORE INTO rule_versions (season_id, version, rules_json, notes) VALUES (?1, ?2, ?3, ?4)').bind(RULES.seasonId, RULES.versionNumber, JSON.stringify(RULES), RULES.version).run();
  const r = await env.DB.prepare('SELECT id FROM rule_versions WHERE season_id = ?1 AND version = ?2').bind(RULES.seasonId, RULES.versionNumber).first();
  return r ? r.id : null;
}

// Facts the plan needs, read from the database (everything before the run being counted).
export async function weekFacts(env, playerId, game, week, night) {
  const [g, n, pts, have, tot, tonight] = await env.DB.batch([
    env.DB.prepare('SELECT game_id, COUNT(DISTINCT night_key) c FROM run_meta WHERE player_id = ?1 AND week = ?2 AND counted = 1 GROUP BY game_id').bind(playerId, week),
    env.DB.prepare('SELECT COUNT(DISTINCT night_key) c FROM run_meta WHERE player_id = ?1 AND week = ?2 AND counted = 1').bind(playerId, week),
    env.DB.prepare('SELECT COALESCE(SUM(points),0) p FROM run_meta WHERE player_id = ?1 AND week = ?2 AND game_id = ?3').bind(playerId, week, game),
    env.DB.prepare("SELECT source_type FROM points_ledger WHERE player_id = ?1 AND source_id = ?2 AND source_type IN ('consistency5','consistency7','allrounder') AND reverses_id IS NULL").bind(playerId, playerId + ':' + week),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) t FROM points_ledger WHERE player_id = ?1 AND season_id = ?2 AND status IN ('settled','pending')").bind(playerId, RULES.seasonId),
    env.DB.prepare('SELECT COUNT(*) c FROM run_meta WHERE player_id = ?1 AND night_key = ?2 AND counted = 1').bind(playerId, night),
  ]);
  const gameNights = {}; for (const r of g.results) gameNights[r.game_id] = r.c;
  return { gameNights, nightsBefore: n.results[0].c, gamePointsWeek: pts.results[0].p, have: new Set(have.results.map((r) => r.source_type)), seasonTotal: tot.results[0].t, isNewNight: tonight.results[0].c === 0 };
}

// ---- Passport dashboard numbers ----
const DAY = 86400000;
export function streakFrom(playedSet, tonightKey) {
  const day = (k, d) => new Date(Date.parse(k + 'T00:00:00Z') + d * DAY).toISOString().slice(0, 10);
  let k = playedSet.has(tonightKey) ? tonightKey : day(tonightKey, -1), n = 0;
  while (playedSet.has(k)) { n++; k = day(k, -1); }
  return n;
}
