// Server check for a Scam Lab Daily Quickie: rebuild the night's case from the date, score the player's
// pinned clues and decision with the game's own scoring code, and turn the stars into a medal.
import { dailyCase } from '../../games/scam-lab/src/daily.js';
import { scoreDaily } from '../../games/scam-lab/src/engine.js';

export const MAX_SECONDS = 600;

export function verify(night, payload) {
  const p = payload || {};
  const c = dailyCase(night);
  if (!p.marks || typeof p.marks !== 'object' || Array.isArray(p.marks)) return { ok: false, error: 'bad_log' };
  const marks = {};
  for (const [k, v] of Object.entries(p.marks)) {
    if (!Object.prototype.hasOwnProperty.call(c.clues, k) || (v !== 'flag' && v !== 'ok')) return { ok: false, error: 'bad_log' };
    marks[k] = v;
  }
  if (p.decision !== null && (typeof p.decision !== 'string' || !c.actions.some((a) => a.id === p.decision))) return { ok: false, error: 'bad_log' };
  if (!Number.isFinite(p.seconds) || p.seconds < 1 || p.seconds > MAX_SECONDS) return { ok: false, error: 'bad_log' };
  const r = scoreDaily(c, { marks, decision: p.decision, seconds: p.seconds });
  if (Number.isInteger(p.score) && p.score !== r.total) return { ok: false, error: 'mismatch' };
  // 0 stars (an unsafe decision) is still "played"; 1, 2, 3 stars are Bronze, Silver, Gold.
  return { ok: true, score: r.total, band: r.stars, seconds: p.seconds, stored: { marks, decision: p.decision, seconds: p.seconds }, detail: { stars: r.stars, decision: r.decisionKind } };
}
