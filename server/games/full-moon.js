// Server check for a Full Moon night: replay the drops from the night's seed and read the score.
import { replay, bandFor, twistForDate, dateSeed, TICKS_PER_SEC, seasonLevel, goalMet, SEASON } from './full-moon-core.js';

export const MAX_DROPS = 2500, MAX_TICKS = 60000;       // 16 minutes of play at most

export function verify(night, payload, opts = {}) {   // opts.seed / opts.twist: a fixed puzzle such as the Weekly Challenge
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
  const seed = opts.seed !== undefined ? opts.seed : dateSeed(date), twist = opts.twist !== undefined ? opts.twist : twistForDate(seed);
  const { state, bad } = replay(seed, p.drops, p.endTick, twist);
  if (bad) return { ok: false, error: 'bad_log' };
  if (!state.over) return { ok: false, error: 'not_finished' };   // the night's run must end by itself (crate full)
  if (Number.isInteger(p.score) && p.score !== state.score) return { ok: false, error: 'mismatch' };
  return { ok: true, score: state.score, band: bandFor(state.score, twist), seconds: state.tick / TICKS_PER_SEC, detail: { seed, twist, drops: state.drops, maxLevel: state.maxLevel } };
}

// Season Nights (the launch mission): level 'n<night>t<level>'. The server rebuilds the level's rules and goal from the id, replays the drops,
// and accepts the run only if the goal was met while the crate was still standing. The run ends the moment the goal is met.
export function verifySeasonLevel(caseId, payload) {
  const m = /^n(\d+)t(\d+)$/.exec(String(caseId)), p = payload || {};
  const night = m ? Number(m[1]) : 0, level = m ? Number(m[2]) : 0;
  if (!m || night < 1 || night > SEASON.nights || level < 1 || level > SEASON.levels) return { ok: false, error: 'bad_log' };
  if (!Array.isArray(p.drops) || p.drops.length > MAX_DROPS || !Number.isInteger(p.endTick) || p.endTick < 1 || p.endTick > MAX_TICKS) return { ok: false, error: 'bad_log' };
  let last = -1;
  for (const d of p.drops) {
    if (!Array.isArray(d) || d.length !== 2 || !Number.isInteger(d[0]) || !Number.isInteger(d[1])) return { ok: false, error: 'bad_log' };
    if (d[0] < last || d[0] < 0 || d[0] > p.endTick || d[1] < -2000 || d[1] > 4000) return { ok: false, error: 'bad_log' };
    last = d[0];
  }
  const lvl = seasonLevel(night, level);
  const { state, bad } = replay(lvl.seed, p.drops, p.endTick, lvl.tw, goalMet);
  if (bad) return { ok: false, error: 'bad_log' };
  if (state.over || !goalMet(state)) return { ok: false, error: 'not_finished' };
  if (Number.isInteger(p.score) && p.score !== state.score) return { ok: false, error: 'mismatch' };
  return { ok: true, score: state.score, band: 0, seconds: state.tick / TICKS_PER_SEC, stored: { drops: p.drops, endTick: p.endTick }, detail: { night, level, drops: state.drops } };
}
