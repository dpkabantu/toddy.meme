// Moon Merge rules. PURE and DETERMINISTIC: no Math.random, no Date, no trig,
// only + - * / sqrt and integer ops, so every JS engine (phone, Worker) gets the same result.
// Units are "art units" = pixels of the crate image (1086 x 1448).

export const TICKS_PER_SEC = 60;
export const FIELD = { L: 145, R: 940, FLOOR: 1200, TOP: 7 };
export const CLOSE_Y = 220;          // closing line
export const SPAWN_Y = 62;           // where Toddy lets go (the empty headroom above the closing line)
export const RADII = [34, 44, 54, 64, 76, 90, 105, 122, 142, 162, 186];
export const MAX_LEVEL = RADII.length;
export const DROP_COOLDOWN = 24;     // ticks between drops (0.4 s)
export const WEIGHTS = [28, 26, 22, 15, 9];   // chance of levels 1..5 from Toddy
export const LATE_LEVEL = 10;
export const LATE_DROP = 6;
export const LATE_CHANCE = 0.2;   // once a violet moon exists, 1 in 5 drops is a milk swirl

// Visitor tickets: now and then a visitor asks for a piece. Making it before the deadline pays a bonus.
export const TICKET_FIRST = 5;
export const TICKET_SPAN = 14;
export const TICKET_GAP = 4;
export const TICKET_MULT = 6;
const GRAVITY = 0.55, DAMP = 0.9985, ITER = 8, MAX_V = 36;
const STIFF = 0.85, FRICTION = 0.25, CONTACT_DAMP = 0.985, FLOOR_DAMP = 0.9;
const GRACE = 60, OVER_TICKS = 120, CHAIN_WINDOW = 45;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSequence(seed, n = 4000, weights = WEIGHTS) {
  const rng = mulberry32(seed);
  let total = 0; for (const w of weights) total += w;
  const seq = [];
  for (let i = 0; i < n; i++) {
    let r = rng() * total, lvl = 1;
    for (let k = 0; k < weights.length; k++) { if (r < weights[k]) { lvl = k + 1; break; } r -= weights[k]; lvl = k + 1; }
    seq.push(lvl);
  }
  return seq;
}

function ticketRolls(seed, n = 600) {
  const rng = mulberry32((seed ^ 0x2545f491) | 0);
  const a = [];
  for (let i = 0; i < n; i++) a.push(rng());
  return a;
}
function lateRolls(seed, n = 4000) {
  const rng = mulberry32((seed ^ 0x5bd1e995) | 0);
  const a = [];
  for (let i = 0; i < n; i++) a.push(rng());
  return a;
}
const levelAt = (s, i) => (s.maxLevel >= s.tw.lateLevel && s.late[i] < s.tw.lateChance) ? LATE_DROP : s.seq[i];

export function newGame(seed, twist = 0) {
  const custom = !!twist && typeof twist === 'object';   // a Season level brings its own rules, goal included
  const tw = custom ? twist : (TWISTS[twist] || TWISTS[0]);
  return {
    seed, twist: custom ? -1 : (TWISTS[twist] ? twist : 0), tw, tick: 0, bodies: [], nextId: 1, seq: makeSequence(seed, 4000, tw.weights), late: lateRolls(seed), tix: ticketRolls(seed), seqIndex: 0,
    ticket: null, nextTicketDrop: tw.ticketFirst, served: 0,
    score: 0, chain: 0, lastMergeTick: -1000, nextDropTick: 0,
    over: false, overTick: -1, events: [], drops: 0, maxLevel: 0, merges: 0,
  };
}

export const heldLevel = (s) => levelAt(s, s.seqIndex);
export const nextLevel = (s) => levelAt(s, s.seqIndex + 1);
export const canDrop = (s) => !s.over && s.tick >= s.nextDropTick && !(s.tw.dropCap && s.drops >= s.tw.dropCap);

export function clampX(level, x) {
  const r = RADII[level - 1];
  const lo = FIELD.L + r, hi = FIELD.R - r;
  return x < lo ? lo : x > hi ? hi : x;
}

