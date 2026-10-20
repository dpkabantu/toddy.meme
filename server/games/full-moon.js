// Server check for a Full Moon night: replay the drops from the night's seed and read the score.
import { replay, bandFor, twistForDate, dateSeed, TICKS_PER_SEC } from './full-moon-core.js';

export const MAX_DROPS = 2500, MAX_TICKS = 60000;       // 16 minutes of play at most

export function verify(night, payload) {
  const p = payload || {};
  if (!Array.isArray(p.drops) || p.drops.length > MAX_DROPS) return { ok: false, error: 'bad_log' };
  if (!Number.isInteger(p.endTick) || p.endTick < 1 || p.endTick > MAX_TICKS) return { ok: false, error: 'bad_log' };
  let last = -1;
  for (const d of p.drops) {
    if (!Array.isArray(d) || d.length !== 2 || !Number.isInteger(d[0]) || !Number.isInteger(d[1])) return { ok: false, error: 'bad_log' };
    if (d[0] < last || d[0] < 0 || d[0] > p.endTick || d[1] < -2000 || d[1] > 4000) return { ok: false, error: 'bad_log' };
    last = d[0];
  }
  const date = new Date(night + 'T12:00:00Z');
  const seed = dateSeed(date), twist = twistForDate(seed);
  const { state, bad } = replay(seed, p.drops, p.endTick, twist);
  if (bad) return { ok: false, error: 'bad_log' };
  if (!state.over) return { ok: false, error: 'not_finished' };   // the night's run must end by itself (crate full)
  if (Number.isInteger(p.score) && p.score !== state.score) return { ok: false, error: 'mismatch' };
  return { ok: true, score: state.score, band: bandFor(state.score, twist), seconds: state.tick / TICKS_PER_SEC, detail: { seed, twist, drops: state.drops, maxLevel: state.maxLevel } };
}
