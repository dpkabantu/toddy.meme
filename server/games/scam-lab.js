// Server check for a Scam Lab Daily Quickie: rebuild the night's case from the date, score the player's
// pinned clues and decision with the game's own scoring code, and turn the stars into a medal.
import { dailyCase, setDailySet } from '../../games/scam-lab/src/daily.js';
import DAILY from '../../games/scam-lab/cases/daily.json' with { type: 'json' };
import { scoreDaily, scoreCase, scoreRush } from '../../games/scam-lab/src/engine.js';
import { CASES } from './scam-lab-cases.js';

setDailySet(DAILY);   // the 42 written Daily Quickie cases, the same list the game loads
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

// ---- chapter cases (Season missions): the same scoring code the game uses, run on what the player did ----
export const CASE_MAX_SECONDS = 1800;
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const BAD = { ok: false, error: 'bad_log' };
export function verifyCase(caseId, payload) {
  const c = typeof caseId === 'string' && Object.prototype.hasOwnProperty.call(CASES, caseId) ? CASES[caseId] : null;
  const p = payload || {};
  if (!c) return BAD;
  if (!Number.isFinite(p.seconds) || p.seconds < 1 || p.seconds > CASE_MAX_SECONDS) return BAD;
  const quickIds = ((c.quick_check && c.quick_check.options) || []).map((o) => o.id);
  const quickAnswer = p.quickAnswer === null || p.quickAnswer === undefined ? null : p.quickAnswer;
  if (quickAnswer !== null && (typeof quickAnswer !== 'string' || !quickIds.includes(quickAnswer))) return BAD;
  let r, stored;
  if (c.cards) {                                                   // Inbox Rush
    if (!isObj(p.answers) || !Number.isFinite(p.secondsLeft) || p.secondsLeft < 0 || p.secondsLeft > c.seconds) return BAD;
    const ids = c.cards.map((k) => k.id), answers = {};
    for (const [k, v] of Object.entries(p.answers)) { if (!ids.includes(k) || (v !== 'scam' && v !== 'safe')) return BAD; answers[k] = v; }
    if (!Object.keys(answers).length) return { ok: false, error: 'not_finished' };
    r = scoreRush(c, answers, p.secondsLeft, quickAnswer);
    stored = { case: caseId, answers, secondsLeft: p.secondsLeft, quickAnswer, seconds: p.seconds };
  } else {                                                         // hunt, duel, boss
    if (!isObj(p.marks)) return BAD;
    const marks = {};
    for (const [k, v] of Object.entries(p.marks)) { if (!Object.prototype.hasOwnProperty.call(c.clues, k) || (v !== 'flag' && v !== 'ok')) return BAD; marks[k] = v; }
    if (typeof p.decision !== 'string' || !c.actions.some((a) => a.id === p.decision)) return { ok: false, error: 'not_finished' };
    const hints = p.hints === undefined ? 0 : p.hints;
    if (!Number.isInteger(hints) || hints < 0 || hints > 30) return BAD;
    let seen = null;
    if (p.seen !== null && p.seen !== undefined) { if (!Array.isArray(p.seen) || p.seen.length > 200 || p.seen.some((k) => typeof k !== 'string' || !Object.prototype.hasOwnProperty.call(c.clues, k))) return BAD; seen = p.seen; }
    let board = null;
    if (p.board !== null && p.board !== undefined) {
      if (!c.board || !isObj(p.board) || !c.board.verdicts.some((v) => v.id === p.board.verdict) || !Array.isArray(p.board.picks) || p.board.picks.length > 20 || p.board.picks.some((k) => typeof k !== 'string')) return BAD;
      board = { verdict: p.board.verdict, picks: p.board.picks };
    }
    if (c.board && !board) return { ok: false, error: 'not_finished' };
    r = scoreCase(c, { marks, decision: p.decision, quickAnswer, seconds: p.seconds, hints, seen, board });
    stored = { case: caseId, marks, decision: p.decision, quickAnswer, seconds: p.seconds, hints, seen, board };
  }
  if (Number.isInteger(p.score) && p.score !== r.total) return { ok: false, error: 'mismatch' };
  return { ok: true, score: r.total, band: r.stars, seconds: p.seconds, stored, detail: { case: caseId, stars: r.stars } };
}
