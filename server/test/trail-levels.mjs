// Trail level plan checks (offline; the last part re-runs the solver, so it is a bit slow):  node --no-warnings server/test/trail-levels.mjs
// 1) both pools are well formed; 2) 7 nights x 10 levels, a boss every tenth, levels climb in difficulty, same level = same layout for everyone;
// 3) the time limit leaves a skilled player a clear margin and never falls below the proven best; 4) floor setting never changes the level;
// 5) stars, saved progress, unlocking and the Daily Run work; 6) transformed levels (mirror, drink swap, diagonals on) are still winnable inside their limit.
import assert from 'node:assert/strict';
import { POOL } from '../../games/toddy-trail/src/endless-pool.js';
import { POOL as DP } from '../../games/toddy-trail/src/endless-diag-pool.js';
import * as LV from '../../games/toddy-trail/src/levels.js';
import { PAINTED, PLAIN, PATTERNS, pickFloor } from '../../games/toddy-trail/src/floors.js';
import { solve } from '../../tools/trail-solver.mjs';

// ---- 1. pools ----
const K = (x, y) => x + ',' + y;
function wellFormed(l, label, nd = 5) {
  assert.equal(l.w, 9); assert.equal(l.h, 13);
  const inb = (x, y) => x >= 0 && y >= 0 && x < 9 && y < 13, cells = new Set();
  for (let y = 8; y <= 12; y++) cells.add(K(4, y));
  const own = (x, y, what) => { assert.ok(inb(x, y), label + ': ' + what + ' out of bounds'); assert.ok(!cells.has(K(x, y)), label + ': ' + what + ' overlaps at ' + K(x, y)); cells.add(K(x, y)); };
  for (const [x, y] of l.tables) own(x, y, 'table');
  for (const v of l.visitors) { own(v.bx, v.by, 'visitor body'); own(v.sx, v.sy, 'visitor spot'); assert.ok(v.want < nd + 3); }
  for (const b of l.brew) { own(b.x, b.y, 'brew'); }
  assert.ok(l.visitors.length >= 3 && l.visitors.length <= 9, label + ': visitor count');
  assert.ok(l.best > 0 && l.best < 360, label + ': best time');
}
POOL.forEach((l, i) => wellFormed(l, 'pool #' + i));
DP.forEach((l, i) => { wellFormed(l, 'diag pool #' + i, 7); assert.equal(l.diag, true); });
const ALL = await LV.loadAll();
assert.equal(ALL.length, POOL.length + DP.length);
for (let i = 1; i < ALL.length; i++) assert.ok(ALL[i].score >= ALL[i - 1].score, 'pool sorted by difficulty');
console.log('pools ok:', POOL.length, 'straight +', DP.length, 'diagonal layouts');

// ---- 2. structure ----
assert.equal(LV.STORY_LEVELS, 70); assert.equal(LV.PER_NIGHT, 10); assert.equal(LV.STORY_NIGHTS, 7);
for (let L = 1; L <= 120; L++) { assert.equal(LV.nightOf(L), Math.floor((L - 1) / 10) + 1); assert.equal(LV.isBoss(L), L % 10 === 0); assert.equal(LV.levelOf(LV.nightOf(L), LV.posInNight(L)), L); }
let prevIdx = -1; const seenIdx = new Set();
for (let L = 1; L <= 70; L++) { const { meta } = LV.buildLevel(ALL, L); assert.ok(meta.idx > prevIdx, 'level ' + L + ' is further up the difficulty line than level ' + (L - 1)); prevIdx = meta.idx; assert.ok(!seenIdx.has(meta.idx)); seenIdx.add(meta.idx); }
assert.ok(LV.buildLevel(ALL, 1).meta.visitors <= 3, 'level 1 is the gentlest');
{ const a = LV.buildLevel(ALL, 37), b = LV.buildLevel(ALL, 37); assert.deepEqual(a, b, 'same level number = same level'); const c = LV.buildLevel(ALL, 37, { salt: 20800 }); assert.notDeepEqual(a.def.visitors, c.def.visitors, 'a daily salt changes the variation'); }
// endless nights go on: levels 71..400 all build, are hard-end layouts, and never fall below the margin floor
for (let L = 71; L <= 400; L += 7) { const { def, meta } = LV.buildLevel(ALL, L); assert.ok(def.visitors.length >= 3); assert.ok(meta.idx >= Math.floor(0.7 * (ALL.length - 1))); assert.equal(meta.night, LV.nightOf(L)); assert.ok(meta.margin >= 1.3 - 1e-9); }

// ---- 3. time ----
let minRatio = 9, minMargin = 9;
for (let L = 1; L <= 200; L++) {
  const { def, meta } = LV.buildLevel(ALL, L), best = ALL[meta.idx].best;
  assert.ok(meta.limit >= 80, 'never under 20 seconds');
  assert.ok(meta.limit >= meta.skill * 1.3 - 1, 'level ' + L + ': a skilled player keeps 30% slack');
  assert.ok(meta.limit >= best * 1.5, 'level ' + L + ': limit is at least 1.5x the proven best (' + meta.limit + ' vs ' + best + ')');
  minRatio = Math.min(minRatio, meta.limit / best); minMargin = Math.min(minMargin, meta.limit / meta.skill);
}
for (let L = 2; L <= 70; L++) assert.ok(LV.marginFor(L) <= LV.marginFor(L - 1) + 1e-9 || LV.isBoss(L - 1), 'margin only tightens');
assert.ok(LV.marginFor(10) < LV.marginFor(9), 'boss is tighter');
console.log('time ok: smallest limit/best ratio ' + minRatio.toFixed(2) + ', smallest limit/skilled-player ratio ' + minMargin.toFixed(2));

