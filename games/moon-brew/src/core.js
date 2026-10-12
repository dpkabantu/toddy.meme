// TODDY: Moon Brew — game rules and level maker. No drawing code here.
// Runs in the browser and in Node (tests). Directions: 0 up, 1 right, 2 down, 3 left.

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const MAX_BUMPS = 3;

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x, y) => x + ',' + y;

// ---------- Tray shapes ----------
export function makeMask(shape, w, h) {
  const m = [];
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const r = Math.min(w, h) / 2;
  const star = starPoly();
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const nx = dx / r, ny = dy / r; // about -1..1
      let on = true;
      if (shape === 'circle') on = dx * dx + dy * dy <= r * r * 1.02;
      else if (shape === 'diamond') on = Math.abs(dx) + Math.abs(dy) <= r + 0.01;
      else if (shape === 'moon') {
        const inBig = dx * dx + dy * dy <= r * r * 1.02;
        const ox = dx - r * 0.75, oy = dy + r * 0.2;
        on = inBig && !(ox * ox + oy * oy <= (r * 0.72) * (r * 0.72));
      } else if (shape === 'cup') {
        const bodyW = w - 2;
        if (x < bodyW) on = !(y === h - 1 && (x === 0 || x === bodyW - 1));
        else {
          const hy0 = Math.floor(h * 0.25), hy1 = Math.ceil(h * 0.65);
          on = y >= hy0 && y <= hy1 && (x === w - 1 || y === hy0 || y === hy1);
        }
      } else if (shape === 'heart') {
        const X = nx * 1.15, Y = -ny * 1.15 + 0.25;
        const q = X * X + Y * Y - 1;
        on = q * q * q - X * X * Y * Y * Y <= 0.02;
      } else if (shape === 'star') {
        on = inPoly(nx * 0.86, ny * 0.86 + 0.08, star);
      } else if (shape === 'face') {
        const head = dx * dx + (dy - r * 0.18) ** 2 <= (r * 0.82) ** 2;
        const e1 = (dx + r * 0.62) ** 2 + (dy + r * 0.62) ** 2 <= (r * 0.36) ** 2;
        const e2 = (dx - r * 0.62) ** 2 + (dy + r * 0.62) ** 2 <= (r * 0.36) ** 2;
        on = head || e1 || e2;
      }
      row.push(on);
    }
    m.push(row);
  }
  return m;
}
function starPoly() {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? 0.55 : 1.12;
    p.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return p;
}
function inPoly(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  }
  return c;
}

// ---------- Paths ----------
// Follows a bean from (x,y) heading d. Milk swirls turn it 90° clockwise.
// Returns { block: {x,y} } if something is in the way, { loop: true } if it would circle forever,
// otherwise { cells: [{x,y,d}], exit: {x,y,d} } with every cell it passes and where it leaves the tray.
export function trace(w, h, swirls, occupied, x, y, d) {
  const cells = [];
  const seen = new Set();
  let cx = x + DX[d], cy = y + DY[d];
  while (cx >= 0 && cy >= 0 && cx < w && cy < h) {
    if (occupied(cx, cy)) return { block: { x: cx, y: cy } };
    if (swirls.has(key(cx, cy))) {
      d = (d + 1) % 4;
      const s = cx + ',' + cy + ',' + d;
      if (seen.has(s)) return { loop: true };
      seen.add(s);
    }
    cells.push({ x: cx, y: cy, d });
    cx += DX[d]; cy += DY[d];
  }
  return { cells, exit: { x: cx, y: cy, d } };
}

