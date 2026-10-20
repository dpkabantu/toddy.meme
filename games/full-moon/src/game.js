window.MM_ASSETS = {"bg":"assets/bg_v01.webp","crate":"assets/crate_v01.webp","fx_burst":"assets/fx_burst_v01.webp","fx_ring":"assets/fx_ring_v01.webp","fx_spiral":"assets/fx_spiral_v01.webp","medal_1":"assets/medal_1_v01.webp","medal_2":"assets/medal_2_v01.webp","medal_3":"assets/medal_3_v01.webp","medal_4":"assets/medal_4_v01.webp","p01":"assets/p01_sugar_v01.webp","p02":"assets/p02_ice_v01.webp","p03":"assets/p03_bean_light_v01.webp","p04":"assets/p04_bean_medium_v01.webp","p05":"assets/p05_bean_dark_v01.webp","p06":"assets/p06_milk_v01.webp","p07":"assets/p07_cup_v01.webp","p08":"assets/p08_mug_v01.webp","p09":"assets/p09_portal_teal_v01.webp","p10":"assets/p10_portal_violet_v01.webp","p11":"assets/p11_moon_v01.webp","sky_cres":"assets/sky_cres_v01.webp","sky_full":"assets/sky_full_v01.webp","toddy_drop":"assets/toddy_drop_v01.webp","toddy_hold":"assets/toddy_hold_v01.webp"};
window.MM_META = {"pieces":[{"level":1,"name":"sugar","file":"p01_sugar.webp","w":78,"h":82,"ax":39.099999999999994,"ay":40.7853448275862,"body":78.19999999999999,"r":34,"rotates":true},{"level":2,"name":"ice","file":"p02_ice.webp","w":101,"h":100,"ax":50.599999999999994,"ay":49.90206896551723,"body":101.19999999999999,"r":44,"rotates":true},{"level":3,"name":"bean_light","file":"p03_bean_light.webp","w":155,"h":105,"ax":77.62499999999999,"ay":52.69191648822269,"body":124.19999999999999,"r":54,"rotates":true},{"level":4,"name":"bean_medium","file":"p04_bean_medium.webp","w":184,"h":125,"ax":91.99999999999999,"ay":62.316239316239304,"body":147.2,"r":64,"rotates":true},{"level":5,"name":"bean_dark","file":"p05_bean_dark.webp","w":218,"h":148,"ax":109.24999999999999,"ay":73.84275053304903,"body":174.79999999999998,"r":76,"rotates":true},{"level":6,"name":"milk","file":"p06_milk.webp","w":207,"h":202,"ax":103.5,"ay":100.89804469273743,"body":207.0,"r":90,"rotates":true},{"level":7,"name":"cup","file":"p07_cup.webp","w":288,"h":241,"ax":120.75,"ay":120.30875299760193,"body":241.5,"r":105,"rotates":true},{"level":8,"name":"mug","file":"p08_mug.webp","w":379,"h":326,"ax":166.84324324324322,"ay":195.49309309309308,"body":280.59999999999997,"r":122,"rotates":false},{"level":9,"name":"portal_teal","file":"p09_portal_teal.webp","w":327,"h":327,"ax":163.29999999999995,"ay":163.6198824681684,"body":326.5999999999999,"r":142,"rotates":true},{"level":10,"name":"portal_violet","file":"p10_portal_violet.webp","w":373,"h":373,"ax":186.29999999999998,"ay":186.66493633692457,"body":372.59999999999997,"r":162,"rotates":true},{"level":11,"name":"moon","file":"p11_moon.webp","w":438,"h":572,"ax":214.6954873632945,"ay":359.3924363233304,"body":427.79999999999995,"r":186,"rotates":false}],"bg":{"w":941,"h":1672,"win":[501,91,845,430]},"crate":{"w":1086,"h":1448},"toddy":{"toddy_hold":{"w":373,"h":420},"toddy_drop":{"w":373,"h":420},"anchor_x":221.78217821782175,"paws_y_hold":258.16831683168317,"paws_y_drop":272.029702970297}};
(function () {
const C = (function(){
// Moon Merge rules. PURE and DETERMINISTIC: no Math.random, no Date, no trig,
// only + - * / sqrt and integer ops, so every JS engine (phone, Worker) gets the same result.
// Units are "art units" = pixels of the crate image (1086 x 1448).

const TICKS_PER_SEC = 60;
const FIELD = { L: 145, R: 940, FLOOR: 1200, TOP: 7 };
const CLOSE_Y = 220;          // closing line
const SPAWN_Y = 62;           // where Toddy lets go (the empty headroom above the closing line)
const RADII = [34, 44, 54, 64, 76, 90, 105, 122, 142, 162, 186];
const MAX_LEVEL = RADII.length;
const DROP_COOLDOWN = 24;     // ticks between drops (0.4 s)
const WEIGHTS = [28, 26, 22, 15, 9];   // chance of levels 1..5 from Toddy
const LATE_LEVEL = 10;
const LATE_DROP = 6;
const LATE_CHANCE = 0.2;   // once a violet moon exists, 1 in 5 drops is a milk swirl

// Visitor tickets: now and then a visitor asks for a piece. Making it before the deadline pays a bonus.
const TICKET_FIRST = 5;
const TICKET_SPAN = 14;
const TICKET_GAP = 4;
const TICKET_MULT = 6;
const GRAVITY = 0.55, DAMP = 0.9985, ITER = 8, MAX_V = 36;
const STIFF = 0.85, FRICTION = 0.25, CONTACT_DAMP = 0.985, FLOOR_DAMP = 0.9;
const GRACE = 60, OVER_TICKS = 120, CHAIN_WINDOW = 45;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSequence(seed, n = 4000, weights = WEIGHTS) {
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

function newGame(seed, twist = 0) {
  const tw = TWISTS[twist] || TWISTS[0];
  return {
    seed, twist: TWISTS[twist] ? twist : 0, tw, tick: 0, bodies: [], nextId: 1, seq: makeSequence(seed, 4000, tw.weights), late: lateRolls(seed), tix: ticketRolls(seed), seqIndex: 0,
    ticket: null, nextTicketDrop: tw.ticketFirst, served: 0,
    score: 0, chain: 0, lastMergeTick: -1000, nextDropTick: 0,
    over: false, overTick: -1, events: [], drops: 0, maxLevel: 0, merges: 0,
  };
}

const heldLevel = (s) => levelAt(s, s.seqIndex);
const nextLevel = (s) => levelAt(s, s.seqIndex + 1);
const canDrop = (s) => !s.over && s.tick >= s.nextDropTick;

function clampX(level, x) {
  const r = RADII[level - 1];
  const lo = FIELD.L + r, hi = FIELD.R - r;
  return x < lo ? lo : x > hi ? hi : x;
}

function drop(s, x) {
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

function step(s) {
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
function replay(seed, drops, endTick, twist = 0) {
  const s = newGame(seed, twist);
  let di = 0, bad = false;
  while (s.tick < endTick && !s.over) {
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

function stateHash(s) {
  const str = s.tick + '|' + s.score + '|' + s.bodies.map((b) => b.level + ':' + b.x + ':' + b.y).join(',');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16) + '/' + s.score;
}

function bandsOf(twist) { return (TWISTS[twist] || TWISTS[0]).bands; }
function bandFor(score, twist = 0) {   // placeholder thresholds, to be set from real player data
  const b = bandsOf(twist);
  return score >= b[2] ? 3 : score >= b[1] ? 2 : score >= b[0] ? 1 : 0;
}
const BAND_NAMES = ['Played', 'Bronze', 'Silver', 'Gold'];

// ---- weekly twists: only numbers change, so the server replay checks them the same way ----
// bands are Bronze/Silver/Gold scores for that twist (placeholders from bot sampling, see test/test_core.mjs)
const TWISTS = [
  { name: 'Opening Night', blurb: 'The normal café night. A good week to learn.', weights: WEIGHTS, closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [1500, 3500, 5000] },
  { name: 'Busy Café', blurb: 'Visitors ask twice as often.', weights: WEIGHTS, closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 3, ticketGap: 2, ticketSpan: 14, ticketMult: 6, bands: [1500, 3600, 5100] },
  { name: 'Bean Night', blurb: 'Toddy hands out bigger beans, fewer sugar cubes.', weights: [14, 16, 26, 24, 20], closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [1300, 3000, 4300] },
  { name: 'Sweet Night', blurb: 'Mostly sugar and ice. Easy to build, slow to climb.', weights: [40, 34, 14, 8, 4], closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [1900, 4300, 6200] },
  { name: 'Early Closing', blurb: 'The dashed line sits lower. Less room, so be tidy.', weights: WEIGHTS, closeY: 255, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [1400, 3300, 4700] },
  { name: 'Full House', blurb: 'Milk swirls drop from the very first minute.', weights: WEIGHTS, closeY: 220, lateLevel: 0, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 14, ticketMult: 6, bands: [800, 1800, 2600] },
  { name: 'Long Shift', blurb: 'Visitors wait longer and tip more.', weights: WEIGHTS, closeY: 220, lateLevel: 10, lateChance: 0.2, ticketFirst: 5, ticketGap: 4, ticketSpan: 20, ticketMult: 9, bands: [1600, 3800, 5400] },
  { name: 'Grand Finale', blurb: 'Busy Café and Full House together.', weights: WEIGHTS, closeY: 220, lateLevel: 0, lateChance: 0.2, ticketFirst: 3, ticketGap: 2, ticketSpan: 14, ticketMult: 6, bands: [800, 1900, 2700] },
];

// whole days since 1970-01-01 for a yyyymmdd integer (integer maths only)
function dayNumber(ymd) {
  let y = Math.floor(ymd / 10000); const m = Math.floor(ymd / 100) % 100, d = ymd % 100;
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
const SEASON_START = 20270104;   // Monday 4 Jan 2027
// which twist runs on a given date. Before the season (rehearsal) and after it, the weeks simply repeat.
function twistForDate(ymd) {
  const wk = Math.floor((dayNumber(ymd) - dayNumber(SEASON_START)) / 7);
  return ((wk % 8) + 8) % 8;
}

function dateSeed(d = new Date()) {   // UTC date -> integer like 20261019
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

return {TICKS_PER_SEC,FIELD,CLOSE_Y,SPAWN_Y,RADII,MAX_LEVEL,DROP_COOLDOWN,WEIGHTS,LATE_LEVEL,LATE_DROP,LATE_CHANCE,TICKET_FIRST,TICKET_SPAN,TICKET_GAP,TICKET_MULT,mulberry32,makeSequence,newGame,heldLevel,nextLevel,canDrop,clampX,drop,step,replay,stateHash,bandsOf,bandFor,BAND_NAMES,TWISTS,dayNumber,SEASON_START,twistForDate,dateSeed};
})();
// TODDY Full Moon (working code name: moon-merge): drawing, input and screens. All rules live in core.js.

const META = window.MM_META, ASSET = window.MM_ASSETS;
const $ = (id) => document.getElementById(id);
const app = $('app'), cv = $('c'), ctx = cv.getContext('2d');
const elScore = $('score'), elBest = $('best'), elMode = $('modeLabel'), elNext = $('nextImg'), overlay = $('overlay');
const IMG = {};
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
const PIECE_KEYS = META.pieces.map((p) => 'p' + pad2(p.level));

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('image failed: ' + src.slice(0, 40)));
    i.src = src;
  });
}

// ---------- state ----------
let S = null, mode = 'boot', kind = 'daily', log = [], lastRun = null, twist = 0;
let aimX = (C.FIELD.L + C.FIELD.R) / 2, toddyX = aimX, pressed = false;
let dropPoseUntil = -1, overAt = 0, shownNext = 0;
const fx = [], pops = [];
const keys = { left: false, right: false };
let W = 0, H = 0, dpr = 1, k = 1, crateX = 0, crateY = 0, cw = 0, ch = 0, toddyH = 150;
let bgS = 1, bgX = 0, panelCv = null;
const REDUCE = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let bestVal = 0;
let bannerUntil = 0, shake = 0, lastMax = 0, moonrises = 0;
// ---- sound: tiny synth, starts after the first touch, can be muted ----
let AC = null, muted = false;
try { muted = localStorage.getItem('mmMute') === '1'; } catch (e) { /* none */ }   // sound is on unless the player turned it off
let master = null, noiseBuf = null;
function buildMaster(ctx) {          // one warm output chain: soft low-pass, gentle limiter, low level
  const g = ctx.createGain(); g.gain.value = 2.2;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4800; lp.Q.value = 0.4;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
  g.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
  return g;
}
function ensureAudio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = buildMaster(AC); } catch (e) { AC = null; master = null; }
  }
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) { /* none */ } }
  syncMusic();
}
// soft sine voice with a quick attack and a long, natural fade
function voice(freq, dur, vol, delay, slideTo, dest) {
  const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
}
// ceramic clink: a few inharmonic partials that die away at different speeds
function clink(freq, dur, vol, delay) {
  const parts = [[1, 1, 1], [2.76, 0.38, 0.55], [5.4, 0.14, 0.3], [8.9, 0.05, 0.18]];
  for (const [r, a, d] of parts) voice(freq * r, dur * d, vol * a, delay);
}
// music-box / marimba note: soft sine plus a faint octave-and-a-bit overtone
function mallet(freq, dur, vol, delay, dest) { voice(freq, dur, vol, delay, undefined, dest); voice(freq * 3, dur * 0.25, vol * 0.18, delay, undefined, dest); }
// bean on wood: a short filtered knock plus a low thump
function knock(vol) {
  const t = AC.currentTime;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, Math.floor(AC.sampleRate * 0.06), AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); }
  const n = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  n.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 1.2;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  n.connect(f); f.connect(g); g.connect(master); n.start(t);
  voice(150, 0.11, vol * 0.9, 0, 70);
}
function guard(fn) { return (...args) => { if (!AC || !master || muted) return; try { fn(...args); } catch (e) { /* sound is optional */ } }; }
// night-café scale: A minor pentatonic, so nothing ever clashes
const NOTES = [220, 262, 294, 330, 392, 440, 523, 587, 659, 784, 880];
const sfx = {
  drop: guard(() => knock(0.5)),
  merge: guard((level, chain) => { const f = NOTES[level - 1] * 2; clink(f, 0.7, 0.10 + 0.005 * level); if (chain >= 1) clink(f * 1.5, 0.6, 0.06, 0.08); }),
  fresh: guard((level) => { const f = NOTES[level - 1] * 2; mallet(f, 0.8, 0.10); mallet(f * 1.19, 0.8, 0.09, 0.12); mallet(f * 1.5, 1.0, 0.09, 0.24); }),
  ticket: guard(() => { clink(1318, 0.9, 0.08); clink(1046, 1.1, 0.08, 0.2); }),
  served: guard(() => { clink(1568, 0.6, 0.09); voice(220, 1.1, 0.05, 0.02); voice(262, 1.1, 0.05, 0.02); voice(330, 1.1, 0.05, 0.02); }),
  warn: guard(() => voice(110, 0.22, 0.22, 0, 85)),
  over: guard(() => { mallet(659, 1.0, 0.08); mallet(523, 1.0, 0.08, 0.28); mallet(392, 1.2, 0.08, 0.56); mallet(294, 1.6, 0.08, 0.9); voice(110, 2.0, 0.05, 0.9, 98); }),
  full: guard(() => { [880, 1109, 1319, 1760].forEach((f, i) => clink(f, 1.1, 0.08, i * 0.1)); [220, 262, 330, 440].forEach((f) => voice(f, 1.8, 0.04, 0.05)); }),
};
// ---- background music: a slow music-box loop in A minor, kept well under the sound effects ----
let musicOn = true;
try { musicOn = localStorage.getItem('mmMusic') !== '0'; } catch (e) { /* none */ }
let musicBus = null, musicTimer = 0, musicNext = 0, musicBar = 0;
const MUSIC_VOL = 0.5;     // music level: rms about the same as the loudest effects; pad is an octave up for phone speakers
const EIGHTH = 0.5;         // seconds per eighth note: one bar lasts 4 s, the 4-bar loop 16 s
const BARS = [
  { chord: [110, 165, 220], mel: [659, 0, 523, 0, 440, 523, 659, 0] },
  { chord: [87.3, 131, 175], mel: [523, 0, 440, 0, 523, 440, 392, 0] },
  { chord: [131, 196, 262], mel: [784, 0, 659, 0, 523, 659, 784, 0] },
  { chord: [98, 147, 196], mel: [587, 0, 659, 587, 523, 0, 392, 0] },
];
function padNote(freq, t, dur, vol) {      // soft sine pad with a slow fade in and out
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
}
function scheduleBar(t0, i) {
  const b = BARS[i % BARS.length], d0 = t0 - AC.currentTime;
  for (const f of b.chord) { padNote(f * 2, t0, 4.8, 0.045); padNote(f, t0, 4.8, 0.02); }   // pad sits an octave up: phone speakers cannot play deep notes
  b.mel.forEach((f, k) => { if (f) mallet(f, 1.6, 0.11, d0 + k * EIGHTH, musicBus); });
}
function musicTick() {
  if (!AC || !musicBus) return;
  while (musicNext < AC.currentTime + 1.5) { scheduleBar(musicNext, musicBar++); musicNext += 8 * EIGHTH; }
}
function startMusic() {
  if (!AC || !master || muted || !musicOn || musicTimer) return;
  if (!musicBus) { musicBus = AC.createGain(); musicBus.gain.value = 0; musicBus.connect(master); }
  musicBus.gain.cancelScheduledValues(AC.currentTime); musicBus.gain.setTargetAtTime(MUSIC_VOL, AC.currentTime, 0.7);
  musicNext = AC.currentTime + 0.2; musicTimer = setInterval(musicTick, 400); musicTick();
}
function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = 0; }
  if (musicBus && AC) { musicBus.gain.cancelScheduledValues(AC.currentTime); musicBus.gain.setTargetAtTime(0, AC.currentTime, 0.2); }
}
function syncMusic() { if (!muted && musicOn && !document.hidden) startMusic(); else stopMusic(); }
async function renderMusic(secs) {      // test hook: render the music offline and measure it
  const keep = [AC, master, muted, musicBus], off = new OfflineAudioContext(1, 44100 * secs, 44100);
  AC = off; master = buildMaster(off); muted = false; musicBus = off.createGain(); musicBus.gain.value = MUSIC_VOL; musicBus.connect(master);
  try {
    for (let i = 0; i * 4 < secs; i++) scheduleBar(i * 4 + 0.05, i);
    const buf = await off.startRendering(), d = buf.getChannelData(0); let peak = 0, sum = 0, bad = 0;
    for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) bad++; const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), nan: bad };
  } finally { AC = keep[0]; master = keep[1]; muted = keep[2]; musicBus = keep[3]; }
}
// test hook: render one sound offline and measure it (used by the automated checks only)
async function renderSfx(name, args) {
  const keepAC = AC, keepMaster = master, keepMuted = muted;
  const off = new OfflineAudioContext(1, 44100 * 3, 44100);
  AC = off; master = buildMaster(off); muted = false; noiseBuf = null;
  try { sfx[name](...(args || [])); const buf = await off.startRendering(); const d = buf.getChannelData(0); let peak = 0, sum = 0, bad = 0; for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) bad++; const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; } return { name, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), nan: bad }; }
  finally { AC = keepAC; master = keepMaster; muted = keepMuted; noiseBuf = null; }
}
document.addEventListener('pointerdown', ensureAudio, { passive: true });
document.addEventListener('keydown', ensureAudio);
const elBanner = $('banner');
function banner(text, cls, ms) { elBanner.textContent = text; elBanner.className = 'show ' + (cls || ''); bannerUntil = performance.now() + (ms || 1300); }
// night streak: consecutive days with a finished Tonight's night (stored on this device only)
// The TODDY night starts at 13:00 UTC (18:30 India time). All dates in the game follow it, so every player gets the same night.
const nightNow = () => new Date(Date.now() - 13 * 3600000);
function dayNum(d) { return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000); }
function streakNow() {
  try { const o = JSON.parse(store('mmStreak') || 'null'); if (o && dayNum(nightNow()) - o.day <= 1) return o.n; } catch (e) { /* none */ }
  return 0;
}
function streakDone() {
  const today = dayNum(nightNow());
  try { const o = JSON.parse(store('mmStreak') || 'null'); if (o && o.day === today) return; store('mmStreak', JSON.stringify({ day: today, n: o && today - o.day === 1 ? o.n + 1 : 1 })); } catch (e) { store('mmStreak', JSON.stringify({ day: today, n: 1 })); }
}