export function drop(s, x) {
  if (!canDrop(s)) return false;
  const level = levelAt(s, s.seqIndex++);
  x = clampX(level, x);
  s.bodies.push({
    id: s.nextId++, level, r: RADII[level - 1], x, y: SPAWN_Y, px: x, py: SPAWN_Y,
    ox: x, born: s.tick, over: 0, contact: false, ang: 0,
  });
  s.nextDropTick = s.tick + DROP_COOLDOWN;
  s.drops++;
  s.events.push({ type: 'drop', x, level });
  if (s.ticket && s.drops > s.ticket.deadline) {
    s.events.push({ type: 'ticket_gone', level: s.ticket.level });
    s.ticket = null; s.nextTicketDrop = s.drops + s.tw.ticketGap;
  }
  if (!s.ticket && s.drops >= s.nextTicketDrop) {
    const cap = Math.min(8, Math.max(3, s.maxLevel + 1));
    const lvl = Math.min(cap, 3 + Math.floor(s.tix[s.drops % s.tix.length] * 4));
    s.ticket = { level: lvl, deadline: s.drops + s.tw.ticketSpan };
    s.events.push({ type: 'ticket', level: lvl, deadline: s.ticket.deadline });
  }
  return true;
}

function solve(B, last) {
  const n = B.length;
  const { L, R, FLOOR } = FIELD;
  for (let i = 0; i < n; i++) {
    const a = B[i];
    for (let j = i + 1; j < n; j++) {
      const c = B[j];
      const dx = c.x - a.x, dy = c.y - a.y, rr = a.r + c.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      let d = Math.sqrt(d2), nx, ny;
      if (d < 1e-6) { nx = 0; ny = 1; d = 0; } else { nx = dx / d; ny = dy / d; }
      const ov = (rr - d) * STIFF;
      const ma = a.r * a.r, mc = c.r * c.r, tot = ma + mc;
      const sa = mc / tot, sc = ma / tot;
      a.x -= nx * ov * sa; a.y -= ny * ov * sa;
      c.x += nx * ov * sc; c.y += ny * ov * sc;
      a.contact = true; c.contact = true;
      if (last) {   // friction between the two bodies, applied once per tick
        const tx = -ny, ty = nx;
        const vt = ((c.x - c.px) - (a.x - a.px)) * tx + ((c.y - c.py) - (a.y - a.py)) * ty;
        const f = vt * FRICTION;
        a.px -= tx * f * sa; a.py -= ty * f * sa;
        c.px += tx * f * sc; c.py += ty * f * sc;
      }
    }
  }
  for (let i = 0; i < n; i++) {     // walls last, so the crate is never broken
    const b = B[i], r = b.r;
    if (b.x < L + r) { b.x = L + r; b.contact = true; }
    else if (b.x > R - r) { b.x = R - r; b.contact = true; }
    if (b.y > FLOOR - r) { b.y = FLOOR - r; b.contact = true; b.floor = true; }
  }
}

export function step(s) {
  if (s.over) return;
  s.tick++;
  const B = s.bodies;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    let vx = (b.x - b.px) * DAMP, vy = (b.y - b.py) * DAMP;
    if (vy > MAX_V) vy = MAX_V; else if (vy < -MAX_V) vy = -MAX_V;
    if (vx > MAX_V) vx = MAX_V; else if (vx < -MAX_V) vx = -MAX_V;
    b.ox = b.x; b.px = b.x; b.py = b.y;
    b.x += vx; b.y += vy + GRAVITY;
    b.contact = false; b.floor = false;
  }
  for (let it = 0; it < ITER; it++) solve(B, it === ITER - 1);
  for (let i = 0; i < B.length; i++) {     // contact damping and visual rolling
    const b = B[i];
    if (b.contact) {
      let vx = (b.x - b.px) * CONTACT_DAMP, vy = (b.y - b.py) * CONTACT_DAMP;
      if (b.floor) vx *= FLOOR_DAMP;
      b.px = b.x - vx; b.py = b.y - vy;
      b.ang += ((b.x - b.ox) / b.r) * 0.9;
    }
  }
  mergePass(s);
  overCheck(s);
}