// ---------- Level maker ----------
// Builds the tray backwards: each new bean (or sugar pair) must have a clear way out past the
// beans already placed. Removing them in reverse order always works, so every tray is solvable.
export function generate(cfg) {
  // Make several candidate trays and keep the best one. "pick" sets how many candidates:
  // more candidates = a harder tray (fewer beans free at the start, more waves to clear).
  const tries = cfg.pick || 1;
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < tries; i++) {
    let lvl = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const cand = build(cfg, (cfg.seed * 7919 + i * 15485863 + attempt * 104729) >>> 0);
      if (!lvl || cand.beans.length > lvl.beans.length) lvl = cand;
      if (cand.beans.length >= cand.target) break;
    }
    const m = measure(lvl);
    const full = lvl.beans.length >= Math.round(lvl.target * 0.85) ? 0 : -100;
    const score = full - 100 * m.free0 / lvl.beans.length + m.layers;
    if (score > bestScore) { bestScore = score; best = lvl; }
  }
  return best;
}

function build(cfg, seed) {
  const R = rng(seed);
  const { w, h } = cfg;
  const mask = makeMask(cfg.shape, w, h);
  const all = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y][x]) all.push([x, y]);
  shuffle(all, R);

  // milk swirls: inside the tray, never next to each other
  const swirls = new Set();
  for (const [x, y] of all) {
    if (swirls.size >= (cfg.swirls || 0)) break;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) continue;
    let near = false;
    for (let d = 0; d < 4; d++) if (swirls.has(key(x + DX[d], y + DY[d]))) near = true;
    if (!near && !swirls.has(key(x, y))) swirls.add(key(x, y));
  }

  const free = new Set(all.filter(([x, y]) => !swirls.has(key(x, y))).map(([x, y]) => key(x, y)));
  const target = Math.max(2, Math.round(free.size * (cfg.fill || 0.6)));
  const occ = new Set();
  const isOcc = (x, y) => occ.has(key(x, y));
  const cover = new Map(); // how many placed beans would roll through each cell
  const units = []; // placement order
  let pairsLeft = cfg.pairs || 0;
  let count = 0;
  const travel = (x, y, d) => (d === 0 ? y : d === 2 ? h - 1 - y : d === 3 ? x : w - 1 - x);

  while (count < target && free.size) {
    // pick a cell: with "tight" chance, one that sits on the most existing exit paths (more blocking)
    const list = [...free];
    let pick;
    if (R() < (cfg.tight || 0)) {
      let bestScore = -1, bests = [];
      for (const k of list) {
        const s = cover.get(k) || 0;
        if (s > bestScore) { bestScore = s; bests = [k]; } else if (s === bestScore) bests.push(k);
      }
      pick = bests[Math.floor(R() * bests.length)];
    } else pick = list[Math.floor(R() * list.length)];
    free.delete(pick);
    const [x, y] = pick.split(',').map(Number);

    const dirs = [];
    for (let d = 0; d < 4; d++) {
      const t = trace(w, h, swirls, isOcc, x, y, d);
      if (t.cells) dirs.push({ d, t });
    }
    if (!dirs.length) continue; // blocked every way, and can only get worse
    // Random draws happen first, in a fixed order, so every browser makes the same tray
    // (a random number inside a sort comparator depends on the browser's sort algorithm).
    for (const o of dirs) o.k = travel(x, y, o.d) + (R() - 0.5) * 5;
    dirs.sort((a, b) => b.k - a.k || a.d - b.d);

    let placed = null;
    const wantPair = pairsLeft > 0 && count + 2 <= target && R() < 0.5;
    if (wantPair) {
      for (const { d, t } of dirs) {
        for (const p of [(d + 1) % 4, (d + 3) % 4]) {
          const x2 = x + DX[p], y2 = y + DY[p];
          if (!free.has(key(x2, y2))) continue;
          const t2 = trace(w, h, swirls, isOcc, x2, y2, d);
          if (!t2.cells) continue;
          placed = [{ x, y, dir: d, cells: t.cells }, { x: x2, y: y2, dir: d, cells: t2.cells }];
          free.delete(key(x2, y2));
          pairsLeft--;
          break;
        }
        if (placed) break;
      }
    }
    if (!placed) placed = [{ x, y, dir: dirs[0].d, cells: dirs[0].t.cells }];
    for (const b of placed) {
      occ.add(key(b.x, b.y));
      for (const c of b.cells) cover.set(key(c.x, c.y), (cover.get(key(c.x, c.y)) || 0) + 1);
    }
    units.push(placed);
    count += placed.length;
  }

  // Solution = reverse of placement. Number beans in solution order.
  const order = units.slice().reverse();
  const beans = [];
  const solution = [];
  for (const u of order) {
    const roast = Math.floor(R() * 3);
    const ids = [];
    for (const b of u) {
      const id = beans.length;
      beans.push({ id, x: b.x, y: b.y, dir: b.dir, roast, sleepy: false, ice: 0, pair: -1 });
      ids.push(id);
    }
    if (ids.length === 2) { beans[ids[0]].pair = ids[1]; beans[ids[1]].pair = ids[0]; }
    solution.push(ids);
  }
  // ice: a bean that is only reached after at least `iceAt` beans have been ground
  const iceAt = cfg.iceAt || 3;
  const singles = beans.filter(b => b.pair < 0);
  pickSome(singles.filter(b => b.id >= iceAt), cfg.ice || 0, R).forEach(b => { b.ice = iceAt; });
  // sleepy beans are always medium roast (that is how the sleepy bean art is painted)
  pickSome(singles.filter(b => !b.ice), cfg.sleepy || 0, R).forEach(b => { b.sleepy = true; b.roast = 1; });
  const ticketLen = Math.min(cfg.ticket || 0, beans.length);
  const ticket = beans.slice(0, ticketLen).map(b => b.roast);

  return {
    w, h, shape: cfg.shape, mask, swirls: [...swirls], beans, ticket, solution, target, seed: cfg.seed,
  };
}
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pickSome(arr, n, R) { return shuffle(arr.slice(), R).slice(0, n); }

