// TODDY Free Walk rules. PURE and DETERMINISTIC: only + - * / and sqrt (exact in IEEE maths), no Math.random, no Date, no sin/cos.
// Same game as TODDY Trail, but Toddy is not locked to a grid: he walks in ANY direction, in a straight line, toward the point you touched.
// The bump rules are Trail's: a hurdle (or the rolling cart) stops him and costs the last cup (or just "bump!" with no cups); a visitor gets a cup
// if it is the right one, otherwise a sigh, and Toddy stops softly (nothing lost); after a hard bump he waits for a fresh touch.
// Hazards, as in Trail: puddles (slide one extra step), a rolling cart (a moving wall that waits if Toddy is in its way), shutter gates
// (closed for a while: Toddy waits, nothing lost) and a night thief who patrols a path and snatches the last cup if Toddy comes close.
// A level is a plain object (see LEVEL1 and free-gen.js). Distances are in floor cells (the floor is 9 wide, 13 tall, like Trail).
// One tick is a fixed slice of walking, so scores do not depend on the speed setting.

export const TICKS_PER_SEC = 30;        // at "Normal" speed (4 cells a second); the page runs ticks faster or slower for Quick / Relaxed
export const V = 4 / TICKS_PER_SEC;     // cells Toddy walks in one tick
export const MAX_LINE = 6;              // most cups Toddy can carry
export const CUP_GAP = 0.75;            // distance between cups in the line behind him
export const BREW_COOLDOWN = 300;       // ticks before a brew station hands out another cup (10 s at Normal, same as Trail)
export const THIEF_COOLDOWN = 110;      // ticks before the thief can snatch again (Trail: 15 steps)
export const R_TODDY = 0.28;            // Toddy's footprint radius
export const R_SOLID = 0.45;            // footprint radius of every hurdle and every visitor body
export const R_CART = 0.6;              // the rolling cart is wider
export const R_GATE = 0.9;              // a closed shutter gate seals a gap about two cells wide
export const R_PUDDLE = 0.45;
export const REACH = 0.95;              // Toddy hands a cup over when he gets this close to a visitor (centre to centre)
export const BREW_REACH = 0.6;
export const SNATCH_R = 1.0;            // the thief snatches when he is this close
export const SLIDE_TICKS = 7;           // a puddle slide: 7 ticks, about one cell
export const CART_SPEED = 0.05;         // cells per tick
export const THIEF_SPEED = 0.045;
export const FOOT = 0.22;               // the page draws feet this far below the footprint centre (drawing only)
export const DRINKS = ['moon', 'star', 'crescent'];

// Level 1: the plain floor. Three visitors, four hurdles standing on the straight lines between them, one brew station.
// Visitor positions and wanted drinks are Trail Night 1's (milo: moon, pip: star, velvet: crescent), so the three cups wait in that order.
export const LEVEL1 = {
  name: 'Plain floor', theme: 0, w: 9, h: 13, seconds: 20,   // Trail Night 1 gives 45 s, but its grid paths are about three times longer than these straight lines
  start: { x: 4.5, y: 9.8 },
  cups: [0, 1, 2],
  hurdles: [
    { kind: 'barrel', x: 6.0, y: 9.8 },    // between Toddy and Milo
    { kind: 'crates', x: 3.0, y: 8.3 },    // between Toddy and Pip
    { kind: 'table', x: 4.5, y: 5.3 },     // between Pip and Velvet
    { kind: 'barrel', x: 6.2, y: 4.3 },    // right in front of Velvet
  ],
  brew: [{ x: 1.5, y: 11.4 }],
  visitors: [
    { who: 'milo', x: 7.6, y: 9.8, want: 0 },
    { who: 'pip', x: 1.4, y: 6.8, want: 1 },
    { who: 'velvet', x: 7.6, y: 3.8, want: 2 },
  ],
  puddles: [], shutters: [], cart: null, thief: null,
};
// Where Toddy's footprint centre may go (the page clamps a touch to this, so Toddy never has to hit a wall).
export const BOUNDS = { x0: 0.4, x1: 9 - 0.4, y0: 0.9, y1: 13 - 0.55 };
export const clampPoint = (x, y) => ({ x: x < BOUNDS.x0 ? BOUNDS.x0 : x > BOUNDS.x1 ? BOUNDS.x1 : x, y: y < BOUNDS.y0 ? BOUNDS.y0 : y > BOUNDS.y1 ? BOUNDS.y1 : y });

