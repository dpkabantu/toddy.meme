// A small look-ahead bot for Full Moon Season levels. It is not a person: it only proves that every level can be cleared,
// and gives a rough idea of how hard a level is (drops and seconds used). Used by the tests and by the tuning script.
import * as C from '../games/full-moon-core.js';

export const clone = (s) => ({ ...s, bodies: s.bodies.map((b) => ({ ...b })), events: [], ticket: s.ticket ? { ...s.ticket } : null });
function value(s, goal) {
  let minTop = 1e9; for (const b of s.bodies) { const top = b.y - b.r; if (top < minTop) minTop = top; }
  const danger = Math.max(0, (s.tw.closeY + 90) - minTop);
  const prog = goal.type === 'score' ? s.score : goal.type === 'piece' ? s.maxLevel * 60 : s.served * 120 + s.score * 0.2;
  return prog + s.merges * 2 - danger * 2.2 - (s.over ? 1e6 : 0);
}
export function playLevel(lvl, opts = {}) {
  const goal = lvl.tw.goal, s = C.newGame(lvl.seed, lvl.tw), drops = [], maxTicks = opts.maxTicks || 40000;
  const look = opts.look || 34;
  while (!s.over && s.tick < maxTicks) {
    if (C.goalMet(s)) return { won: true, drops, endTick: s.tick, score: s.score, state: s };
    if (C.levelLost(s)) break;
    if (C.canDrop(s)) {
      const lv = C.heldLevel(s), cands = new Set();
      for (const b of s.bodies) if (b.level === lv) { cands.add(Math.round(b.x)); }
      for (let i = 0; i <= 8; i++) cands.add(Math.round(C.FIELD.L + (C.FIELD.R - C.FIELD.L) * (i / 8)));
      let best = null, bv = -1e18;
      for (const x0 of cands) {
        const x = Math.round(C.clampX(lv, x0)), c = clone(s);
        C.drop(c, x); for (let i = 0; i < look && !c.over; i++) { C.step(c); c.events.length = 0; }
        const v = value(c, goal);
        if (v > bv) { bv = v; best = x; }
      }
      C.drop(s, best); drops.push([s.tick, best]);
      s.events.length = 0;
    }
    C.step(s); s.events.length = 0;
  }
  return { won: C.goalMet(s) && !s.over, drops, endTick: s.tick, score: s.score, state: s };
}