// A frozen tray (from src/trays.js) back to a full level object.
export function fromFrozen(f) {
  return {
    w: f.w, h: f.h, shape: f.shape, mask: makeMask(f.shape, f.w, f.h), swirls: f.swirls, ticket: f.ticket, solution: f.solution,
    beans: f.beans.map(([x, y, dir, roast, sleepy, ice, pair], id) => ({ id, x, y, dir, roast, sleepy: !!sleepy, ice, pair })),
  };
}

// ---------- Playing ----------
export function newGame(level) {
  return {
    level,
    swirls: new Set(level.swirls),
    beans: level.beans.map(b => ({ ...b, awake: !b.sleepy, gone: false })),
    bumps: 0, rolled: 0, removedRoasts: [], perfect: true, status: 'playing', log: [],
  };
}
export function beanAt(g, x, y) { return g.beans.find(b => !b.gone && b.x === x && b.y === y) || null; }
export function frozen(g, b) { return b.ice > 0 && g.rolled < b.ice; }
export function unitOf(g, b) { return b.pair >= 0 ? [b, g.beans[b.pair]] : [b]; }
export function traceBean(g, b, ignore) {
  const skip = new Set(ignore.map(o => key(o.x, o.y)));
  const occ = (x, y) => !skip.has(key(x, y)) && !!beanAt(g, x, y);
  return trace(g.level.w, g.level.h, g.swirls, occ, b.x, b.y, b.dir);
}
export function canRoll(g, b) {
  if (b.gone || !b.awake || frozen(g, b)) return false;
  const u = unitOf(g, b);
  return u.every(x => traceBean(g, x, u).cells);
}