// ---------- storage (optional, never required) ----------
function store(key, val) {
  try { if (val === undefined) return window.localStorage.getItem(key); window.localStorage.setItem(key, val); } catch (e) { /* private window */ }
  return null;
}
const bestKey = () => (kind === 'daily' ? 'mm.best.daily.' + S.seed : 'mm.best.free' + (twist ? '.w' + twist : ''));

// ---------- layout ----------
function placeTicket() { /* the bonus row now lives inside the HUD, nothing to place */ }
const SHOW_H = 1390;   // art units shown from the top of the crate: the field (to 1200) plus the top of the bottom frame
function layout() {
  const r = app.getBoundingClientRect();
  W = Math.max(280, r.width); H = Math.max(420, r.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const hudH = $('hud').getBoundingClientRect().height || 110;
  // The play area is the widest it can be: the wooden frame may run a little off the screen sides and the
  // bottom frame is cut after its top part, so the field itself (art width 795) fills almost the whole screen.
  const toddyH0 = Math.max(100, Math.min(135, W * 0.34));
  const toddyRoom = toddyH0 * 0.4;                       // Toddy's head rises a little above the crate
  const kW = (W - 28) / (C.FIELD.R - C.FIELD.L);          // field fills the width, 14 px of frame stays visible each side
  const kH = (H - hudH - toddyRoom - 4) / SHOW_H;         // or the height, whichever is smaller
  k = Math.max(0.2, Math.min(kW, kH));
  cw = 1086 * k; ch = 1448 * k;
  crateX = (W - cw) / 2; crateY = H - 4 - SHOW_H * k;
  toddyH = Math.max(100, Math.min(135, cw * 0.32));
  // in-game banner stays inside the crate's inner area, never on the wooden frame
  const innerL = crateX + C.FIELD.L * k, innerW = (C.FIELD.R - C.FIELD.L) * k;
  elBanner.style.left = (innerL + 6).toFixed(1) + 'px'; elBanner.style.right = 'auto'; elBanner.style.width = (innerW - 12).toFixed(1) + 'px';
  elBanner.style.fontSize = Math.max(15, Math.min(24, innerW * 0.075)).toFixed(1) + 'px';
  bgS = Math.max(W / META.bg.w, H / META.bg.h); bgX = (W - META.bg.w * bgS) / 2;
  buildPanel();
  placeTicket();
}

function buildPanel() {
  const w = Math.round((C.FIELD.R - C.FIELD.L) * k * dpr), h = Math.round((C.FIELD.FLOOR + 6 - C.FIELD.TOP) * k * dpr);
  panelCv = document.createElement('canvas'); panelCv.width = w; panelCv.height = h;
  const g = panelCv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(18,14,44,0.93)'); grad.addColorStop(1, 'rgba(30,22,60,0.93)');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const rnd = C.mulberry32(7);   // fixed stars so every screen looks the same
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h, s = (0.6 + rnd() * 1.4) * dpr;
    g.fillStyle = 'rgba(255,244,214,' + (0.15 + rnd() * 0.35).toFixed(2) + ')';
    g.beginPath(); g.arc(x, y, s, 0, 6.2832); g.fill();
  }
}

