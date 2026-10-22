// Endless mode checks (offline, a bit slow because it re-runs the solver):  node --no-warnings server/test/trail-endless.mjs
// 1) every level in the pool is well formed; 2) random variation is deterministic for a given random source and never changes
//    winnability (re-proved with the solver); 3) the config decides the time limit and the tier, and nothing else does.
import assert from 'node:assert/strict';
import { POOL } from '../../games/toddy-trail/src/endless-pool.js';
import { ENDLESS } from '../../games/toddy-trail/src/endless-config.js';
import { makeLevel } from '../../games/toddy-trail/src/endless.js';
import { solve } from '../../tools/trail-solver.mjs';

const K = (x, y) => x + ',' + y;
function wellFormed(l, label) {
  assert.equal(l.w, 9); assert.equal(l.h, 13);
  const inb = (x, y) => x >= 0 && y >= 0 && x < 9 && y < 13;
  const cells = new Set();
  for (let y = 8; y <= 12; y++) cells.add(K(4, y));   // start + cup line must stay clear
  const own = (x, y, what) => { assert.ok(inb(x, y), label + ': ' + what + ' out of bounds'); assert.ok(!cells.has(K(x, y)), label + ': ' + what + ' overlaps at ' + K(x, y)); cells.add(K(x, y)); };
  for (const [x, y] of l.tables) own(x, y, 'table');
  for (const v of l.visitors) { own(v.bx, v.by, 'visitor body'); own(v.sx, v.sy, 'visitor spot'); assert.ok([0, 1, 2].includes(v.want)); }
  for (const b of l.brew) { own(b.x, b.y, 'brew'); assert.ok([0, 1, 2].includes(b.drink)); }
  assert.ok(l.visitors.length >= 3 && l.visitors.length <= 9, label + ': visitor count');
  assert.ok(l.best > 0 && l.best < 360, label + ': best time');
}
POOL.forEach((l, i) => wellFormed(l, 'pool #' + i));
const tiers = [...new Set(POOL.map((l) => l.tier))];
console.log('pool:', POOL.length, 'levels in tiers', tiers.join(','));

const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// same random source -> same level
{ const a = makeLevel(7, POOL, ENDLESS, seeded(5)), b = makeLevel(7, POOL, ENDLESS, seeded(5)); assert.deepEqual(a, b); }
// different random sources -> the runs vary (not always the same layout)
{ const sigs = new Set(); for (let s = 1; s <= 30; s++) { const l = makeLevel(3, POOL, ENDLESS, seeded(s)); sigs.add(JSON.stringify([l.recipe.index, l.recipe.mirror, l.recipe.perm, l.recipe.theme])); } assert.ok(sigs.size >= 15, 'level 3 varies between runs (' + sigs.size + ' different of 30)'); }
// the time limit comes from the config
{ const l = makeLevel(1, POOL, { ...ENDLESS, timeFactor: () => 10, minSeconds: 1 }, seeded(1)); assert.equal(l.def.seconds, Math.ceil((l.best / 4) * 10)); const m = makeLevel(1, POOL, { ...ENDLESS, timeFactor: () => 0.01, minSeconds: 33 }, seeded(1)); assert.equal(m.def.seconds, 33); }
// tier comes from the config
{ const l = makeLevel(1, POOL, { ...ENDLESS, tierFor: () => tiers[tiers.length - 1] }, seeded(2)); assert.equal(l.recipe.tier, tiers[tiers.length - 1]); }
// transformed levels are still winnable: one per tier, with mirror on and a drink swap
let checked = 0;
for (const t of tiers) {
  const l = makeLevel(1, POOL, { ...ENDLESS, tierFor: () => t }, seeded(40 + t), { mirror: true, perm: [2, 0, 1] });
  wellFormed({ ...l.def, best: l.best, tables: l.def.tables }, 'transformed tier ' + t);
  const r = solve(l.def, { width: t <= 2 ? 1500 : 14000, maxSeconds: 90, maxMs: 170000 });
  assert.ok(r.won, 'transformed tier ' + t + ' level is winnable'); checked++;
}
console.log('endless: all checks passed (' + checked + ' transformed levels re-solved)');
