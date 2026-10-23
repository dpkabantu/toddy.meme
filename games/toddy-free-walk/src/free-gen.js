// TODDY Free Walk: random levels that get harder, each PROVEN winnable before the player sees it.
// makeLevel(n, seed, prevTheme) builds a random level n from a seed (same seed = same level). Then a bot plays it with the real rules (free-core.js):
// it finds paths around every hurdle and hazard on a fine grid and walks them with the same touch commands a player sends. A level is only used if the
// bot serves everyone WITHOUT a single spill, snatch or wrong cup; otherwise the generator quietly tries the next layout. The bot's time sets the time limit.
// Deterministic apart from the seed: the PRNG is integer-only.
import { newState, step, LEVEL1, BOUNDS, R_TODDY, R_SOLID, R_CART, R_PUDDLE, SNATCH_R, TICKS_PER_SEC } from './free-core.js';

export const WHO = ['milo', 'pip', 'velvet', 'lumi', 'biscuit'];                 // every visitor appears
export const THEMES = [1, 2, 3, 4, 5, 6, 7, 101, 102, 103, 104, 105];            // the 12 Trail floors (0 is the plain floor of level 1)
// the obstacle picture each floor uses, and how tall it stands in cells (same as Trail); floor 1 (the cafe) borrows the table
export const OBSTACLE = { 1: 'table', 2: 'table', 3: 'crates', 4: 'barrel', 5: 'shelf', 6: 'post', 7: 'speaker', 101: 'planter', 102: 'suitcases', 103: 'rope', 104: 'snowman', 105: 'telescope' };
export const HURDLE_H = { barrel: 1.2, crates: 1.45, table: 1.85, shelf: 1.35, post: 1.3, speaker: 1.6, planter: 1.45, suitcases: 1.75, rope: 1.3, snowman: 1.55, telescope: 1.7 };

export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mix = (seed, n, k) => (seed ^ Math.imul(n, 0x9E3779B1) ^ Math.imul(k + 1, 0x85EBCA6B)) >>> 0;

// How hard level n is. EVERY number here is a starting estimate to tune after watching real players.
export function levelParams(n) {
  return {
    visitors: Math.min(9, 3 + Math.floor((n - 1) / 2)),            // 3 at levels 1-2, 9 from level 13
    hurdles: Math.min(8, 3 + Math.floor(n * 0.5)),                  // plus the river of hurdles when there is one; more would wall visitors in
    puddles: n >= 3 ? Math.min(5, 1 + Math.floor((n - 3) / 3)) : 0,
    cart: n >= 4,                                                  // the rolling cart
    wallChance: n >= 5 ? 0.5 : 0,                                  // a river of hurdles with one gap
    gate: n >= 6 ? 0.85 : 0,                                       // chance the gap has a shutter gate
    thief: n >= 7 ? 0.75 : 0,                                      // chance of a patrolling thief
    factor: Math.max(2.0, 3.8 - 0.07 * (n - 1)),                   // time limit = bot's time x this (lower = harder)
    minSeconds: 16,
  };
}