const sx = (x) => crateX + x * k, sy = (y) => crateY + y * k;

// ---------- drawing ----------
function drawPiece(level, x, y, ang, scale, alpha) {
  const spec = META.pieces[level - 1], img = IMG[PIECE_KEYS[level - 1]];
  const as = (2 * spec.r) / spec.body * k * scale;   // css px per sprite px
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.translate(sx(x), sy(y));
  if (spec.rotates && ang) ctx.rotate(ang);
  ctx.drawImage(img, -spec.ax * as, -spec.ay * as, spec.w * as, spec.h * as);
  ctx.restore();
}

function coverRect(img, x, y, w, h) {   // draw img to cover a rectangle
  const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function render(now) {
  const sh = shake > 0 && !REDUCE ? shake * 0.6 : 0;
  ctx.setTransform(dpr, 0, 0, dpr, Math.sin(now / 17) * sh * dpr, Math.cos(now / 23) * sh * dpr);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, W, H);
  // background wall with the window showing tonight's sky
  const win = META.bg.win, skyImg = (S && S.seed % 2) ? IMG.sky_cres : IMG.sky_full;
  ctx.save();
  coverRect(skyImg, bgX + win[0] * bgS - 4, win[1] * bgS - 4, (win[2] - win[0]) * bgS + 8, (win[3] - win[1]) * bgS + 8);
  ctx.restore();
  ctx.drawImage(IMG.bg, bgX, 0, META.bg.w * bgS, META.bg.h * bgS);
  // crate back panel
  ctx.drawImage(panelCv, sx(C.FIELD.L), sy(C.FIELD.TOP), (C.FIELD.R - C.FIELD.L) * k, (C.FIELD.FLOOR + 6 - C.FIELD.TOP) * k);

  let danger = 0;
  if (S) for (const b of S.bodies) if (b.over > danger) danger = b.over;
  // closing line
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(now / 120);
  const red = danger > 0 || (S && S.over);
  ctx.setLineDash([10 * k * 2.2, 8 * k * 2.2]);
  ctx.lineWidth = Math.max(2, 3 * k * 1.6);
  ctx.strokeStyle = red ? 'rgba(255,93,77,' + (0.55 + 0.4 * pulse).toFixed(2) + ')' : 'rgba(253,175,30,0.45)';
  ctx.beginPath(); ctx.moveTo(sx(C.FIELD.L), sy(S.tw.closeY)); ctx.lineTo(sx(C.FIELD.R), sy(S.tw.closeY)); ctx.stroke();
  ctx.restore();

  if (S) {
    // held piece and aim guide
    if (mode === 'play' && !S.over) {
      const lvl = C.heldLevel(S), r = C.RADII[lvl - 1], hx = C.clampX(lvl, aimX);
      ctx.save();
      ctx.setLineDash([5, 7]); ctx.strokeStyle = 'rgba(255,244,214,0.16)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx(hx), sy(C.SPAWN_Y + r)); ctx.lineTo(sx(hx), sy(C.FIELD.FLOOR)); ctx.stroke();
      ctx.restore();
    }
    // pieces in the crate
    for (const b of S.bodies) {
      let scale = 1;
      if (b.merged) { const age = S.tick - b.born; if (age < 16) { const q = 1 - age / 16; scale = 1 + 0.3 * q * q; } }
      drawPiece(b.level, b.x, b.y, b.ang, scale);
    }
  }
  // effects
  for (const f of fx) {
    const p = f.age / f.dur, img = IMG[f.key];
    const size = f.size * (0.55 + 0.75 * p) * k, a = Math.pow(1 - p, 1.3);
    ctx.save(); ctx.globalAlpha = a;
    ctx.drawImage(img, sx(f.x) - size / 2, sy(f.y) - size / 2, size, size * img.height / img.width);
    ctx.restore();
  }
  ctx.drawImage(IMG.crate, crateX, crateY, cw, ch);
  // score pops
  for (const p of pops) {
    const q = p.age / 50;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - q * q);
    const FONT = ' Fredoka, ui-rounded, "Trebuchet MS", system-ui, sans-serif';
    let size = Math.round(18 + Math.min(p.big, 10));
    ctx.font = '700 ' + size + 'px' + FONT;
    ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a0a05'; ctx.fillStyle = p.color;
    const fieldL = sx(C.FIELD.L), fieldW = (C.FIELD.R - C.FIELD.L) * k, maxW = fieldW - 14;
    let tw = ctx.measureText(p.text).width;
    if (tw > maxW) { size = Math.max(11, Math.floor(size * maxW / tw)); ctx.font = '700 ' + size + 'px' + FONT; tw = ctx.measureText(p.text).width; }
    const half = tw / 2 + 4;   // keep the whole text inside the crate's inner area
    const px = Math.min(fieldL + fieldW - half, Math.max(fieldL + half, sx(p.x)));
    const py = Math.max(sy(C.FIELD.TOP) + 30, sy(p.y) - q * 46);
    ctx.strokeText(p.text, px, py); ctx.fillText(p.text, px, py);
    ctx.restore();
  }
  drawToddy();
  if (S && mode === 'play' && !S.over) {
    const lvl = C.heldLevel(S);
    drawPiece(lvl, C.clampX(lvl, aimX), C.SPAWN_Y, 0, 1, C.canDrop(S) ? 1 : 0.55);
  }
}

