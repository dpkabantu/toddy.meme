#!/usr/bin/env node
// Tunes the 140 Full Moon Season levels with the test bot and writes the goal table into server/games/full-moon-core.js.
//   node tools/fm-season-tune.mjs          calibrate and write the table
//   node tools/fm-season-tune.mjs --show   print the current table with the bot's results
// Effort rises on every level: the target number of drops goes from about 22 to about 130, with a little more at 5, 10, 15 and 20.
import fs from 'node:fs';
import * as C from '../server/games/full-moon-core.js';
import { clone, playLevel } from '../server/test/fm-bot.mjs';

const root = new URL('..', import.meta.url).pathname, corePath = root + 'server/games/full-moon-core.js';
const SHOW = process.argv.includes('--show');
const target = (g, l) => Math.round((22 + 0.78 * g) * (l === 20 ? 1.3 : l % 5 === 0 ? 1.15 : 1));
const KINDS = ['score', 'piece', 'serve'];
const typeOf = (n, l) => (l % 5 === 0 ? 'score' : (l % 4 === 2 && n >= 2) ? 'serve' : l % 2 === 0 ? 'piece' : 'score');

// One neutral run of the level's rules (no goal, no cap): the bot plays on and we record what it has after each drop.
function timeline(n, l, drops) {
  const lvl = C.seasonLevel(n, l), tw = { ...lvl.tw, goal: null, dropCap: 0 }, s = C.newGame(lvl.seed, tw), tl = [{ score: 0, maxLevel: 0, served: 0 }];
  while (!s.over && s.drops < drops) {
    if (C.canDrop(s)) {
      const lv = C.heldLevel(s), cands = new Set();
      for (const b of s.bodies) if (b.level === lv) cands.add(Math.round(b.x));
      for (let i = 0; i <= 8; i++) cands.add(Math.round(C.FIELD.L + (C.FIELD.R - C.FIELD.L) * (i / 8)));
      let best = 0, bv = -1e18;
      for (const x0 of cands) {
        const x = Math.round(C.clampX(lv, x0)), c = clone(s); C.drop(c, x);
        for (let i = 0; i < 34 && !c.over; i++) { C.step(c); c.events.length = 0; }
        let minTop = 1e9; for (const b of c.bodies) if (b.y - b.r < minTop) minTop = b.y - b.r;
        const v = c.score + c.merges * 2 - Math.max(0, tw.closeY + 90 - minTop) * 2.2 - (c.over ? 1e6 : 0);
        if (v > bv) { bv = v; best = x; }
      }
      C.drop(s, best); s.events.length = 0; tl.push({ score: s.score, maxLevel: s.maxLevel, served: s.served });
    }
    C.step(s); s.events.length = 0;
  }
  return { tl, over: s.over };
}
const first = (tl, f) => { const i = tl.findIndex(f); return i < 0 ? Infinity : i; };

const table = [], report = [];
for (let n = 1; n <= C.SEASON.nights; n++) for (let l = 1; l <= C.SEASON.levels; l++) {
  const g = (n - 1) * 20 + l - 1, D = target(g, l), type = typeOf(n, l), { tl, over } = timeline(n, l, Math.ceil(D * 2.2) + 10);
  if (over && tl.length - 1 < D * 1.3) report.push(`N${n} L${l}: the crate fills after ${tl.length - 1} drops, before ${D} (environment too hard)`);
  let goal;
  if (type === 'score') goal = { type, n: Math.max(30, Math.floor((tl[Math.min(D, tl.length - 1)].score) / 10) * 10) };
  else {
    const key = type === 'piece' ? 'maxLevel' : 'served', lo = type === 'piece' ? 5 : 1, hi = type === 'piece' ? (n >= 3 ? 10 : 9) : (n >= 4 ? 12 : 8);
    let bestV = lo, bestE = 1e9;
    for (let v = lo; v <= hi; v++) { const d = first(tl, (x) => x[key] >= v); if (d === Infinity) continue; const e = Math.abs(d - D) + (d > D * 1.15 ? 1000 : 0); if (e < bestE) { bestE = e; bestV = v; } }
    goal = { type, n: bestV };
  }
  // The bot with the real goal must win with room to spare under the cap; if not, the goal is eased one step and tried again.
  const tryGoal = (gl, cp) => playLevel({ seed: C.seasonLevel(n, l).seed, tw: { ...C.seasonLevel(n, l).tw, goal: gl, dropCap: cp } });
  let guard = 0, probe = tryGoal(goal, 0);
  while (!probe.won && guard++ < 12) { goal = goal.type === 'score' ? { ...goal, n: Math.max(30, Math.floor(goal.n * 0.92 / 10) * 10) } : { ...goal, n: Math.max(goal.type === 'piece' ? 5 : 1, goal.n - 1) }; probe = tryGoal(goal, 0); }
  if (!probe.won) report.push(`N${n} L${l}: the bot cannot win even the easiest goal`);
  const used = probe.won ? probe.drops.length : (type === 'score' ? first(tl, (x) => x.score >= goal.n) : first(tl, (x) => x[type === 'piece' ? 'maxLevel' : 'served'] >= goal.n));
  const cap = n >= 4 ? Math.ceil(Math.max(used === Infinity ? D : used, 8) * (1.8 - 0.45 * (g - 60) / 79)) : 0;
  table.push([KINDS.indexOf(goal.type), goal.n, cap]); report.push(`N${n} L${l} D${D} ${goal.type}:${goal.n} botDrops:${used} cap:${cap || '-'}`);
}
console.log(report.join('\n'));
if (SHOW) process.exit(0);
const rows = []; for (let i = 0; i < table.length; i += 10) rows.push('  ' + table.slice(i, i + 10).map((r) => '[' + r.join(',') + ']').join(','));
let src = fs.readFileSync(corePath, 'utf8');
src = src.replace(/\/\/ SEASON_TABLE:START[\s\S]*?\/\/ SEASON_TABLE:END/, '// SEASON_TABLE:START (written by tools/fm-season-tune.mjs: [goal kind 0 score 1 piece 2 serve, goal number, drop cap or 0], level by level)\nconst SEASON_TABLE = [\n' + rows.join(',\n') + '\n];\n// SEASON_TABLE:END');
fs.writeFileSync(corePath, src);
console.log('table written: ' + table.length + ' levels');
