// Weekly missions. A mission is open for one Season week; each stage pays once.
// Points depend on when the stage is FINISHED (server clock): in its week = full, later = half (rounded down).
import { RULES } from './rules.js';
import { missionWindow } from './clock.js';
import { isoTime } from './lib/util.js';
import { CHAPTERS } from './games/scam-lab-cases.js';

// Chapter missions come from the game's own chapter list; hand-written missions (the Full Moon Weekly Challenge) come from RULES.missions.
function chapterMissions() {
  const cm = RULES.chapterMissions;
  return CHAPTERS.filter((ch) => ch.status === 'open' && ch.cases.length).map((ch) => ({
    id: 'scam-lab-ch' + ch.n, game: 'scam-lab', kind: 'chapter', title: 'Chapter ' + ch.n + ': ' + ch.title, week: cm.firstWeek + ch.n - 1, chapter: ch.n, cases: ch.cases,
    stages: [{ id: 'half', needCases: Math.min(cm.halfCases, ch.cases.length), points: cm.halfPoints, label: Math.min(cm.halfCases, ch.cases.length) + ' cases' }, { id: 'done', needCases: ch.cases.length, points: cm.donePoints, label: 'Chapter done' }],
  }));
}
export const allMissions = () => [...RULES.missions, ...chapterMissions()];
export const findMission = (id, game) => allMissions().find((m) => m.id === id && (!game || m.game === game));

// 'locked' (not open yet), 'open' (on time) or 'late' (half points). Before the Season is live every mission counts as open, for rehearsal.
export function missionState(seasonStatus, m, now) {
  if (seasonStatus !== 'live') return 'open';
  const w = missionWindow(RULES.startNight, m.week);
  return now < w.opensMs ? 'locked' : now < w.closesMs ? 'open' : 'late';
}

// Which stages does a finished run newly earn? claimed = Set of stage ids already paid. prog = { band, cases } (cases: distinct cases finished). room = points left under the season maximum.
export function planMission(m, claimed, prog, state, room) {
  const items = []; let left = Math.max(0, room);
  for (const st of m.stages) {
    if (claimed.has(st.id)) continue;
    if (!((st.minBand !== undefined && prog.band >= st.minBand) || (st.needCases !== undefined && prog.cases >= st.needCases))) continue;
    const full = state === 'open', want = full ? st.points : Math.floor(st.points / 2), a = Math.min(want, left);
    if (a <= 0) continue;
    items.push({ stage: st.id, amount: a, onTime: full, reason: RULES.names[m.game] + ' ' + m.title + ': ' + st.label + (full ? '' : ' (late, half points)') });
    left -= a;
  }
  return items;
}

export async function claimedStages(env, playerId, m) {
  const r = await env.DB.prepare("SELECT source_id FROM points_ledger WHERE player_id = ?1 AND source_type = 'mission' AND source_id LIKE ?2 AND reverses_id IS NULL").bind(playerId, playerId + ':' + m.id + ':%').all();
  return new Set(r.results.map((x) => x.source_id.split(':').pop()));
}

// Distinct cases of a chapter mission this player has finished (each finished case run is stored as seed 'missionId:caseId').
export async function finishedCases(env, playerId, m) {
  const r = await env.DB.prepare("SELECT DISTINCT seed FROM game_runs WHERE player_id = ?1 AND mode = 'weekly' AND status = 'accepted' AND seed LIKE ?2").bind(playerId, m.id + ':%').all();
  return new Set(r.results.map((x) => x.seed.split(':')[1]).filter((id) => m.cases.includes(id)));
}

export function missionPublic(seasonStatus, m, now) {
  const w = missionWindow(RULES.startNight, m.week);
  return { id: m.id, game: m.game, kind: m.kind, title: m.title, week: m.week, cases: m.cases, state: missionState(seasonStatus, m, now), opensAt: isoTime(w.opensMs), closesAt: isoTime(w.closesMs), seed: m.seed, twist: m.twist,
    stages: m.stages.map((st) => ({ id: st.id, label: st.label, points: st.points, needCases: st.needCases })) };
}