function drawToddy() {
  const T = META.toddy;
  const dropping = S && S.tick < dropPoseUntil;
  const key = dropping ? 'toddy_drop' : 'toddy_hold', info = T[key];
  const sc = toddyH / info.h;
  const paws = (dropping ? T.paws_y_drop : T.paws_y_hold) * sc;
  const pawsY = sy(C.SPAWN_Y) - cw * 0.012;
  const x = sx(toddyX) - T.anchor_x * sc, y = pawsY - paws;
  ctx.drawImage(IMG[key], x, y, info.w * sc, toddyH);
}

// ---------- game flow ----------
const withA = (n) => (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;
const PIECE_NAMES = ['sugar', 'ice', 'light bean', 'medium bean', 'dark bean', 'milk swirl', 'moon cup', 'gold mug', 'teal moon', 'violet moon', 'Full Moon'];
const elProg = $('prog'), elGoal = $('goal'), elTicket = $('ticket');
let ticketKey = '';
function updateTicket() {
  const t = S && !S.over ? S.ticket : null;
  const key = t ? t.level + ':' + Math.max(0, t.deadline - S.drops) : '';
  if (key === ticketKey) return;
  placeTicket();
  ticketKey = key;
  if (!t) { elTicket.hidden = true; return; }
  const left = Math.max(0, t.deadline - S.drops);
  elTicket.hidden = false;
  elTicket.innerHTML = '<img alt="" src="' + ASSET[PIECE_KEYS[t.level - 1]] + '"><span>Make <b>' + withA(PIECE_NAMES[t.level - 1]) + '</b> · ' + (left > 0 ? left + ' drops' : 'last drop') + ' · +' + (t.level * S.tw.ticketMult) + '</span>';
}
let progBuilt = false, progMax = -1;
function updateProg() {
  if (!progBuilt) {
    elProg.innerHTML = PIECE_KEYS.map((key, i) => '<img alt="" class="pp' + i + '" src="' + ASSET[key] + '">').join('');
    progBuilt = true;
  }
  const m = S ? S.maxLevel : 0;
  if (m !== progMax) {
    progMax = m;
    const imgs = elProg.children;
    for (let i = 0; i < imgs.length; i++) imgs[i].className = 'pp' + i + (i < m ? ' lit' : (i === m ? ' goalp' : ''));
  }
  const score = S ? S.score : 0, band = C.bandFor(score, twist);
  elGoal.textContent = band < 3 ? C.BAND_NAMES[band + 1] + ' ' + C.bandsOf(twist)[band].toLocaleString('en-US') : 'Gold medal!';
}
function setScore() { elScore.textContent = S ? S.score.toLocaleString('en-US') : '0'; elBest.textContent = 'Best ' + bestVal.toLocaleString('en-US'); updateProg(); updateTicket(); }
function setNext() {
  if (!S) return;
  const n = C.nextLevel(S);
  if (n !== shownNext) { shownNext = n; elNext.src = ASSET[PIECE_KEYS[n - 1]]; }
}
function dateLabel() {
  const d = nightNow(), m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return d.getUTCDate() + ' ' + m[d.getUTCMonth()];
}

function todayTwist() { return C.twistForDate(C.dateSeed(nightNow())); }
function startRun(k2, seedOverride, twistOverride) {
  kind = k2;
  const seed = seedOverride !== undefined ? seedOverride : (kind === 'daily' ? C.dateSeed(nightNow()) : (Math.random() * 2147483647) | 0);
  twist = kind === 'daily' && twistOverride === undefined ? todayTwist() : (twistOverride || 0);
  S = C.newGame(seed, twist); lastMax = 0; moonrises = 0; shake = 0; ticketKey = '~'; log = []; fx.length = 0; pops.length = 0; shownNext = 0;
  dropPoseUntil = -1; pressed = false;
  aimX = (C.FIELD.L + C.FIELD.R) / 2; toddyX = aimX;
  bestVal = parseInt(store(bestKey()) || '0', 10) || 0;
  elMode.textContent = (kind === 'daily' ? 'Tonight · ' : 'Free · ') + C.TWISTS[twist].name;
  mode = 'play'; overlay.hidden = true;
  if (kind === 'daily' && window.ToddySeason) window.ToddySeason.start('full-moon');
  setScore(); setNext();
  banner(C.TWISTS[twist].name + ' · ' + C.TWISTS[twist].blurb, 'new', 2600);
}

function dropAt(xArt) {
  if (mode !== 'play' || !S || !C.canDrop(S)) return false;
  const x = Math.round(C.clampX(C.heldLevel(S), xArt));
  const t = S.tick;
  if (C.drop(S, x)) { log.push([t, x]); return true; }
  return false;
}

function drain() {
  for (const e of S.events) {
    if (e.type === 'drop') { dropPoseUntil = S.tick + 16; sfx.drop(); }
    else if (e.type === 'ticket') { banner('Visitor wants ' + withA(PIECE_NAMES[e.level - 1]) + '! Make one for +' + (e.level * S.tw.ticketMult), 'new', 1800); sfx.ticket(); }
    else if (e.type === 'served') { banner('Visitor served! +' + e.points, 'new', 1800); sfx.served(); pops.push({ x: (C.FIELD.L + C.FIELD.R) / 2, y: 500, text: 'VISITOR +' + e.points, age: 0, color: '#fce25d', big: 9 }); }
    else if (e.type === 'ticket_gone') banner('The visitor left', 'chain', 1000);
    else if (e.type === 'merge') {
      setScore();
      const big = e.level >= 9, mid = e.level >= 7;
      if (e.level >= 8) shake = Math.max(shake, e.level >= 10 ? 16 : 9);
      if (e.level > lastMax) { lastMax = e.level; if (e.level >= 3) { banner('New piece: ' + PIECE_NAMES[e.level - 1] + '!', 'new', 1700); sfx.fresh(e.level); } else sfx.merge(e.level, e.chain); }
      else { if (e.chain >= 1) banner('Chain ×' + (e.chain + 1), 'chain', 900); sfx.merge(e.level, e.chain); }
      fx.push({ key: big ? 'fx_burst' : mid ? 'fx_spiral' : 'fx_ring', x: e.x, y: e.y, size: C.RADII[e.level - 1] * (big ? 4.2 : 3.4), age: 0, dur: big ? 34 : 24 });
      pops.push({ x: e.x, y: e.y - C.RADII[e.level - 1] * 0.4, text: '+' + e.points, age: 0, color: e.chain > 0 ? '#fce25d' : '#fff4d6', big: e.level });
    } else if (e.type === 'vanish') {
      fx.push({ key: 'fx_burst', x: e.x, y: e.y, size: 900, age: 0, dur: 46 });
      fx.push({ key: 'fx_spiral', x: e.x, y: e.y, size: 1200, age: 0, dur: 60 });
      moonrises++;
      shake = 20; sfx.full(); banner('Moonrise! Two Full Moons +' + e.points, 'new', 2400);
      pops.push({ x: e.x, y: e.y, text: 'MOONRISE +' + e.points, age: 0, color: '#fce25d', big: 12 });
    } else if (e.type === 'gameover') { mode = 'over'; overAt = performance.now(); sfx.over(); }
  }
  S.events.length = 0;
}

function tickOnce() {
  if (keys.left || keys.right) aimX += (keys.right ? 1 : 0) * 9 - (keys.left ? 1 : 0) * 9;
  aimX = Math.min(C.FIELD.R, Math.max(C.FIELD.L, aimX));
  C.step(S);
  drain();
  for (const f of fx) f.age++;
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].age >= fx[i].dur) fx.splice(i, 1);
  for (const p of pops) p.age++;
  for (let i = pops.length - 1; i >= 0; i--) if (pops[i].age >= 50) pops.splice(i, 1);
  let dg = 0; for (const b of S.bodies) if (b.over > dg) dg = b.over;
  if (dg > 20 && dg % 30 === 0 && !S.over) sfx.warn();
  if (dg > 20 && !S.over) banner('Too high! ' + Math.max(0, (120 - dg) / 60).toFixed(1) + 's', 'warn', 250);
  if (shake > 0) shake--;
  setScore(); setNext();
}