// Tap a bean. Returns what happened: none | wake | frozen | bump | roll.
export function tap(g, b, t = 0) {
  if (g.status !== 'playing' || !b || b.gone) return { type: 'none' };
  const ev = doTap(g, b);
  g.log.push([b.id, ev.type[0], Math.round(t)]);
  return ev;
}
function doTap(g, b) {
  if (!b.awake) { b.awake = true; return { type: 'wake', bean: b }; }
  if (frozen(g, b)) return { type: 'frozen', bean: b };
  const unit = unitOf(g, b);
  const traces = unit.map(x => traceBean(g, x, unit));
  const bad = traces.findIndex(t => !t.cells);
  if (bad >= 0) {
    g.bumps++;
    if (g.bumps >= MAX_BUMPS) g.status = 'burnt';
    return { type: 'bump', bean: unit[bad], unit, block: traces[bad].block || null, loop: !!traces[bad].loop };
  }
  for (const x of unit) {
    x.gone = true;
    g.rolled++;
    const i = g.removedRoasts.length;
    g.removedRoasts.push(x.roast);
    if (i < g.level.ticket.length && g.level.ticket[i] !== x.roast) g.perfect = false;
  }
  if (g.beans.every(x => x.gone)) g.status = 'won';
  return { type: 'roll', unit, traces };
}
export function stars(g) {
  if (g.status !== 'won') return 0;
  return 1 + (g.bumps === 0 ? 1 : 0) + (g.perfect ? 1 : 0);
}

// Asking for a hint is written into the move log (the Daily score counts it).
export function useHint(g, t = 0) {
  if (g.status !== 'playing') return null;
  g.log.push([-1, 'h', Math.round(t)]);
  return hint(g);
}

// A bean that can roll now; prefers the next step of the built-in solution, then the ticket's roast.
export function hint(g) {
  const next = g.level.solution.map(ids => g.beans[ids[0]]).find(b => !b.gone);
  if (next && (canRoll(g, next) || !next.awake) && !frozen(g, next)) return next;
  const need = g.perfect && g.removedRoasts.length < g.level.ticket.length ? g.level.ticket[g.removedRoasts.length] : null;
  const ok = g.beans.filter(b => !b.gone && (b.awake ? canRoll(g, b) : true) && !frozen(g, b));
  return ok.find(b => need === null || b.roast === need) || ok[0] || null;
}

// How hard a tray is: beans free at the start, and how many "waves" of clearing it takes.
export function measure(level) {
  const g = newGame(level);
  g.beans.forEach(b => { b.awake = true; b.ice = 0; });
  const free0 = g.beans.filter(b => canRoll(g, b)).length;
  let layers = 0;
  while (g.beans.some(b => !b.gone)) {
    const now = g.beans.filter(b => !b.gone && canRoll(g, b));
    if (!now.length) return { free0, layers: -1 };
    now.forEach(b => { b.gone = true; });
    layers++;
  }
  return { free0, layers, beans: level.beans.length };
}

// ---------- Daily Brew score (out of 1000) ----------
// Worked out only from the game's own move log, so a server can replay a run and check it later.
export function dailyScore(g) {
  const ms = g.log.length ? g.log[g.log.length - 1][2] : 0;
  const secs = Math.max(0, ms / 1000);
  if (g.status !== 'won') return { clear: 0, clean: 0, perfect: 0, speed: 0, hints: 0, hintCost: 0, total: 0, secs: Math.round(secs) };
  const clear = 400;
  const clean = g.bumps === 0 ? 200 : 0;
  const perfect = g.perfect && g.level.ticket.length ? 200 : 0;
  const speed = Math.round(200 * Math.max(0, Math.min(1, (300 - secs) / 240))); // full under 1 min, none after 5 min
  const hints = g.log.filter(e => e[1] === 'h').length;
  const hintCost = Math.min(hints * 50, clear + clean + perfect + speed);
  return { clear, clean, perfect, speed, hints, hintCost, total: clear + clean + perfect + speed - hintCost, secs: Math.round(secs) };
}

// ---------- Daily streaks ----------
// days: Daily Brew numbers like 20261012 that were cleared. today: today's number.
const dayIndex = (n) => Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100) / 864e5;
export function streaks(days, today) {
  const set = new Set(days.map(dayIndex));
  const t = dayIndex(today);
  let current = 0;
  let d = set.has(t) ? t : t - 1;
  while (set.has(d)) { current++; d--; }
  let best = 0;
  for (const x of set) {
    if (set.has(x - 1)) continue;
    let run = 0; while (set.has(x + run)) run++;
    best = Math.max(best, run);
  }
  return { current, best };
}