function mergePass(s) {
  const B = s.bodies, n = B.length;
  const used = new Array(n).fill(false);
  const born = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const a = B[i];
    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue;
      const c = B[j];
      if (c.level !== a.level) continue;
      const dx = c.x - a.x, dy = c.y - a.y, rr = a.r + c.r + 1;
      if (dx * dx + dy * dy > rr * rr) continue;
      used[i] = used[j] = true;
      const ma = a.r * a.r, mc = c.r * c.r, tot = ma + mc;
      const x = (a.x * ma + c.x * mc) / tot, y = (a.y * ma + c.y * mc) / tot;
      const vx = ((a.x - a.px) * ma + (c.x - c.px) * mc) / tot;
      const vy = ((a.y - a.py) * ma + (c.y - c.py) * mc) / tot;
      if (s.tick - s.lastMergeTick <= CHAIN_WINDOW) s.chain++; else s.chain = 0;
      s.lastMergeTick = s.tick; s.merges++;
      if (a.level === MAX_LEVEL) {
        const pts = (MAX_LEVEL + 1) * MAX_LEVEL / 2;     // 66: a Full Moon pair vanishes
        s.score += pts;
        s.events.push({ type: 'vanish', x, y, level: MAX_LEVEL, points: pts });
      } else {
        const lvl = a.level + 1, r = RADII[lvl - 1];
        const pts = lvl * (lvl - 1) / 2;
        const bonus = Math.floor(pts * (s.chain > 4 ? 4 : s.chain) / 4);
        s.score += pts + bonus;
        if (s.ticket && s.ticket.level === lvl) {
          const tb = lvl * s.tw.ticketMult;
          s.score += tb; s.served++;
          s.events.push({ type: 'served', level: lvl, points: tb });
          s.ticket = null; s.nextTicketDrop = s.drops + s.tw.ticketGap + 1;
        }
        if (lvl > s.maxLevel) s.maxLevel = lvl;
        let nx = clampX(lvl, x), ny = y > FIELD.FLOOR - r ? FIELD.FLOOR - r : y;
        born.push({
          id: s.nextId++, level: lvl, r, x: nx, y: ny, px: nx - vx, py: ny - vy,
          ox: nx, born: s.tick, over: 0, contact: false, ang: a.ang, merged: true,
        });
        s.events.push({ type: 'merge', x: nx, y: ny, level: lvl, points: pts + bonus, chain: s.chain });
      }
      break;
    }
  }
  if (born.length || used.some((u) => u)) {
    const keep = [];
    for (let i = 0; i < n; i++) if (!used[i]) keep.push(B[i]);
    for (const b of born) keep.push(b);
    s.bodies = keep;
  }
}

function overCheck(s) {
  for (const b of s.bodies) {
    if (s.tick - b.born > GRACE && b.y - b.r < s.tw.closeY) b.over++; else b.over = 0;
    if (b.over >= OVER_TICKS) {
      s.over = true; s.overTick = s.tick;
      s.events.push({ type: 'gameover' });
      return;
    }
  }
}

// ---- server side: replay a run from its seed and drop log -------------------
// drops = [[tick, x], ...] with integer x. Returns the final state, plus `bad`
// (true if a logged drop was not allowed, which a real player can never produce).
export function replay(seed, drops, endTick, twist = 0, stop = null) {
  const s = newGame(seed, twist);
  let di = 0, bad = false;
  while (s.tick < endTick && !s.over && !(stop && stop(s))) {
    while (di < drops.length && drops[di][0] === s.tick) {
      if (!drop(s, drops[di][1])) bad = true;
      di++;
    }
    step(s);
    s.events.length = 0;
  }
  if (di < drops.length) bad = true;
  return { state: s, bad };
}

export function stateHash(s) {
  const str = s.tick + '|' + s.score + '|' + s.bodies.map((b) => b.level + ':' + b.x + ':' + b.y).join(',');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16) + '/' + s.score;
}

export function bandsOf(twist) { return (TWISTS[twist] || TWISTS[0]).bands; }
export function bandFor(score, twist = 0) {   // placeholder thresholds, to be set from real player data
  const b = bandsOf(twist);
  return score >= b[2] ? 3 : score >= b[1] ? 2 : score >= b[0] ? 1 : 0;
}
export const BAND_NAMES = ['Played', 'Bronze', 'Silver', 'Gold'];

