// TODDY Trail endless-level generator (offline). Builds random 9x13 layouts for each difficulty tier, keeps only the ones the solver
// can win, and writes them to games/toddy-trail/src/endless-pool.js. At run time the game picks one at random and varies it further
// (mirror, drink swap, visitor faces, floor theme), so a player cannot learn the order.
//
//   node --no-warnings tools/gen-endless.mjs [--per-tier 12] [--tiers 0,1,2,3,4,5] [--seed 1] [--out path]
//
// Nothing here decides game RULES (pass mark, time limit, breathers): those live in games/toddy-trail/src/levels.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solve } from './trail-solver.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const PER = +(args['per-tier'] || 12), TIERS = (args.tiers || '0,1,2,3,4,5').split(',').map(Number), SEED = +(args.seed || 1);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = args.out || path.join(here, '..', 'games', 'toddy-trail', 'src', 'endless-pool.js');

const W = 9, H = 13, START = { x: 4, y: 9, dir: 0 };
const WHO = ['milo', 'pip', 'velvet', 'lumi', 'biscuit'];
// tier -> what a level of that tier may contain: [min,max] ranges
const TIER = [
  { nv: [3, 4], walls: [0, 1], shut: [0, 0], cart: 0, thief: 0, pud: [0, 0], brew: [1, 2] },
  { nv: [4, 5], walls: [1, 1], shut: [0, 0], cart: 0, thief: 0, pud: [1, 2], brew: [2, 2] },
  { nv: [5, 6], walls: [1, 2], shut: [1, 1], cart: 0, thief: 0, pud: [1, 2], brew: [2, 3] },
  { nv: [6, 7], walls: [2, 2], shut: [1, 1], cart: 1, thief: 0, pud: [2, 3], brew: [3, 3] },
  { nv: [7, 8], walls: [2, 2], shut: [1, 2], cart: 1, thief: 1, pud: [2, 3], brew: [4, 4] },
  { nv: [8, 9], walls: [2, 3], shut: [2, 2], cart: 1, thief: 1, pud: [3, 4], brew: [5, 5] },
];

function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = (rng, [lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const shuffle = (rng, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function build(rng, P) {
  const used = new Set(), K = (x, y) => x + ',' + y, free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !used.has(K(x, y));
  const take = (x, y) => used.add(K(x, y));
  for (let y = 8; y <= 12; y++) take(4, y);   // Toddy's start and the line of cups behind him
  for (const [x, y] of [[3, 9], [5, 9], [3, 8], [5, 8]]) take(x, y);
  // walls of tables with gaps, some gaps get a shutter
  const tables = [], shutters = [], wallRows = shuffle(rng, [3, 4, 5, 6, 7]).slice(0, R(rng, P.walls));
  const want = R(rng, P.shut); let shutLeft = want;
  for (const y of wallRows) {
    if (wallRows.some((o) => o !== y && Math.abs(o - y) < 2)) { /* neighbouring walls would close the lane: skip this one */ if (y > wallRows[0]) continue; }
    const gaps = new Set(); const ng = 1 + (rng() < 0.5 ? 1 : 0); while (gaps.size < ng) gaps.add(R(rng, [0, 8]));
    const gl = [...gaps];
    for (let x = 0; x < W; x++) {
      if (gaps.has(x)) { if (shutLeft > 0 && x >= 1 && x <= 7 && rng() < 0.7) { shutters.push({ x, y, on: R(rng, [3, 5]), off: R(rng, [4, 7]), phase: R(rng, [0, 6]) }); shutLeft--; } take(x, y); continue; }
      if (x >= 1 && x <= 7 && free(x, y) && rng() < 0.92) { tables.push([x, y]); take(x, y); }
    }
    void gl;
  }
  for (let i = 0, n = R(rng, [0, 2]); i < n; i++) { const x = R(rng, [1, 7]), y = R(rng, [1, 11]); if (free(x, y)) { tables.push([x, y]); take(x, y); } }
  // visitors on the edges
  const visitors = [], nv = R(rng, P.nv);
  const cand = [];
  for (let y = 1; y <= 12; y++) { cand.push({ bx: 0, by: y, sx: 1, sy: y }); cand.push({ bx: 8, by: y, sx: 7, sy: y }); }
  for (let x = 1; x <= 7; x++) cand.push({ bx: x, by: 0, sx: x, sy: 1 });
  for (const c of shuffle(rng, cand)) {
    if (visitors.length >= nv) break;
    if (!free(c.bx, c.by) || !free(c.sx, c.sy)) continue;
    if (visitors.some((v) => Math.abs(v.sx - c.sx) + Math.abs(v.sy - c.sy) < 2)) continue;
    take(c.bx, c.by); take(c.sx, c.sy); visitors.push({ who: pick(rng, WHO), ...c, want: R(rng, [0, 2]) });
  }
  if (visitors.length < nv) return null;
  // brew spots (enough of them that the cup queue can supply everyone: 3 starting cups + one per station)
  const brew = [], nb = Math.min(6, Math.max(R(rng, P.brew), visitors.length - 3)), drinks = shuffle(rng, [0, 1, 2]);
  for (let i = 0, tries = 0; brew.length < nb && tries < 200; tries++) {
    const x = R(rng, [1, 7]), y = R(rng, [1, 12]); if (!free(x, y)) continue;
    take(x, y); brew.push({ x, y, drink: i < 3 ? drinks[i] : R(rng, [0, 2]) }); i++;
  }
  if (brew.length < nb) return null;
  // wants are built from a cup-queue plan, so the order of cups can always work: visit visitors in a random order, and either serve the
  // front cup of the queue or first pick up the next brew station's cup
  { const order = shuffle(rng, visitors.map((_, i) => i)), queue = [0, 1, 2]; let nextB = 0;
    for (const vi of order) {
      while (queue.length === 0 || (nextB < brew.length && queue.length < 4 && rng() < 0.4)) { if (nextB >= brew.length) return null; queue.push(brew[nextB++].drink); }
      visitors[vi].want = queue.shift(); } }
  // cart and thief: a straight row of free cells
  const lane = (len, rows) => { for (let t = 0; t < 60; t++) { const y = pick(rng, rows), x0 = R(rng, [0, W - len]); let ok = true; for (let x = x0; x < x0 + len; x++) if (!free(x, y) && !shutters.some((s) => s.x === x && s.y === y)) ok = false; if (ok) return Array.from({ length: len }, (_, i) => [x0 + i, y]); } return null; };
  let cart = null, thief = null;
  if (P.cart) { const p = lane(R(rng, [4, 6]), [2, 3, 4, 5, 6, 7, 8, 10, 11]); if (!p) return null; cart = { path: p, every: R(rng, [2, 3]) }; }
  if (P.thief) { const p = lane(R(rng, [3, 5]), [1, 2, 3, 11, 12]); if (!p) return null; thief = { path: p, every: R(rng, [3, 4]) }; }
  const puddles = [];
  for (let i = 0, n = R(rng, P.pud), tries = 0; puddles.length < n && tries < 100; tries++) { const x = R(rng, [0, 8]), y = R(rng, [1, 12]); if (free(x, y)) { puddles.push([x, y]); take(x, y); } }
  // every spot and brew cell must be reachable on foot (ignoring moving things)
  const blockedC = new Set([...tables.map(([x, y]) => K(x, y)), ...visitors.map((v) => K(v.bx, v.by))]);
  const seen = new Set([K(START.x, START.y)]), q = [[START.x, START.y]];
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || blockedC.has(K(nx, ny)) || seen.has(K(nx, ny))) continue; seen.add(K(nx, ny)); q.push([nx, ny]); } }
  if (!visitors.every((v) => seen.has(K(v.sx, v.sy))) || !brew.every((b) => seen.has(K(b.x, b.y)))) return null;
  const def = { id: 0, name: 'Endless', w: W, h: H, seconds: 90, start: START, cups: [0, 1, 2], tables, brew, visitors };
  if (shutters.length) def.shutters = shutters;
  if (cart) def.cart = cart;
  if (thief) def.thief = thief;
  if (puddles.length) def.puddles = puddles;
  return def;
}