// ---- geometry the bot plans with (a little more careful than the real rules, so a plan that works on paper works in play) ----
const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
function segD2(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby; let t = l2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return d2(px, py, ax + abx * t, ay + aby * t);
}
function polyD2(px, py, path) { let m = 1e9; for (let i = 1; i < path.length; i++) { const v = segD2(px, py, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]); if (v < m) m = v; } return m; }
export function clearAt(L, x, y, extra, zones) {   // zones: extra circles to keep out of (other visitors' reach circles), optional
  if (x < BOUNDS.x0 || x > BOUNDS.x1 || y < BOUNDS.y0 || y > BOUNDS.y1) return false;
  if (zones) for (const z of zones) if (d2(x, y, z.x, z.y) < z.r * z.r) return false;
  const hr = R_TODDY + R_SOLID + extra, hr2 = hr * hr;
  for (const h of L.hurdles) if (d2(x, y, h.x, h.y) < hr2) return false;
  for (const v of L.visitors) if (d2(x, y, v.x, v.y) < hr2) return false;
  const pr = R_PUDDLE + 0.2; for (const p of L.puddles) if (d2(x, y, p.x, p.y) < pr * pr) return false;   // the bot never slides
  if (L.cart) { const cr = R_TODDY + R_CART + 0.2; if (polyD2(x, y, L.cart.path) < cr * cr) return false; }   // the whole cart lane counts as wall
  if (L.thief) { const tr = SNATCH_R + 0.15; if (polyD2(x, y, L.thief.path) < tr * tr) return false; }       // and the thief's whole patrol
  return true;   // shutter gates are passable on paper: the bot just waits when one is closed
}
const RES = 0.2, COLS = 45, ROWS = 65, N = COLS * ROWS;
function buildGrid(L) { const b = new Uint8Array(N); for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) b[j * COLS + i] = clearAt(L, (i + 0.5) * RES, (j + 0.5) * RES, 0.1) ? 0 : 1; return b; }
const cellOf = (x, y) => { const i = Math.max(0, Math.min(COLS - 1, Math.floor(x / RES))), j = Math.max(0, Math.min(ROWS - 1, Math.floor(y / RES))); return j * COLS + i; };

function goalMask(blocked, cx, cy, maxD, radius) {   // free cells within maxD of (cx, cy)
  const m = new Uint8Array(N); let any = false;
  for (let j = Math.max(0, Math.floor((cy - radius) / RES)); j <= Math.min(ROWS - 1, Math.floor((cy + radius) / RES)); j++) for (let i = Math.max(0, Math.floor((cx - radius) / RES)); i <= Math.min(COLS - 1, Math.floor((cx + radius) / RES)); i++) {
    const k = j * COLS + i; if (!blocked[k] && d2((i + 0.5) * RES, (j + 0.5) * RES, cx, cy) <= maxD * maxD) { m[k] = 1; any = true; }
  }
  return any ? m : null;
}
function pathTo(blocked, sx, sy, mask, extra) {   // Dijkstra over the grid, 8 directions, no corner cutting; returns the cell centres from start to the nearest goal
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), s = cellOf(sx, sy);
  const heap = [[0, s]]; dist[s] = 0;
  const push = (item) => { heap.push(item); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  while (heap.length) {
    const [d, u] = pop(); if (d > dist[u]) continue;
    if (mask[u]) { const out = []; for (let k = u; k !== -1; k = prev[k]) out.push([((k % COLS) + 0.5) * RES, (Math.floor(k / COLS) + 0.5) * RES]); return out.reverse(); }
    const ui = u % COLS, uj = Math.floor(u / COLS);
    for (const [di, dj, c] of DIRS) {
      const vi = ui + di, vj = uj + dj; if (vi < 0 || vj < 0 || vi >= COLS || vj >= ROWS) continue;
      const v = vj * COLS + vi; if (blocked[v]) continue;
      if (di !== 0 && dj !== 0 && (blocked[uj * COLS + vi] || blocked[vj * COLS + ui])) continue;
      const nd = d + c + (extra ? extra[v] : 0); if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); }
    }
  }
  return null;
}
function lineClear(L, ax, ay, bx, by, zones) { const len = Math.sqrt(d2(ax, ay, bx, by)), n = Math.max(1, Math.ceil(len / 0.08)); for (let k = 0; k <= n; k++) if (!clearAt(L, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, 0.04, zones)) return false; return true; }
function pull(L, pts, sx, sy, zones) {   // string pulling: keep only the corners, so Toddy walks long straight lines
  const out = []; let cx = sx, cy = sy, i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1; while (j > i + 1 && !lineClear(L, cx, cy, pts[j][0], pts[j][1], zones)) j--;
    out.push(pts[j]); cx = pts[j][0]; cy = pts[j][1]; i = j;
  }
  if (!out.length) out.push(pts[pts.length - 1]);
  return out;
}