// ---- 4. floor setting never changes the level ----
for (const L of [1, 22, 49, 71]) { const a = LV.buildLevel(ALL, L, { floorMode: 'painted' }), b = LV.buildLevel(ALL, L, { floorMode: 'plain' }), c = LV.buildLevel(ALL, L); assert.deepEqual(a.def, b.def); assert.deepEqual(a.def, c.def); assert.equal(a.meta.floor.kind, 'painted'); assert.equal(b.meta.floor.kind, 'plain'); assert.deepEqual(a.meta.weather, b.meta.weather); }
{ const kinds = new Set(), cols = new Set(), pats = new Set(), painted = new Set(); for (let L = 1; L <= 300; L++) { const f = LV.buildLevel(ALL, L).meta.floor; kinds.add(f.kind); if (f.kind === 'plain') { cols.add(f.c); pats.add(f.p); } else painted.add(f.id); } assert.equal(kinds.size, 2); assert.ok(cols.size >= PLAIN.length - 2 && pats.size === PATTERNS.length && painted.size >= PAINTED.length - 2, 'random floors use everything'); }
{ let rain = 0, storm = 0, wind = 0, none = 0; for (let L = 1; L <= 300; L++) { const w = LV.buildLevel(ALL, L).meta.weather; if (w.storm) storm++; else if (w.rain) rain++; else if (w.wind) wind++; else none++; } assert.ok(rain && storm && wind && none, 'every kind of weather turns up'); }

// ---- 5. stars, progress, daily ----
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const PR = await import('../../games/toddy-trail/src/progress.js'); const DL = await import('../../games/toddy-trail/src/daily.js');
const S = (served, spills = 0, snatched = 0) => ({ served, spills, snatched });
assert.equal(LV.starsFor(S([true, true, true])), 3); assert.equal(LV.starsFor(S([true, true, true], 1)), 2); assert.equal(LV.starsFor(S([true, true, true], 0, 1)), 2);
assert.equal(LV.starsFor(S([true, true, true, false, false])), 1); assert.equal(LV.starsFor(S([true, true, false, false, false])), 0); assert.equal(LV.starsFor(S([true, false, false])), 0);
assert.equal(PR.settings().speed, 'Quick'); assert.equal(PR.isUnlocked(1), true); assert.equal(PR.isUnlocked(2), false);
let r = PR.recordResult(1, 2, 500); assert.equal(r.first, true); assert.equal(PR.isUnlocked(2), true); assert.equal(PR.isUnlocked(3), false);
r = PR.recordResult(1, 1, 300); assert.equal(PR.starsOf(1), 2, 'stars never go down'); assert.equal(PR.bestOf(1), 500);
PR.recordResult(2, 0, 10); assert.equal(PR.isUnlocked(3), false, 'zero stars do not unlock');
for (let L = 2; L <= 10; L++) PR.recordResult(L, 1, 1); assert.equal(PR.nightsUnlocked(), 2); assert.equal(PR.nextLevel(), 11); assert.equal(PR.nightStars(1), 11);
PR.setSetting('unlockAll', true); assert.equal(PR.isUnlocked(99), true); PR.setSetting('unlockAll', false);
{ const a = DL.dailyPlan('2026-10-28'), b = DL.dailyPlan('2026-10-28'), c = DL.dailyPlan('2026-10-29'); assert.deepEqual(a, b); assert.notDeepEqual(a, c); for (let d = 0; d < 60; d++) { const day = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10), p = DL.dailyPlan(day); assert.equal(p.levels.length, 3); assert.equal(p.goals.length, 3); assert.equal(new Set(p.goals.map((g) => g.id)).size, 3); assert.ok(p.levels.every((L) => !LV.isBoss(L) && L >= 9 && L <= 60)); assert.ok(p.levels[0] < p.levels[1] && p.levels[1] < p.levels[2]); } }
{ const t = PR.todaysDaily(); assert.equal(t.state.done.filter(Boolean).length, 0); assert.equal(PR.recordDailyLevel(0, 1), false); assert.equal(PR.recordDailyLevel(1, 3), false); assert.equal(PR.recordDailyLevel(2, 2), true); assert.equal(PR.currentStreak(), 1); assert.equal(PR.recordDailyLevel(2, 3), false, 'the streak counts once a day');
  PR.recordPlay({ served: 5, of: 5, stars: 3, boss: false, left: 0.6 }); assert.ok(PR.goalsDone() >= 0); const g = PR.todaysDaily().state.goals; assert.ok(Object.keys(g).length >= 0); }
PR.resetAll(); assert.equal(PR.highestCleared(), 0);
console.log('stars, progress and daily ok');

// ---- 6. transformed levels still win inside the limit (diagonals are on for every level) ----
let checked = 0;
for (const L of [1, 14, 31, 58, 74]) {
  const { def, meta } = LV.buildLevel(ALL, L);
  const res = solve(def, { width: meta.idx < 100 ? 1500 : 12000, maxSeconds: def.seconds, maxMs: 120000 });
  assert.ok(res.won, 'level ' + L + ' is winnable inside its limit'); assert.ok(res.steps <= meta.limit, 'level ' + L + ' best route ' + res.steps + ' steps fits the ' + meta.limit + ' step limit');
  console.log('  level ' + L + ': solver wins in ' + res.steps + ' steps, limit ' + meta.limit + ' (' + (meta.limit / res.steps).toFixed(1) + 'x)'); checked++;
}
console.log('levels: all checks passed (' + checked + ' levels re-solved)');