let last = 0, acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!last) last = t;
  let dt = t - last; last = t; if (dt > 100) dt = 100;
  if (S && mode === 'play') {
    acc += dt; let n = 0;
    while (acc >= 1000 / 60 && n < 5) { tickOnce(); acc -= 1000 / 60; n++; }
    if (n === 5) acc = 0;
  } else if (S && mode === 'over') {   // let the last effects play out
    acc += dt; while (acc >= 1000 / 60) { acc -= 1000 / 60; for (const f of fx) f.age++; for (const p of pops) p.age++; }
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].age >= fx[i].dur) fx.splice(i, 1);
    for (let i = pops.length - 1; i >= 0; i--) if (pops[i].age >= 50) pops.splice(i, 1);
    if (performance.now() - overAt > 1100 && overlay.hidden) finishRun();
  }
  if (bannerUntil && performance.now() > bannerUntil) { bannerUntil = 0; elBanner.className = ''; }
  toddyX += (Math.min(C.FIELD.R, Math.max(C.FIELD.L, aimX)) - toddyX) * 0.3;
  render(t);
}

function finishRun() {
  lastRun = { seed: S.seed, twist, moonrises, kind, drops: log.slice(), endTick: S.tick, score: S.score, maxLevel: S.maxLevel };
  if (kind === 'daily') streakDone();
  const sentDaily = kind === 'daily' && window.ToddySeason;
  if (S.score > bestVal) { bestVal = S.score; store(bestKey(), String(bestVal)); }
  setScore();
  showOver();
  if (sentDaily) {
    const T = window.ToddySeason;
    T.finish('full-moon', { drops: lastRun.drops, endTick: lastRun.endTick, score: lastRun.score }).then(function (res) { const el = document.getElementById('seasonline'); if (!res) T.guestHint(el); else T.show(el, res); });
  }
}