const TRAIL_LEN = (MAX_LINE + 1) * CUP_GAP + 0.5;   // how much of Toddy's path is remembered (the cups ride along it)
const dist = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };

// ---- paths for the cart and the thief: a polyline walked to and fro ----
export function pathLength(path) { let s = 0; for (let i = 1; i < path.length; i++) s += dist(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]); return s; }
export function pathPoint(path, d) {
  let left = d;
  for (let i = 1; i < path.length; i++) {
    const ax = path[i - 1][0], ay = path[i - 1][1], bx = path[i][0], by = path[i][1], sl = dist(ax, ay, bx, by);
    if (left <= sl) { const f = sl === 0 ? 0 : left / sl; return [ax + (bx - ax) * f, ay + (by - ay) * f]; }
    left -= sl;
  }
  const l = path[path.length - 1]; return [l[0], l[1]];
}
export const cartPos = (st) => (st.level.cart ? pathPoint(st.level.cart.path, st.cartD) : null);
export const thiefPos = (st) => (st.level.thief ? pathPoint(st.level.thief.path, st.thiefD) : null);
export const gateClosed = (level, t, i) => { const s = level.shutters[i]; return ((t + s.phase) % (s.on + s.off)) < s.on; };

export function newState(level = LEVEL1) {
  const trail = [];
  for (let i = 1; i <= 60; i++) trail.push({ x: level.start.x, y: level.start.y + i * 0.1 });   // at the start the cups wait in a line behind (below) him
  return {
    level, t: 0, limit: level.seconds * TICKS_PER_SEC, x: level.start.x, y: level.start.y, hx: 0, hy: -1,   // hx, hy: the way he faces (a unit vector)
    tx: null, ty: null,          // the point he is walking to (null: standing)
    stop: null, locked: false,   // stop: null | 'soft' | 'hard'; locked: after a hard bump he ignores a drag until a fresh touch
    cups: level.cups.slice(), trail, served: level.visitors.map(() => false), near: level.visitors.map(() => false), brewCool: level.brew.map(() => 0),
    slide: 0, inPuddle: false, cartD: 0, cartDir: 1, cartLen: level.cart ? pathLength(level.cart.path) : 0,
    thiefD: 0, thiefDir: 1, thiefLen: level.thief ? pathLength(level.thief.path) : 0, thiefCool: 0,
    wrong: 0, spills: 0, snatched: 0, bumps: 0, over: false, won: false, events: [],
  };
}

