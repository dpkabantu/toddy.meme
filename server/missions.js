// Weekly missions. A mission is open for one Season week; each stage pays once.
// Points depend on when the stage is FINISHED (server clock): in its week = full, later = half (rounded down).
import { RULES } from './rules.js';
import { missionWindow } from './clock.js';
import { isoTime } from './lib/util.js';
import { CHAPTERS } from './games/scam-lab-cases.js';

// Scam Lab launch mission (placeholder): one chapter, in Scam Lab's launch week.
function chapterMissions() {
  const cm = RULES.chapterMissions;
  return CHAPTERS.filter((ch) => ch.n === cm.chapter && ch.status === 'open' && ch.cases.length).map((ch) => ({
    id: 'scam-lab-ch' + ch.n, game: 'scam-lab', kind: 'chapter', title: 'Chapter ' + ch.n + ': ' + ch.title, week: cm.week, chapter: ch.n, cases: ch.cases,
    stages: [{ id: 'half', needCases: Math.min(cm.halfCases, ch.cases.length), points: cm.halfPoints, label: Math.min(cm.halfCases, ch.cases.length) + ' cases' }, { id: 'done', needCases: ch.cases.length, points: cm.donePoints, label: 'Chapter done' }],
  }));
}
// Full Moon launch mission (placeholder): one fixed puzzle with that week's twist.
function fullMoonMissions() {
  const f = RULES.fullMoonWeekly, w = f.week;
  return [{ id: 'full-moon-w' + w, game: 'full-moon', week: w, kind: 'weekly-puzzle', title: 'Weekly Challenge', seed: 900000 + w * 100, twist: w - 1,
    stages: [{ id: 'silver', minBand: f.silverBand, points: f.silverPoints, label: 'Silver' }, { id: 'gold', minBand: 3, points: f.goldPoints, label: 'Gold' }] }];
}
// Moon Brew launch mission: Season Nights. Cases 'n<night>t<tray>'. A stage pays 15 at every 5 trays of one night.
function seasonNightsMission() {
  const s = RULES.seasonNights, cases = [], stages = [];
  for (let n = 1; n <= s.nights; n++) {
    for (let t = 1; t <= s.trays; t++) cases.push('n' + n + 't' + t);
    for (let k = 1; k * s.every <= s.trays; k++) stages.push({ id: 'n' + n + 's' + k, night: n, needCases: k * s.every, points: s.points, label: 'Night ' + n + ': ' + k * s.every + ' trays' });
  }
  return { id: 'moon-brew-season', game: 'moon-brew', week: RULES.launchWeek['moon-brew'], kind: 'brewset', title: 'Season Nights', nights: s.nights, trays: s.trays, cases, stages };
}
export const allMissions = () => [...RULES.missions, seasonNightsMission(), ...chapterMissions(), ...fullMoonMissions()];
export const parseTray = (id) => { const m = /^n(\d+)t(\d+)$/.exec(String(id)); return m ? { night: Number(m[1]), tray: Number(m[2]) } : null; };
// When Season night n of a launch mission opens: one per day from the mission's first night. Before the Season is live everything is open (rehearsal).
export function nightOpensMs(m, n) { return missionWindow(RULES.startNight, m.week).opensMs + (n - 1) * 86400000; }
export function nightOpen(seasonStatus, m, n, now) { return seasonStatus !== 'live' || now >= nightOpensMs(m, n); }
// The game's daily challenge counts from the week after its launch week.
export const dailyFromWeek = (game) => (RULES.launchWeek[game] || 0) + 1;
export const isCaseMission = (m) => m.kind === 'chapter' || m.kind === 'brewset';

// The Season week it is right now (1..8). Before the Season is live, rehearsal always shows week 1.
export function currentSeasonWeek(seasonStatus, now, weeks = 8) {
  if (seasonStatus !== 'live') return 1;
  for (let w = weeks; w >= 1; w--) if (now >= missionWindow(RULES.startNight, w).opensMs) return w;
  return 0;
}
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
    const reached = st.night !== undefined ? ((prog.byNight && prog.byNight[st.night]) || 0) >= st.needCases : (st.minBand !== undefined && prog.band >= st.minBand) || (st.needCases !== undefined && prog.cases >= st.needCases);
    if (!reached) continue;
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
    nights: m.nights ? Array.from({ length: m.nights }, (_, i) => ({ night: i + 1, opensAt: isoTime(nightOpensMs(m, i + 1)), open: nightOpen(seasonStatus, m, i + 1, now) })) : undefined, trays: m.trays,
    stages: m.stages.map((st) => ({ id: st.id, label: st.label, points: st.points, needCases: st.needCases, night: st.night })) };
}