// ---------- screens ----------
function strip() {
  let h = '<div class="strip" aria-label="The 11 pieces, smallest to largest">';
  for (let i = 0; i < 11; i++) h += '<img alt="" class="ps' + i + '" src="' + ASSET[PIECE_KEYS[i]] + '">';
  return h + '</div>';
}
function showMenu() {
  mode = 'menu';
  overlay.hidden = false;
  overlay.innerHTML =
    '<div class="card"><div class="label">TODDY</div><h1>Full Moon</h1><p class="sub">Two the same make the next one. Reach Toddy’s Full Moon.</p>' + strip() +
    '<button class="btn" data-act="daily">Tonight’s night<small>' + dateLabel() + ' · ' + C.TWISTS[todayTwist()].name + ' · same drops for everyone' + (streakNow() > 0 ? ' · ' + streakNow() + '-night streak' : '') + '</small></button>' +
    '<button class="btn alt" data-act="free">Free play</button>' +
    settingsRow() +
    '<div class="links"><button class="chip" data-act="how">How to play</button><button class="chip" data-act="weeks">Weekly twists</button><button class="chip" data-act="pieces">Pieces</button><button class="chip" data-act="about">About</button><button class="chip" data-act="sharegame">Share game</button></div>' +
    '<p class="help">A calm puzzle. Every piece is made up, nothing leaves this device, and the game never asks for real details.</p></div>';
}
function showWeeks() {
  mode = 'menu'; overlay.hidden = false;
  const now = todayTwist();
  overlay.innerHTML = '<div class="card"><h2>Weekly twists</h2><p class="sub">Each week of the season has its own small twist. Tonight’s night follows the calendar. Here you can practise any week.</p><div class="weeks">' +
    C.TWISTS.map((t, i) => '<button class="btn alt wk" data-act="tw" data-w="' + i + '">Week ' + (i + 1) + ' · ' + t.name + (i === now ? ' · this week' : '') + '<small>' + t.blurb + '</small></button>').join('') +
    '</div><button class="btn" data-act="menu">Back</button></div>';
}
function showInfo(kindName) {
  mode = 'menu'; overlay.hidden = false;
  const back = '<button class="btn" data-act="menu">Back</button>';
  let body;
  if (kindName === 'how') body = '<h2>How to play</h2><ol class="steps"><li><b>Aim.</b> Touch and drag. Toddy follows your finger.</li><li><b>Drop.</b> Lift your finger to let go.</li><li><b>Goal.</b> The row of pieces under your score shows what you have made. The dashed one is the next to make.</li><li><b>Merge.</b> Two the same touching become the next piece. Quick chains score extra.</li><li><b>Visitors.</b> Now and then a visitor asks for one piece. Make it (merge two of the piece before it) within the drops shown and you get bonus points. You can ignore it.</li><li><b>Weekly twist.</b> Every week of the season changes one small rule, like busier visitors or a lower line. The menu names tonight’s twist.</li><li><b>Moonrise.</b> Two Full Moons touching vanish for 66 points and clear lots of room.</li><li><b>Stay under the line.</b> If a piece rests above the dashed line for 2 seconds, the night ends.</li></ol><p class="help">Tip: keep big pieces in a corner and build down from there.</p>';
  else if (kindName === 'pieces') body = '<h2>The 11 pieces</h2>' + strip() + '<p class="sub">Sugar, ice, three beans, milk swirl, moon cup, gold mug, teal moon, violet moon, then Toddy’s Full Moon. Toddy hands out the first five, and after your first violet moon, sometimes a milk swirl.</p><p class="help">Medals: Played, Bronze, Silver, Gold. Scores are never added across games.</p>';
  else body = '<h2>About</h2><p class="sub">Full Moon is a one-finger puzzle from the TODDY games. Tonight’s night gives everyone the same drops, so scores are fair. Free play is random practice.</p><p class="help">Preview build. Play is as a guest, no wallet or sign-in. Education and fun only.</p>';
  overlay.innerHTML = '<div class="card">' + body + back + '</div>';
}
function showPause() {
  if (mode !== 'play') return;
  mode = 'paused'; overlay.hidden = false;
  overlay.innerHTML = '<div class="card"><h2>Paused</h2><button class="btn" data-act="resume">Resume</button><button class="btn alt" data-act="restart">Restart</button><button class="btn alt" data-act="menu">Menu</button>' + settingsRow() + '</div>';
}
function lasted() { const sec = Math.round(S.tick / 60); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

// ---------- share card: a spoiler-free picture of the finished night ----------
const SERIF = ' "Playfair Display", Georgia, "Times New Roman", serif';
const SANS = ' Fredoka, ui-rounded, "Trebuchet MS", system-ui, sans-serif';
// one line of poetry for each medal, so the card reads like a small story and not a score sheet
function cardLine(band, maxLevel) {
  if (maxLevel >= 11) return 'Toddy’s Full Moon rose over the café.';
  return ['The night is only beginning.', 'A warm cup and a steady hand.', 'The whole café glows by your hand.', 'A golden night at Toddy’s café.'][band];
}
function moonMark(size) {                    // a tiny gold crescent with a star, drawn in code
  const m = document.createElement('canvas'); m.width = m.height = size;
  const g = m.getContext('2d'), r = size * 0.36, cx = size * 0.5, cy = size * 0.5;
  g.fillStyle = '#fdaf1e'; g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx + r * 0.5, cy - r * 0.12, r * 0.86, 0, 6.2832); g.fill();
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff4d6'; g.beginPath();
  for (let i = 0; i < 8; i++) { const rad = i % 2 ? size * 0.035 : size * 0.1, ang = i * 0.7854 - 1.5708; g.lineTo(size * 0.8 + Math.cos(ang) * rad, size * 0.3 + Math.sin(ang) * rad); }
  g.closePath(); g.fill();
  return m;
}
function spaced(g, text, x, y, gap) {         // letter-spaced text that works in every browser
  if ('letterSpacing' in g) { g.letterSpacing = gap + 'px'; g.fillText(text, x + gap / 2, y); g.letterSpacing = '0px'; return; }
  const w = [...text].reduce((t, ch) => t + g.measureText(ch).width + gap, -gap); let px = x - w / 2; g.textAlign = 'left';
  for (const ch of text) { g.fillText(ch, px, y); px += g.measureText(ch).width + gap; } g.textAlign = 'center';
}
function fitText(g, text, maxW, font, size) { g.font = font.replace('{s}', size); const w = g.measureText(text).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
function makeShareCard() {
  const CWD = 1080, CHT = 1600, c = document.createElement('canvas'); c.width = CWD; c.height = CHT;
  const g = c.getContext('2d'), band = C.bandFor(S.score, twist), mid = CWD / 2;
  const bg = g.createLinearGradient(0, 0, 0, CHT); bg.addColorStop(0, '#120e2c'); bg.addColorStop(0.5, '#1d1744'); bg.addColorStop(1, '#2d2058');
  g.fillStyle = bg; g.fillRect(0, 0, CWD, CHT);
  const rnd = C.mulberry32(3);
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,244,214,' + (0.12 + rnd() * 0.5).toFixed(2) + ')'; g.beginPath(); g.arc(rnd() * CWD, rnd() * 700, 0.8 + rnd() * 2.2, 0, 6.2832); g.fill(); }
  g.textAlign = 'center';
  // thin gold frame
  g.strokeStyle = 'rgba(201,154,59,.55)'; g.lineWidth = 3; g.strokeRect(28, 28, CWD - 56, CHT - 56);
  g.strokeStyle = 'rgba(201,154,59,.25)'; g.lineWidth = 1.5; g.strokeRect(44, 44, CWD - 88, CHT - 88);
  // kicker, title and the night's name
  g.fillStyle = 'rgba(253,227,189,.85)'; g.font = '600 26px' + SANS; spaced(g, "TODDY  ·  A NIGHT AT THE CAFÉ", mid, 108, 7);
  const tsize = fitText(g, 'Full Moon', 860, '700 {s}px' + SERIF, 132);
  const tg = g.createLinearGradient(0, 130, 0, 250); tg.addColorStop(0, '#fff1c4'); tg.addColorStop(0.55, '#fdaf1e'); tg.addColorStop(1, '#c9822a');
  g.save(); g.shadowColor = 'rgba(253,175,30,.45)'; g.shadowBlur = 28; g.fillStyle = tg; g.font = '700 ' + tsize + 'px' + SERIF; g.fillText('Full Moon', mid, 232); g.restore();
  g.fillStyle = '#fde3bd'; g.font = 'italic 500 38px' + SERIF;
  g.fillText((kind === 'daily' ? 'The night of ' + dateLabel() : 'A free-play night') + '  ·  ' + C.TWISTS[twist].name, mid, 290);
  // ornament line with a small moon in the middle
  const mm = moonMark(70); g.strokeStyle = 'rgba(201,154,59,.6)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(190, 330); g.lineTo(mid - 52, 330); g.moveTo(mid + 52, 330); g.lineTo(CWD - 190, 330); g.stroke(); g.drawImage(mm, mid - 35, 295, 70, 70);
  // medal with a warm glow
  const med = IMG['medal_' + (band + 1)], mh = 200, mw = mh * med.width / med.height, my = 385;
  const glow = g.createRadialGradient(mid, my + mh / 2, 20, mid, my + mh / 2, 240); glow.addColorStop(0, 'rgba(253,175,30,.34)'); glow.addColorStop(1, 'rgba(253,175,30,0)');
  g.fillStyle = glow; g.fillRect(mid - 300, my - 120, 600, mh + 240); g.drawImage(med, mid - mw / 2, my, mw, mh);
  g.fillStyle = '#fdaf1e'; g.font = '700 40px' + SANS; spaced(g, C.BAND_NAMES[band].toUpperCase(), mid, 640, 12);
  // the score
  g.fillStyle = 'rgba(253,227,189,.75)'; g.font = '600 24px' + SANS; spaced(g, 'NIGHT SCORE', mid, 706, 8);
  const sg = g.createLinearGradient(0, 720, 0, 830); sg.addColorStop(0, '#fffaf0'); sg.addColorStop(1, '#f6d58c');
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 14; g.shadowOffsetY = 4; g.fillStyle = sg; g.font = '700 128px' + SANS; g.fillText(S.score.toLocaleString('en-US'), mid, 822); g.restore();
  g.fillStyle = '#fde3bd'; g.font = 'italic 500 42px' + SERIF; g.fillText('“' + cardLine(band, S.maxLevel) + '”', mid, 898);
  // the pieces made, lit up to the highest one
  const n = 11, gap = 10, ph = 54, widths = PIECE_KEYS.map((k2) => ph * IMG[k2].width / IMG[k2].height);
  let x = (CWD - (widths.reduce((q, w) => q + w, 0) + gap * (n - 1))) / 2;
  for (let i = 0; i < n; i++) { g.globalAlpha = i < S.maxLevel ? 1 : 0.28; g.drawImage(IMG[PIECE_KEYS[i]], x, 930, widths[i], ph); x += widths[i] + gap; }
  g.globalAlpha = 1;
  const statLine = 'Lasted ' + lasted() + '  ◆  Piece ' + S.maxLevel + ' of 11' + (S.served ? '  ◆  ' + S.served + ' visitor' + (S.served > 1 ? 's' : '') + ' served' : '') + (moonrises ? '  ◆  Moonrise ×' + moonrises : '');
  g.fillStyle = '#fde3bd'; g.font = '500 ' + fitText(g, statLine, 940, '500 {s}px' + SANS, 31) + 'px' + SANS; g.fillText(statLine, mid, 1030);
  // the finished crate, cut out of the live game picture (Toddy included)
  const vx0 = Math.max(0, crateX), vw = Math.min(W, crateX + cw) - vx0;
  const sy0 = Math.max(0, crateY - toddyH * 0.85), sh = H - sy0;
  const areaTop = 1060, areaH = 410, sc = Math.min(areaH / sh, 980 / vw), dw = vw * sc, dh = sh * sc, dx = (CWD - dw) / 2, dy = areaTop + (areaH - dh) / 2;
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 24; g.fillStyle = '#000'; g.fillRect(dx, dy, dw, dh); g.restore();
  g.drawImage(cv, vx0 * dpr, sy0 * dpr, vw * dpr, sh * dpr, dx, dy, dw, dh);
  g.strokeStyle = 'rgba(201,154,59,.7)'; g.lineWidth = 3; g.strokeRect(dx, dy, dw, dh);
  // sign-off
  g.fillStyle = '#fdaf1e'; g.font = 'italic 600 40px' + SERIF; g.fillText('Can you beat this night?', mid, 1512);
  g.fillStyle = 'rgba(253,227,189,.6)'; g.font = '500 24px' + SANS; spaced(g, 'TODDY GAMES', mid, 1558, 8);
  return c;
}
async function showPicture() {
  overlay.hidden = false;
  overlay.innerHTML = '<div class="card"><h2>Your night</h2><p class="sub">Painting your card…</p></div>';
  try {   // wait (briefly) for the card fonts so the picture uses them
    await Promise.race([Promise.all(['700 100px "Playfair Display"', 'italic 500 40px "Playfair Display"', '600 30px Fredoka'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 1800))]);
  } catch (e) { /* fallback fonts are fine */ }
  let url = '';
  shareBlob = null;
  try {
    const cv2 = makeShareCard();
    url = cv2.toDataURL('image/png');
    cv2.toBlob((b) => { shareBlob = b; }, 'image/png');
  } catch (e) { url = ''; }
  overlay.innerHTML = '<div class="card">' + (url
    ? '<h2>Your night</h2><img class="sharepic" alt="TODDY Full Moon result card: ' + C.BAND_NAMES[C.bandFor(S.score, twist)] + ' medal, ' + S.score.toLocaleString('en-US') + ' points" src="' + url + '">' +
      '<button class="btn" data-act="share">Share</button><div class="links"><button class="chip" data-act="save">Save picture</button><button class="chip" data-act="copy" id="copyBtn2">Copy result</button></div>'
    : '<h2>Picture not available</h2><p class="sub">Your browser would not make the picture. Use Copy result instead.</p><button class="btn alt" data-act="copy" id="copyBtn2">Copy result</button>') +
    '<button class="btn alt" data-act="back">Back</button></div>';
  shareUrl = url;
}
let shareBlob = null, shareUrl = '';
const gameLink = () => location.origin + location.pathname;
function resultText() {
  return 'TODDY Full Moon · ' + (kind === 'daily' ? 'Tonight ' + dateLabel() : 'Free play') + ' · ' + C.TWISTS[twist].name + ' · ' + S.score.toLocaleString('en-US') + ' · ' + C.BAND_NAMES[C.bandFor(S.score, twist)] + ' medal · ' + lasted() + (moonrises ? ' · Moonrise ×' + moonrises : '') + ' — can you beat it? ' + gameLink();
}
function flash(btn, msg) { const t = btn.textContent; btn.textContent = msg; setTimeout(() => { btn.textContent = t; }, 1800); }
async function doShare(btn) {
  const text = resultText();
  try {
    if (navigator.share) {
      const data = { title: 'TODDY Full Moon', text, url: gameLink() };
      if (shareBlob && navigator.canShare) {
        const f = new File([shareBlob], 'toddy-full-moon.png', { type: 'image/png' });
        if (navigator.canShare({ files: [f] })) { data.files = [f]; }
      }
      await navigator.share(data);
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); flash(btn, 'Result copied — paste it anywhere'); } catch (e) { flash(btn, 'Press and hold the picture to share'); }
}
function doSave(btn) {
  try {
    const a = document.createElement('a');
    a.href = shareBlob ? URL.createObjectURL(shareBlob) : shareUrl;
    a.download = 'toddy-full-moon.png';
    document.body.appendChild(a); a.click(); a.remove();
    flash(btn, 'Saved');
  } catch (e) { flash(btn, 'Press and hold the picture'); }
}
function showOver() {
  const band = C.bandFor(S.score, twist), nm = C.BAND_NAMES[band];
  const next = band < 3 ? C.bandsOf(twist)[band] : 0;
  overlay.hidden = false;
  overlay.innerHTML =
    '<div class="card"><h2>Night over</h2><img class="medal" alt="" src="' + ASSET['medal_' + (band + 1)] + '">' +
    '<div class="band">' + nm + '</div><div class="final">' + S.score.toLocaleString('en-US') + '</div>' +
    '<p class="sub">Lasted <b>' + lasted() + '</b> · ' + S.drops + ' drops</p><p class="sub">' + (kind === 'daily' ? "Tonight's best " : 'Best ') + bestVal.toLocaleString('en-US') + ' · highest piece ' + S.maxLevel + ' of 11' + (S.served ? ' · ' + S.served + ' visitor' + (S.served > 1 ? 's' : '') + ' served' : '') + (moonrises ? ' · Moonrise ×' + moonrises : '') + (next ? ' · next medal at ' + next.toLocaleString('en-US') : '') + '</p>' +
    '' + (kind === 'daily' ? '<p class="sub" id="seasonline" hidden></p>' : '') + '<button class="btn" data-act="again">Play again</button><button class="btn share" data-act="pic">Share your night</button><button class="btn alt" data-act="menu">Menu</button></div>';
}