const pool = fs.existsSync(OUT) && args.append ? JSON.parse(fs.readFileSync(OUT, 'utf8').split('\n').find((l) => l.startsWith('export const POOL')).replace(/^export const POOL = /, '').replace(/;$/, '')) : [];
const t0 = Date.now(); let tried = 0, solvedN = 0, nulls = 0, unsolved = 0;
for (const tier of TIERS) {
  const rng = rngOf(SEED * 1000 + tier * 97 + pool.length);
  let got = pool.filter((l) => l.tier === tier).length;
  while (got < PER) {
    if (process.env.GDBG) process.stderr.write('build\n'); const def = build(rng, TIER[tier]); tried++; if (process.env.GDBG) process.stderr.write(def ? 'built\n' : 'null\n');
    if (tried % 100 === 0) process.stderr.write(`  ...${tried} layouts tried, ${nulls} unbuildable, ${unsolved} unsolved/unclean\n`);
    if (!def) { nulls++; continue; }
    let r = null;
    for (const width of tier <= 2 ? [300, 1500] : [800, 4000, 12000]) { r = solve(def, { width, maxSeconds: 90 }); if (r.won) break; }
    if (!r.won || r.spills || r.snatched || r.wrong) { unsolved++; continue; }   // keep levels that can be won cleanly
    solvedN++; got++;
    const { id, name, seconds, ...rest } = def;
    pool.push({ tier, best: r.steps, ...rest });
    process.stderr.write(`tier ${tier} #${got}/${PER}: best ${(r.steps / 4).toFixed(1)}s, ${def.visitors.length} visitors  (tried ${tried}, ${((Date.now() - t0) / 1000) | 0}s)\n`);
  }
}
const head = `// GENERATED by tools/gen-endless.mjs: do not edit by hand. Each level was proven winnable (cleanly) by tools/trail-solver.mjs.\n// tier = difficulty band (0 easiest); best = the fewest steps the solver needed (4 steps = 1 second).\n`;
fs.writeFileSync(OUT, head + 'export const POOL = ' + JSON.stringify(pool) + ';\n');
console.error(`done: ${pool.length} levels, ${tried} layouts tried, ${((Date.now() - t0) / 1000) | 0}s -> ${OUT}`);