// ---- weekly twists: only numbers change, so the server replay checks them the same way ----
// bands are Bronze/Silver/Gold scores for that twist (placeholders from bot sampling, see test/test_core.mjs)
export const TWISTS = [
  { name: 'Opening Night', blurb: 'The normal café night. A good week to learn.', weights: WEIGHTS, closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [1500, 3500, 5000] },
  { name: 'Busy Café', blurb: 'Visitors ask twice as often.', weights: WEIGHTS, closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 3, ticketGap: 2, ticketSpan: 14, ticketMult: 6, bands: [1500, 3600, 5100] },
  { name: 'Bean Night', blurb: 'Toddy hands out bigger beans, fewer sugar cubes.', weights: [14, 16, 26, 24, 20], closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [1300, 3000, 4300] },
  { name: 'Sweet Night', blurb: 'Mostly sugar and ice. Easy to build, slow to climb.', weights: [40, 34, 14, 8, 4], closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [1900, 4300, 6200] },
  { name: 'Early Closing', blurb: 'The dashed line sits lower. Less room, so be tidy.', weights: WEIGHTS, closeY: 255, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [1400, 3300, 4700] },
  { name: 'Full House', blurb: 'Milk swirls drop from the very first minute.', weights: WEIGHTS, closeY: 220, lateLevel: 0, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [800, 1800, 2600] },
  { name: 'Long Shift', blurb: 'Visitors wait longer and tip more.', weights: WEIGHTS, closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 20, ticketMult: 9, bands: [1600, 3800, 5400] },
  { name: 'Grand Finale', blurb: 'Busy Café and Full House together.', weights: WEIGHTS, closeY: 220, lateLevel: 0, lateChance: 0.2, ticketFirst: 3, ticketGap: 2, ticketSpan: 14, ticketMult: 6, bands: [800, 1900, 2700] },
];