// First moment (0..1) along a move of (mx, my) from (px, py) at which a circle of radius R around (cx, cy) is touched; null if never.
function contactT(px, py, mx, my, cx, cy, R) {
  const ex = px - cx, ey = py - cy, a = mx * mx + my * my, b = 2 * (mx * ex + my * ey), c = ex * ex + ey * ey - R * R;
  if (a === 0) return null;
  if (c <= 0) return b < 0 ? 0 : null;   // already touching: only moving closer counts, so he can always walk away
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function pushTrail(st, x, y) {
  st.trail.unshift({ x, y });
  let acc = 0;
  for (let i = 1; i < st.trail.length; i++) { acc += dist(st.trail[i - 1].x, st.trail[i - 1].y, st.trail[i].x, st.trail[i].y); if (acc > TRAIL_LEN) { st.trail.length = i + 1; break; } }
}
// The point `d` cells back along Toddy's path (where a cup in the line rides). Drawing only.
export function linePoint(st, d) {
  let px = st.x, py = st.y, left = d;
  for (const p of st.trail) {
    const sx = p.x - px, sy = p.y - py, sl = Math.sqrt(sx * sx + sy * sy);
    if (sl >= left) { const f = sl === 0 ? 0 : left / sl; return { x: px + sx * f, y: py + sy * f }; }
    left -= sl; px = p.x; py = p.y;
  }
  return { x: px, y: py };
}
// Index 0 is Toddy; index k (k >= 1) is where cups[k] rides. cups[0] is the one in his paws.
export function linePoints(st) { const out = [{ x: st.x, y: st.y }]; for (let k = 1; k < st.cups.length; k++) out.push(linePoint(st, k * CUP_GAP)); return out; }

function interact(st, i) {   // hand a cup to visitor i (or sigh), exactly like walking into a visitor in Trail
  const v = st.level.visitors[i];
  if (st.served[i]) return;
  if (st.cups.length > 0 && st.cups[0] === v.want) { st.cups.shift(); st.served[i] = true; st.events.push({ type: 'serve', visitor: i }); }
  else { st.wrong++; st.events.push({ type: 'sigh', visitor: i }); }
}
const softStop = (st) => { st.tx = null; st.ty = null; st.stop = 'soft'; st.slide = 0; };
function hardStop(st) {
  st.tx = null; st.ty = null; st.stop = 'hard'; st.locked = true; st.slide = 0; st.bumps++;
  if (st.cups.length > 0) { const lost = st.cups.pop(); st.spills++; st.events.push({ type: 'spill', drink: lost }); } else st.events.push({ type: 'bump' });
}

// The brew station gives a drink some waiting visitor still needs and Toddy is not already carrying enough of (lowest drink first); otherwise nothing.
function brewDrink(st) {
  for (let d = 0; d < DRINKS.length; d++) {
    const need = st.level.visitors.filter((v, i) => !st.served[i] && v.want === d).length, have = st.cups.filter((c) => c === d).length;
    if (have < need) return d;
  }
  return -1;
}

// What a move of (mx, my) would touch first: a hurdle, a visitor, the cart or a closed gate (t: 0..1 along the move; kind null if nothing).
function firstContact(st, mx, my) {
  const L = st.level; let tmin = 1, kind = null, idx = -1;
  const test = (cx, cy, R, k, i) => { const t = contactT(st.x, st.y, mx, my, cx, cy, R); if (t !== null && t < tmin) { tmin = t; kind = k; idx = i; } };
  L.hurdles.forEach((h, i) => test(h.x, h.y, R_TODDY + R_SOLID, 'hurdle', i));
  L.visitors.forEach((v, i) => test(v.x, v.y, R_TODDY + R_SOLID, 'visitor', i));
  const c = cartPos(st); if (c) test(c[0], c[1], R_TODDY + R_CART, 'cart', 0);
  L.shutters.forEach((s, i) => { if (gateClosed(L, st.t, i)) test(s.x, s.y, R_TODDY + R_GATE, 'gate', i); });
  return { t: tmin, kind, idx };
}

// After Toddy has moved: coming within reach of a waiting visitor hands a cup over (once per approach), and puddles start a slide.
function afterMove(st, stopped) {
  const L = st.level;
  L.visitors.forEach((v, i) => {
    const near = dist(st.x, st.y, v.x, v.y) <= REACH;
    if (near && !st.near[i] && !st.served[i] && !stopped) { interact(st, i); softStop(st); stopped = true; }
    st.near[i] = near;
  });
  if (stopped) return;
  const inP = L.puddles.some((p) => dist(st.x, st.y, p.x, p.y) <= R_PUDDLE);
  if (inP && !st.inPuddle) {   // rain: slide one extra step if the way is clear
    st.inPuddle = true;
    const len = V * SLIDE_TICKS;
    if (firstContact(st, st.hx * len, st.hy * len).kind === null) { st.slide = SLIDE_TICKS; st.events.push({ type: 'slide' }); }
  } else if (!inP) st.inPuddle = false;
}

function slideStep(st) {
  const mx = st.hx * V, my = st.hy * V, hit = firstContact(st, mx, my), sx = mx * hit.t, sy = my * hit.t;
  if (sx !== 0 || sy !== 0) { pushTrail(st, st.x, st.y); st.x += sx; st.y += sy; }
  st.slide--;
  if (hit.kind !== null) st.slide = 0;   // something in the way: the slide just ends, nothing is lost
  afterMove(st, false);
}

function moveToddy(st) {
  const dx = st.tx - st.x, dy = st.ty - st.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.02) { st.tx = null; st.ty = null; return; }
  const ux = dx / d, uy = dy / d, len = d < V ? d : V, mx = ux * len, my = uy * len;
  st.hx = ux; st.hy = uy;
  const hit = firstContact(st, mx, my), sx = mx * hit.t, sy = my * hit.t;
  if (sx !== 0 || sy !== 0) { pushTrail(st, st.x, st.y); st.x += sx; st.y += sy; }
  let stopped = false;
  if (hit.kind === 'hurdle' || hit.kind === 'cart') { hardStop(st); stopped = true; }
  else if (hit.kind === 'visitor') { interact(st, hit.idx); softStop(st); stopped = true; }
  else if (hit.kind === 'gate') { /* a closed gate: Toddy waits at it and keeps his target; nothing is lost */ }
  else if (len === d) { st.tx = null; st.ty = null; }   // arrived
  afterMove(st, stopped);
}

