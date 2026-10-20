// Server check for a Moon Brew Daily Brew: rebuild the night's tray, replay every tap, and work out the score.
import { generate, newGame, tap, useHint, dailyScore } from '../../games/moon-brew/src/core.js';
import { dailyConfig, seasonTrayConfig } from '../../games/moon-brew/src/levels.js';

export const MAX_LOG = 600;

export function verify(night, payload) { return replay(generate(dailyConfig(new Date(night + 'T12:00:00Z'))), payload); }

// Season launch mission tray 'n<night>t<tray>' (night 1-7, tray 1-20). The tray has to be cleared to count.
export function verifySeasonTray(caseId, payload) {
  const m = /^n([1-7])t([1-9]|1[0-9]|20)$/.exec(String(caseId));
  const cfg = m && seasonTrayConfig(Number(m[1]), Number(m[2]));
  if (!cfg) return { ok: false, error: 'bad_log' };
  const r = replay(generate(cfg), payload);
  if (r.ok && !r.detail.won) return { ok: false, error: 'not_won' };
  return r;
}

function replay(level, payload) {
  const p = payload || {};
  if (!Array.isArray(p.log) || p.log.length < 1 || p.log.length > MAX_LOG) return { ok: false, error: 'bad_log' };
  const g = newGame(level);
  let lastT = -1;
  for (const e of p.log) {
    if (!Array.isArray(e) || e.length !== 3 || !Number.isInteger(e[0]) || typeof e[1] !== 'string' || !Number.isInteger(e[2])) return { ok: false, error: 'bad_log' };
    const [id, kind, t] = e;
    if (t < lastT || t < 0 || t > 3600000) return { ok: false, error: 'bad_log' };
    if (lastT >= 0 && t - lastT < 40) return { ok: false, error: 'bad_log' };   // no human taps twice in 40 ms
    lastT = t;
    if (g.status !== 'playing') return { ok: false, error: 'bad_log' };           // moves after the end
    if (kind === 'h') { if (id !== -1) return { ok: false, error: 'bad_log' }; useHint(g, t); continue; }
    const bean = g.beans[id];
    if (!bean || bean.gone) return { ok: false, error: 'bad_log' };
    const before = g.log.length; tap(g, bean, t);
    if (g.log.length === before || g.log[g.log.length - 1][1] !== kind) return { ok: false, error: 'bad_log' };   // logged result must match the replay
  }
  if (g.status === 'playing') return { ok: false, error: 'not_finished' };
  const sc = dailyScore(g);
  if (Number.isInteger(p.score) && p.score !== sc.total) return { ok: false, error: 'mismatch' };
  return { ok: true, score: sc.total, band: bandForBrew(g, sc), seconds: sc.secs, detail: { won: g.status === 'won', bumps: g.bumps, hints: sc.hints, stars: g.status === 'won' ? 1 + (g.bumps === 0 ? 1 : 0) + (g.perfect ? 1 : 0) : 0 } };
}

// Placeholder thresholds (out of 1000). Not winning still counts as playing (band 0).
export function bandForBrew(g, sc) { return g.status !== 'won' ? 0 : sc.total >= 850 ? 3 : sc.total >= 650 ? 2 : 1; }