// Walk to (x, y) with one touch and tick until he stops. Returns 'arrived' | 'serve' | 'soft' | 'hard' | 'timeout'.
function drive(st, x, y) {
  let first = true;
  for (let g = 0; g < 700 && !st.over; g++) {
    step(st, first ? { x, y, fresh: true } : null); first = false;
    if (st.events.some((e) => e.type === 'serve')) return 'serve';
    if (st.tx === null && st.slide === 0) return st.stop || 'arrived';
  }
  return 'timeout';
}

// Plays the level like a careful player would. ok only for a win with no cup spilled or snatched (it avoids sighs where it can).
export function solve(L) {
  const st = newState({ ...L, seconds: 400 }), base = buildGrid(L);   // plenty of time: the bot's own time is what sets the level's limit
  const fail = (why) => ({ ok: false, why, ticks: st.t });
  for (let guard = 0; !st.over && guard < 90 && st.t < 7000; guard++) {
    // Walking into the reach circle of a visitor who does NOT want the front cup makes him sigh, so those circles are walls for this leg
    // (unless Toddy is already standing inside one: then nothing new triggers). Visitors who want the front cup are fine: a serve is a serve.
    const zones = [];
    L.visitors.forEach((v, i) => { if (!st.served[i] && !st.near[i] && !(st.cups.length && v.want === st.cups[0])) zones.push({ x: v.x, y: v.y, r: 1.05 }); });
    const blocked = base, extra = new Float32Array(N);   // crossing such a circle costs time (a sigh and a short stop), it is not forbidden
    for (const z of zones) for (let j = Math.max(0, Math.floor((z.y - z.r) / RES)); j <= Math.min(ROWS - 1, Math.floor((z.y + z.r) / RES)); j++) for (let i = Math.max(0, Math.floor((z.x - z.r) / RES)); i <= Math.min(COLS - 1, Math.floor((z.x + z.r) / RES)); i++) if (d2((i + 0.5) * RES, (j + 0.5) * RES, z.x, z.y) < z.r * z.r) extra[j * COLS + i] = 30;
    let mask = null;
    if (st.cups.length) {
      const front = st.cups[0], m = new Uint8Array(N); let any = false;
      L.visitors.forEach((v, i) => { if (!st.served[i] && v.want === front) { const g = goalMask(blocked, v.x, v.y, 0.93, 1.3); if (g) { for (let k = 0; k < N; k++) if (g[k]) m[k] = 1; any = true; } } });
      if (!any) return fail('no reachable visitor for the front cup');
      mask = m;
    } else {
      const m = new Uint8Array(N); let any = false;
      for (const b of L.brew) { const g = goalMask(blocked, b.x, b.y, 0.5, 0.8); if (g) { for (let k = 0; k < N; k++) if (g[k]) m[k] = 1; any = true; } }
      if (!any) return fail('no reachable brew station');
      mask = m;
    }
    const pts = pathTo(blocked, st.x, st.y, mask, extra);
    if (!pts) return fail('no path from (' + st.x.toFixed(1) + ',' + st.y.toFixed(1) + ') ' + (st.cups.length ? 'to a visitor wanting drink ' + st.cups[0] : 'to a station') + ', cups ' + st.cups.length + ', served ' + st.served.filter(Boolean).length + '/' + st.served.length);
    let res = 'arrived';
    for (const [x, y] of pull(L, pts, st.x, st.y, zones)) { res = drive(st, x, y); if (res !== 'arrived') break; }
    if (st.over) break;
    if (res === 'hard' || res === 'timeout') return fail('bumped or stuck (' + res + ')');
    if (!st.cups.length) { for (let w = 0; w < 420 && !st.over && !st.cups.length; w++) step(st, null); }   // waiting for the brew station to pour
  }
  const ok = st.won && st.spills === 0 && st.snatched === 0;   // sighs are allowed (they only cost a short stop), spills and snatches are not
  return { ok, why: ok ? '' : (st.won ? 'won but not cleanly' : 'did not finish'), ticks: st.t, sighs: st.wrong };
}

