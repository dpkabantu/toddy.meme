// Weekly missions. A mission is open for one Season week; each stage pays once.
// Points depend on when the stage is FINISHED (server clock): in its week = full, later = half (rounded down).
import { RULES } from './rules.js';
import { missionWindow } from './clock.js';
import { isoTime } from './lib/util.js';

export const findMission = (id, game) => RULES.missions.find((m) => m.id === id && (!game || m.game === game));

// 'locked' (not open yet), 'open' (on time) or 'late' (half points). Before the Season is live every mission counts as open, for rehearsal.
export function missionState(seasonStatus, m, now) {
  if (seasonStatus !== 'live') return 'open';
  const w = missionWindow(RULES.startNight, m.week);
  return now < w.opensMs ? 'locked' : now < w.closesMs ? 'open' : 'late';
}

// Which stages does a finished run newly earn? claimed = Set of stage ids already paid. room = points left under the season maximum.
export function planMission(m, claimed, band, state, room) {
  const items = []; let left = Math.max(0, room);
  for (const st of m.stages) {
    if (claimed.has(st.id) || band < st.minBand) continue;
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

export function missionPublic(seasonStatus, m, now) {
  const w = missionWindow(RULES.startNight, m.week);
  return { id: m.id, game: m.game, title: m.title, week: m.week, state: missionState(seasonStatus, m, now), opensAt: isoTime(w.opensMs), closesAt: isoTime(w.closesMs), seed: m.seed, twist: m.twist,
    stages: m.stages.map((st) => ({ id: st.id, label: st.label, points: st.points })) };
}