// ---------- full screen (Android and desktop browsers; iPhone Safari has no full screen for web pages) ----------
const docEl = document.documentElement;
const canFS = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = !!navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
const iosHint = isIOS && !canFS && !isStandalone;   // iPhone Safari cannot go full screen; installing to the Home Screen can
let wantFull = canFS;
try { if (localStorage.getItem('mmFull') === '0') wantFull = false; } catch (e) { /* none */ }
function enterFS() {
  if (!canFS || isFS()) return;
  try {
    const p = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' });
    const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {}); } catch (e) { /* optional */ } };
    if (p && p.then) p.then(lock, () => {}); else lock();
  } catch (e) { /* the browser said no */ }
}
function exitFS() { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* none */ } }
function toggleFS() { if (isFS()) exitFS(); else enterFS(); }
const FS_ICON_IN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/></svg>';
const FS_ICON_OUT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3v6H3M21 9h-6V3M15 21v-6h6M3 15h6v6"/></svg>';
const btnFull = $('btnFull');
function paintFull() {
  btnFull.hidden = !canFS && !iosHint;
  btnFull.innerHTML = isFS() ? FS_ICON_OUT : FS_ICON_IN;
  btnFull.setAttribute('aria-label', iosHint ? 'Full screen on iPhone: how' : (isFS() ? 'Exit full screen' : 'Full screen'));
  document.querySelectorAll('[data-act=full]').forEach((el) => { el.textContent = isFS() ? 'Exit full screen' : 'Full screen'; });
}
function onFSChange() {
  wantFull = isFS();      // leaving full screen by any route (button, swipe, back) means: stay out next time
  try { localStorage.setItem('mmFull', wantFull ? '1' : '0'); } catch (e) { /* none */ }
  paintFull();
}
document.addEventListener('fullscreenchange', onFSChange);
document.addEventListener('webkitfullscreenchange', onFSChange);
function showIosFull(fromPlay) {
  mode = 'menu'; overlay.hidden = false;
  overlay.innerHTML = '<div class="card"><h2>Full screen on iPhone</h2><p class="sub">Safari does not allow full screen for web pages, but this works:</p><ol class="steps"><li>Tap the <b>Share</b> button in Safari (the square with an arrow, at the bottom or top).</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li><li>Open <b>Full Moon</b> from your Home Screen. It opens with no address bar.</li></ol><p class="help">Your scores stay in this browser only, so the Home Screen version starts with fresh scores.</p><button class="btn" data-act="' + (fromPlay ? 'pause' : 'menu') + '">Back</button></div>';
}
btnFull.addEventListener('click', () => { if (iosHint) { if (mode === 'play') { mode = 'paused'; showIosFull(true); } else showIosFull(false); } else toggleFS(); });
function settingsRow() {
  return '<div class="links"><button class="chip" data-act="snd">Sound: ' + (muted ? 'Off' : 'On') + '</button><button class="chip" data-act="mus">Music: ' + (musicOn ? 'On' : 'Off') + '</button>' +
    (canFS ? '<button class="chip" data-act="full">' + (isFS() ? 'Exit full screen' : 'Full screen') + '</button>' : '') + (iosHint ? '<button class="chip" data-act="iosfull">Full screen</button>' : '') + '</div>';
}
function toggleSound() { muted = !muted; try { localStorage.setItem('mmMute', muted ? '1' : '0'); } catch (e) { /* none */ } paintSound(); ensureAudio(); syncMusic(); if (!muted) sfx.ticket(); }