// The cart rolls to and fro (it waits if Toddy is in its way); the thief walks his path.
function moveHazards(st) {
  const L = st.level;
  if (L.cart) {
    let nd = st.cartD + st.cartDir * CART_SPEED, dir = st.cartDir;
    if (nd > st.cartLen) { nd = st.cartLen - (nd - st.cartLen); dir = -1; } else if (nd < 0) { nd = -nd; dir = 1; }
    const p = pathPoint(L.cart.path, nd);
    if (dist(p[0], p[1], st.x, st.y) > R_TODDY + R_CART + 0.02) { st.cartD = nd; st.cartDir = dir; }
  }
  if (L.thief) {
    let nd = st.thiefD + st.thiefDir * THIEF_SPEED;
    if (nd > st.thiefLen) { nd = st.thiefLen - (nd - st.thiefLen); st.thiefDir = -1; } else if (nd < 0) { nd = -nd; st.thiefDir = 1; }
    st.thiefD = nd;
  }
  if (st.thiefCool > 0) st.thiefCool--;
}

// One tick. cmd: null (nothing new) or { x, y, fresh }: the touched point (in floor cells, already clamped) and whether the finger has just gone down.
export function step(st, cmd) {
  if (st.over) return;
  const L = st.level;
  st.events = [];
  if (cmd) {
    if (cmd.fresh) st.locked = false;
    if (!st.locked) { st.tx = cmd.x; st.ty = cmd.y; st.stop = null; }
  }
  moveHazards(st);
  for (let i = 0; i < st.brewCool.length; i++) if (st.brewCool[i] > 0) st.brewCool[i]--;
  if (st.slide > 0) slideStep(st); else if (st.tx !== null) moveToddy(st);
  const tp = thiefPos(st);   // the thief snatches the last cup if Toddy is close
  if (tp && st.thiefCool === 0 && st.cups.length > 0 && dist(tp[0], tp[1], st.x, st.y) <= SNATCH_R) {
    const lost = st.cups.pop(); st.snatched++; st.thiefCool = THIEF_COOLDOWN; st.events.push({ type: 'snatch', drink: lost });
  }
  L.brew.forEach((b, i) => {
    if (st.brewCool[i] === 0 && st.cups.length < MAX_LINE && dist(st.x, st.y, b.x, b.y) <= BREW_REACH) {
      const d = brewDrink(st);
      if (d >= 0) { st.cups.push(d); st.brewCool[i] = BREW_COOLDOWN; st.events.push({ type: 'brew', drink: d, station: i }); }
    }
  });
  st.t++;
  if (st.served.every(Boolean)) { st.over = true; st.won = true; }
  else if (st.t >= st.limit) st.over = true;
}

// Score out of 1,000, same as Trail: visitors served 600 + cups kept 200 (minus 40 per spilled or snatched cup) + speed 200 (only if everyone is served).
export function score(st) {
  const count = st.served.filter(Boolean).length, of = st.level.visitors.length;
  const serve = Math.floor((600 * count) / of), kept = Math.max(0, 200 - 40 * (st.spills + st.snatched));
  const speed = st.won ? Math.floor((200 * (st.limit - st.t)) / st.limit) : 0;
  return { score: serve + kept + speed, served: count, of, serve, kept, speed, seconds: Math.floor(st.t / TICKS_PER_SEC) };
}

// Replay a log of commands [[tick, cmd], ...] (ticks rising) on a level. Same idea as Trail's replay; nothing uses it yet.
export function replay(level, cmds, maxTicks) {
  const st = newState(level);
  let i = 0;
  const cap = Math.min(maxTicks === undefined ? st.limit : maxTicks, st.limit);
  while (!st.over && st.t < cap) {
    let cmd = null;
    while (i < cmds.length && cmds[i][0] === st.t) { cmd = cmds[i][1]; i++; }
    if (i < cmds.length && cmds[i][0] < st.t) return { st, bad: true };
    step(st, cmd);
  }
  return { st, bad: false };
}