// ---- the random layout ----
export let lastFail = '';   // why the last build() gave up (for tests)
export function build(n, rnd, prevTheme, degrade) {
  const P = levelParams(n), ru = (a, b) => a + rnd() * (b - a), pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let theme; do { theme = pick(THEMES); } while (theme === prevTheme);
  const kind = OBSTACLE[theme], start = { x: 4.5, y: 9.8 };
  const L = { name: 'Level ' + n, theme, w: 9, h: 13, seconds: 20, start, cups: [], hurdles: [], brew: [], visitors: [], puddles: [], shutters: [], cart: null, thief: null };
  const free = (x, y, list, minD) => list.every((o) => d2(x, y, o.x, o.y) >= minD * minD);
  const place = (xr, yr, tries, okFn) => { for (let k = 0; k < tries; k++) { const x = ru(xr[0], xr[1]), y = ru(yr[0], yr[1]); if (okFn(x, y)) return { x, y }; } return null; };

  // a river of hurdles across the floor with one gap (a shutter gate in it from level 6)
  let wall = null;
  if (!degrade && rnd() < P.wallChance) {
    const yw = ru(5.8, 7.4), xg = ru(2.8, 6.2);
    for (let k = 1; k < 10; k++) for (const sg of [-1, 1]) { const x = xg + sg * k * 1.05; if (x >= 0.35 && x <= 8.65) L.hurdles.push({ kind, x, y: yw }); }
    const xs = L.hurdles.map((h) => h.x);
    if (Math.min(...xs) > 0.95) L.hurdles.push({ kind, x: 0.35, y: yw });   // plug the ends so no slit is left along the side walls
    if (Math.max(...xs) < 8.05) L.hurdles.push({ kind, x: 8.65, y: yw });
    wall = { yw, xg };
    if (rnd() < P.gate) { const on = 38 + Math.min(40, 2 * n), off = 68 - Math.min(25, n); L.shutters.push({ x: xg, y: yw, on, off, phase: Math.floor(rnd() * (on + off)) }); }
  }
  const wallN = L.hurdles.length;

  // brew stations first (they need room): more visitors need more refills; on a river level they sit on the start side
  for (let i = 0; i < Math.min(3, 1 + Math.floor(P.visitors / 4)); i++) {
    const p = place([1.0, 8.0], [wall ? wall.yw + 1.4 : 7.0, 11.9], 300, (x, y) => free(x, y, L.hurdles, 1.3) && free(x, y, L.brew, 2.6) && d2(x, y, start.x, start.y) >= 1.3 * 1.3);
    if (!p) { lastFail = 'station placement'; return null; } L.brew.push(p);
  }

  // the rolling cart goes in first (it needs a long clear lane); everything else keeps away from it
  const cartPts = [];
  if (P.cart && !degrade && (!wall || rnd() < 0.35)) {
    const len = ru(2.4, 3.2);
    for (let k = 0; k < 500 && !L.cart; k++) {
      const y = ru(3.0, 10.5), x0 = ru(0.9, 8.1 - len), path = [[x0, y], [x0 + len, y]];
      const samples = []; for (let q = 0; q <= 8; q++) samples.push({ x: x0 + (len * q) / 8, y });
      if (samples.every((q) => free(q.x, q.y, L.hurdles, 1.15) && free(q.x, q.y, L.brew, 1.3) && d2(q.x, q.y, start.x, start.y) >= 1.8 * 1.8 && (!wall || Math.abs(q.y - wall.yw) >= 1.6))) { L.cart = { path }; cartPts.push(...samples); }
    }
  }
  const offCart = (x, y, d) => free(x, y, cartPts, d);

  // visitors: all five faces get a turn; half of them are beyond the river when there is one
  const faces = shuffle([...WHO, ...WHO]); let fi = 0;
  const wants = shuffle([0, 1, 2, 0, 1, 2, 0, 1, 2]);
  const vd = P.visitors > 6 ? 1.9 : 2.1, band = wall ? wall.yw - 1.5 - 2.0 : 0, aboveCap = band < 0.8 ? 0 : Math.floor(band / 1.75 + 1) * 3;   // how many fit beyond the river
  for (let i = 0; i < P.visitors; i++) {
    const above = wall && i < Math.min(Math.ceil(P.visitors / 2), aboveCap);
    const p = place([1.1, 7.9], above ? [2.0, wall.yw - 1.5] : [2.0, 11.2], 800, (x, y) => free(x, y, L.visitors, vd) && d2(x, y, start.x, start.y) >= 2.4 * 2.4 && (!wall || Math.abs(y - wall.yw) >= 1.5) && free(x, y, L.hurdles, 1.35) && free(x, y, L.brew, 1.4) && offCart(x, y, 1.6));
    if (!p) { lastFail = 'visitor placement' + (above ? ' (beyond river)' : ''); return null; }
    L.visitors.push({ who: faces[fi++ % faces.length], x: p.x, y: p.y, want: wants[i] });
  }
  const three = shuffle(L.visitors.map((v, i) => i)).slice(0, 3); L.cups = three.map((i) => L.visitors[i].want);   // the first three cups are wanted by three different visitors

  // random hurdles
  const extra = P.hurdles + (degrade ? -2 : 0);
  for (let i = 0; i < extra; i++) {
    const p = place([1.0, 8.0], [1.8, 11.8], 200, (x, y) => free(x, y, L.visitors, 1.35) && d2(x, y, start.x, start.y) >= 1.5 * 1.5 && free(x, y, L.hurdles.slice(wallN), 1.7) && free(x, y, L.brew, 1.3) && offCart(x, y, 1.2) && (!wall || d2(x, y, wall.xg, wall.yw) >= 1.6 * 1.6));
    if (p) L.hurdles.push({ kind, x: p.x, y: p.y });
  }
  // puddles (the rainy floor gets more)
  const np = degrade ? 0 : Math.min(7, P.puddles + (theme === 4 && n >= 2 ? 2 : 0));
  for (let i = 0; i < np; i++) {
    const p = place([1.0, 8.0], [2.0, 11.5], 120, (x, y) => free(x, y, L.hurdles, 1.1) && free(x, y, L.visitors, 1.5) && free(x, y, L.brew, 1.5) && free(x, y, L.puddles, 1.3) && d2(x, y, start.x, start.y) >= 1.6 * 1.6 && offCart(x, y, 1.0) && (!wall || Math.abs(y - wall.yw) >= 1.2));
    if (p) L.puddles.push(p);
  }
  // the night thief patrols somewhere near the top
  if (!degrade && rnd() < P.thief) {
    const len = ru(2.5, 4.2);
    for (let k = 0; k < 500 && !L.thief; k++) {
      const y = ru(1.4, 3.4), x0 = ru(1.2, 7.8 - len), path = [[x0, y], [x0 + len, y]];
      const samples = []; for (let s = 0; s <= 6; s++) samples.push({ x: x0 + (len * s) / 6, y });
      if (samples.every((q) => free(q.x, q.y, L.visitors, 1.3) && free(q.x, q.y, L.brew, 1.6) && d2(q.x, q.y, start.x, start.y) >= 2.6 * 2.6 && (!L.cart || Math.abs(q.y - L.cart.path[0][1]) >= 1.8) && (!wall || Math.abs(q.y - wall.yw) >= 1.5))) L.thief = { path };
    }
  }
  return L;
}

// Level n from a seed. Level 1 is always the plain floor. Returns { level, tries }: the level is proven winnable by the bot.
export function makeLevel(n, seed, prevTheme = -1) {
  if (n <= 1) return { level: LEVEL1, tries: 0 };
  const P = levelParams(n);
  for (let k = 0; k < 14; k++) {
    const L = build(n, rng(mix(seed, n, k)), prevTheme, k >= 8 ? 1 : 0);   // after 8 failed layouts: easier ones (no cart, thief, wall or puddles)
    if (!L) continue;
    const r = solve(L);
    if (r.ok) { L.par = r.ticks; L.seconds = Math.max(P.minSeconds, Math.ceil((r.ticks / TICKS_PER_SEC) * P.factor)); return { level: L, tries: k + 1 }; }
  }
  return { level: { ...LEVEL1, name: 'Level ' + n }, tries: 14 };   // never seen in testing; the plain floor is the safe fallback
}