overlay.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.act;
  if (wantFull && (a === 'daily' || a === 'free' || a === 'tw' || a === 'again' || a === 'restart' || a === 'resume')) enterFS();
  if (a === 'snd') { toggleSound(); b.textContent = 'Sound: ' + (muted ? 'Off' : 'On'); }
  else if (a === 'mus') { musicOn = !musicOn; try { localStorage.setItem('mmMusic', musicOn ? '1' : '0'); } catch (err) { /* none */ } ensureAudio(); syncMusic(); b.textContent = 'Music: ' + (musicOn ? 'On' : 'Off'); }
  else if (a === 'full') { toggleFS(); }
  else if (a === 'iosfull') showIosFull(false);
  else if (a === 'pause') { mode = 'play'; showPause(); }
  else if (a === 'daily') startRun('daily');
  else if (a === 'free') startRun('free');
  else if (a === 'weeks') showWeeks();
  else if (a === 'tw') startRun('free', undefined, parseInt(b.dataset.w, 10));
  else if (a === 'resume') { mode = 'play'; overlay.hidden = true; }
  else if (a === 'restart' || a === 'again') startRun(kind, undefined, twist);
  else if (a === 'menu') showMenu();
  else if (a === 'pic') showPicture();
  else if (a === 'back') showOver();
  else if (a === 'how' || a === 'pieces' || a === 'about') showInfo(a);
  else if (a === 'copy') {
    const txt = resultText();
    try { navigator.clipboard.writeText(txt).then(() => flash(b, 'Copied'), () => { b.textContent = txt; }); } catch (err) { b.textContent = txt; }
  }
  else if (a === 'share') doShare(b);
  else if (a === 'save') doSave(b);
  else if (a === 'sharegame') {
    const text = 'TODDY Full Moon — a calm merge puzzle. Same drops for everyone each night. ' + gameLink();
    if (navigator.share) navigator.share({ title: 'TODDY Full Moon', text, url: gameLink() }).catch(() => {});
    else { try { navigator.clipboard.writeText(text).then(() => flash(b, 'Link copied'), () => flash(b, gameLink())); } catch (err) { flash(b, gameLink()); } }
  }
});
$('btnPause').addEventListener('click', showPause);
const btnSound = $('btnSound');
function paintSound() { btnSound.textContent = muted ? '♪̸' : '♪'; btnSound.setAttribute('aria-pressed', muted ? 'true' : 'false'); btnSound.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); btnSound.classList.toggle('off', muted); }
btnSound.addEventListener('click', toggleSound);
paintSound();
paintFull();

// ---------- input ----------
function artX(ev) { const r = app.getBoundingClientRect(); return (ev.clientX - r.left - crateX) / k; }
app.addEventListener('pointerdown', (ev) => {
  if (mode !== 'play' || ev.target.closest('button')) return;
  pressed = true; aimX = artX(ev);
  try { app.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ }
});
app.addEventListener('pointermove', (ev) => { if (mode === 'play') aimX = artX(ev); });
app.addEventListener('pointerup', (ev) => {
  if (mode !== 'play' || !pressed) return;
  pressed = false; aimX = artX(ev); dropAt(aimX);
});
app.addEventListener('pointercancel', () => { pressed = false; });
app.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  else if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { if (mode === 'play') { e.preventDefault(); dropAt(aimX); } }
  else if (e.key === 'Escape') { if (mode === 'play') showPause(); else if (mode === 'paused') { mode = 'play'; overlay.hidden = true; } }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  else if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') showPause(); syncMusic(); });
new ResizeObserver(() => { if (IMG.crate) layout(); }).observe(app);

// ---------- boot ----------
async function boot() {
  const names = Object.keys(ASSET);
  const imgs = await Promise.all(names.map((n) => loadImg(ASSET[n])));
  names.forEach((n, i) => { IMG[n] = imgs[i]; });
  try { await document.fonts.load('700 20px Fredoka'); } catch (e) { /* fallback font is fine */ }
  layout();
  twist = todayTwist(); S = C.newGame(C.dateSeed(nightNow()), twist);     // an idle crate behind the menu
  mode = 'menu'; setScore(); setNext(); showMenu();
  requestAnimationFrame(frame);
  $('loading').hidden = true;
}
window.__mm = { renderSfx, renderMusic, get musicOn() { return musicOn; }, get twist() { return twist; },
  C, dropAt, startRun, showMenu, get S() { return S; }, get log() { return log; }, get lastRun() { return lastRun; },
  get mode() { return mode; }, get fx() { return fx; }, get pops() { return pops; }, setAim(x) { aimX = x; }, layoutInfo: () => ({ W, H, k, cw, ch, crateX, crateY, dpr, toddyH }),
};
boot().catch((e) => { const l = $('loading'); l.hidden = false; l.textContent = 'Could not load: ' + e.message; console.error(e); });

})();
