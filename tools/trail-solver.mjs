// TODDY Trail solver: a beam search over the REAL game steps (core.js), so "solvable" means exactly what the game will accept.
// Used offline by tools/gen-endless.mjs to prove every generated level can be won, and to measure its best time.
import { newState, step, registerLevel, NIGHTS } from '../games/toddy-trail/src/core.js';

const clone = (s) => ({ ...s, cups: s.cups.slice(), ages: s.ages.slice(), hist: s.hist.map((h) => ({ x: h.x, y: h.y })), served: s.served.slice(), brewCool: s.brewCool.slice(), events: [] });
const key = (s) => [s.x, s.y, s.dir, s.holding ? 1 : 0, s.bumped ? 1 : 0, s.soft ? 1 : 0, s.cups.join(''), s.ages.map((a) => Math.min(Math.ceil(a / 4), 60)).join('.'), s.served.map(Number).join(''), s.brewCool.map((c) => Math.ceil(c / 5)).join(','), s.cartI, s.thiefI, s.thiefCool > 0 ? 1 : 0, s.hist.slice(0, 2).map((h) => h.x + '.' + h.y).join(':')].join('|');
const val = (s) => s.served.filter(Boolean).length * 1000 - (s.spills + s.snatched + s.wrong + s.cold) * 150 + s.cups.length * 30 - s.bumps * 20;

// def: a level definition (same shape as NIGHTS entries). Returns { won, steps, log, served } where steps is the step count of the first win found.
export function solve(def, { width = 1500, maxSeconds = 90, id = 9999, maxMs = 60000 } = {}) {
  const t0 = Date.now();
  registerLevel(id, { ...def, seconds: maxSeconds });
  let layer = [{ s: newState(id), log: [] }];
  const limit = maxSeconds * 4;
  for (let t = 0; t < limit; t++) {
    if (Date.now() - t0 > maxMs) break;
    const seen = new Map();
    for (const { s, log } of layer) for (const a of (def.diag ? [null, 0, 1, 2, 3, 4, 5, 6, 7, 8] : [null, 0, 1, 2, 3, 4])) {
      if (a === 4 && !s.holding) continue;
      const c = clone(s); step(c, a);
      if (c.snatched > 0 && c.served.filter(Boolean).length < c.served.length) { /* allowed but penalised by val */ }
      const k = key(c), v = val(c) - (c.holding ? 0 : 5), prev = seen.get(k);
      if (!prev || prev.v < v) seen.set(k, { s: c, log: a === null ? log : [...log, [s.t, a]], v });
    }
    layer = [...seen.values()].sort((a, b) => b.v - a.v).slice(0, width);
    const w = layer.find((e) => e.s.won);
    if (w) { delete NIGHTS[id]; return { won: true, steps: w.s.t, log: w.log, spills: w.s.spills, snatched: w.s.snatched, wrong: w.s.wrong, cold: w.s.cold }; }
  }
  const b = layer[0].s; delete NIGHTS[id];
  return { won: false, steps: limit, log: [], served: b.served.filter(Boolean).length };
}