// ---- Season Nights (the launch mission): 7 nights x 20 levels. Every level has its own goal and its own rules, and each one is a little harder than the last. ----
// A level is won the moment its goal is met while the crate is still standing. Only numbers change, so the server replays a level exactly like a night.
export const SEASON = { nights: 7, levels: 20 };
export const NIGHT_NAMES = ['Warm-Up Night', 'Visitor Night', 'Heavy Bean Night', 'Tight Crate Night', 'Milk Rush Night', 'Rush Hour Night', 'Full Moon Night'];
export const NIGHT_BLURBS = ['Easy goals and a roomy crate. Learn the feel.', 'Visitors ask for pieces. Serve them.', 'Toddy hands out bigger beans. Think ahead.', 'The dashed line creeps lower. Stay tidy.', 'Milk swirls drop early and often.', 'Short visitor waits and a limited number of drops.', 'Everything at once. Reach for the Full Moon.'];
const NIGHT_WEIGHTS = [[36, 30, 19, 10, 5], [28, 26, 22, 15, 9], [18, 20, 26, 20, 16], [28, 26, 22, 15, 9], [26, 26, 22, 16, 10], [24, 24, 24, 16, 12], [22, 23, 24, 18, 13]];
const NIGHT_LATE = [99, 99, 10, 9, 8, 7, 5];
const lerp = (a, b, t) => a + (b - a) * t;
const GOAL_KINDS = ['score', 'piece', 'serve'];
// SEASON_TABLE:START (written by tools/fm-season-tune.mjs: [goal kind 0 score 1 piece 2 serve, goal number, drop cap or 0], level by level)
const SEASON_TABLE = [
  [0,90,0],[1,6,0],[0,80,0],[1,6,0],[0,290,0],[1,6,0],[0,190,0],[1,6,0],[0,240,0],[0,290,0],
  [0,220,0],[1,6,0],[0,260,0],[1,7,0],[0,280,0],[1,8,0],[0,350,0],[1,8,0],[0,230,0],[0,410,0],
  [0,250,0],[2,3,0],[0,410,0],[1,7,0],[0,550,0],[2,4,0],[0,410,0],[1,8,0],[0,310,0],[0,600,0],
  [0,440,0],[1,8,0],[0,600,0],[2,5,0],[0,490,0],[1,8,0],[0,560,0],[2,5,0],[0,450,0],[0,670,0],
  [0,700,0],[2,7,0],[0,680,0],[1,8,0],[0,710,0],[2,5,0],[0,480,0],[1,9,0],[0,850,0],[0,700,0],
  [0,590,0],[1,8,0],[0,820,0],[2,7,0],[0,1280,0],[1,8,0],[0,670,0],[2,5,0],[0,970,0],[0,1140,0],
  [0,750,117],[2,8,131],[0,820,119],[1,8,113],[0,1130,143],[2,9,128],[0,580,128],[1,8,89],[0,800,130],[0,920,147],
  [0,1080,133],[1,8,108],[0,1010,134],[2,10,132],[0,1020,150],[1,8,95],[0,1280,137],[2,11,135],[0,960,140],[0,1370,180],
  [0,1090,140],[2,7,133],[0,1290,141],[1,10,159],[0,1150,164],[2,12,118],[0,1000,139],[1,10,165],[0,1390,148],[0,1690,171],
  [0,1350,145],[1,9,98],[0,1150,144],[2,11,149],[0,1310,160],[1,9,133],[0,1440,152],[2,12,109],[0,1840,154],[0,2130,195],
  [0,1530,153],[2,8,168],[0,1680,153],[1,10,120],[0,1490,180],[2,12,124],[0,1480,157],[1,10,138],[0,1720,159],[0,1370,172],
  [0,1230,151],[1,10,124],[0,1400,157],[2,9,147],[0,1880,190],[1,9,85],[0,1580,159],[2,11,142],[0,1580,161],[0,1760,169],
  [0,2330,165],[2,10,130],[0,2050,165],[1,9,62],[0,2450,191],[2,11,136],[0,2530,170],[1,9,60],[0,1840,162],[0,2390,192],
  [0,2280,169],[1,10,121],[0,2080,169],[2,12,160],[0,1790,156],[1,9,116],[0,1930,160],[2,12,141],[0,1520,131],[0,3190,225]
];
// SEASON_TABLE:END
export function seasonLevel(night, level) {
  const n = Math.max(1, Math.min(SEASON.nights, night | 0)), l = Math.max(1, Math.min(SEASON.levels, level | 0));
  const g = (n - 1) * SEASON.levels + (l - 1), t = g / (SEASON.nights * SEASON.levels - 1);   // t: how far through the whole mission (0 to 1)
  const row = SEASON_TABLE[g], goal = row ? { type: GOAL_KINDS[row[0]], n: row[1] } : { type: 'score', n: 100 };
  const tw = {
    name: NIGHT_NAMES[n - 1], blurb: NIGHT_BLURBS[n - 1], weights: NIGHT_WEIGHTS[n - 1], closeY: Math.round(lerp(205, 250, t)),
    lateLevel: NIGHT_LATE[n - 1], lateChance: Math.round(lerp(10, 20, t)) / 100,
    ticketFirst: Math.round(lerp(6, 3, t)), ticketGap: Math.round(lerp(5, 2, t)), ticketSpan: Math.round(lerp(18, 11, t)), ticketMult: 6,
    bands: [0, 0, 0], goal,
  };
  if (row && row[2]) tw.dropCap = row[2];   // a limited number of drops from night 4 on
  return { night: n, level: l, seed: 7000000 + n * 1000 + l * 13, tw, goal };
}
export function goalMet(s) {
  const g = s.tw.goal; if (!g) return false;
  return g.type === 'score' ? s.score >= g.n : g.type === 'piece' ? s.maxLevel >= g.n : g.type === 'serve' ? s.served >= g.n : false;
}
// Lost: the crate is full, or the drops ran out and the pieces have settled without the goal.
export const levelLost = (s) => !goalMet(s) && (s.over || !!(s.tw.dropCap && s.drops >= s.tw.dropCap && s.tick > s.nextDropTick + 240));
export const goalDone = (s) => goalMet(s) && !s.over;

// whole days since 1970-01-01 for a yyyymmdd integer (integer maths only)
export function dayNumber(ymd) {
  let y = Math.floor(ymd / 10000); const m = Math.floor(ymd / 100) % 100, d = ymd % 100;
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
export const SEASON_START = 20270104;   // Monday 4 Jan 2027
// which twist runs on a given date. Before the season (rehearsal) and after it, the weeks simply repeat.
export function twistForDate(ymd) {
  const wk = Math.floor((dayNumber(ymd) - dayNumber(SEASON_START)) / 7);
  return ((wk % 8) + 8) % 8;
}

export function dateSeed(d = new Date()) {   // UTC date -> integer like 20261019
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
