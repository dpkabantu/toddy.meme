// TODDY Trail rules. PURE and DETERMINISTIC: integers only, no Math.random, no Date.
// The phone and (later) the Worker run this same file, so a log of turns replays to the same score.
// ROUGH PROTOTYPE: all 7 nights as grey-box levels. Numbers are starting estimates.

export const STEPS_PER_SEC = 4;     // Toddy walks 3 cells a second (the page uses this for timing); was 6, felt far too fast
export const MAX_LINE = 6;          // most cups Toddy can carry
export const BREW_COOLDOWN = 40;    // steps before a brew spot hands out another cup
export const THIEF_COOLDOWN = 15;   // steps before the night thief can snatch again
export const DX = [0, 1, 0, -1, 0, 1, 1, -1, -1];    // directions: 0 up, 1 right, 2 down, 3 left. 5 to 8 are the diagonals (up-right, down-right, down-left, up-left), used only by levels with diag: true
export const DY = [-1, 0, 1, 0, 0, -1, 1, 1, -1];
export const DRINKS = ['moon', 'star', 'crescent'];

const rect = (x0, y0, x1, y1) => { const r = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) r.push([x, y]); return r; };
const START = { x: 4, y: 9, dir: 0 };   // the three starting cups wait in a line behind Toddy (y 10 to 12)

// A night: grid w x h, first cups, tables (blocked cells), visitors, brew spots and the night's special things:
//   cart (rolling wall) · puddles (slide one extra step) · shutters (closed for `on` steps, open for `off`; Toddy waits at a closed one) ·
//   thief (walks a fixed path; snatches Toddy's last cup if he is beside it).
// Visitor: body cell (blocked, drawn) and spot cell (the tile in front; step on it to serve), the drink it wants.
export const NIGHTS = {
  1: {
    id: 1, name: 'Café floor', w: 9, h: 13, seconds: 45, start: START, cups: [0, 1, 2], tables: [], brew: [],
    visitors: [   // night 1: three different drinks, one visitor each, in the order Toddy meets them
      { who: 'milo', sx: 6, sy: 9, bx: 7, by: 9, want: 0 },
      { who: 'pip', sx: 2, sy: 6, bx: 1, by: 6, want: 1 },
      { who: 'velvet', sx: 6, sy: 3, bx: 7, by: 3, want: 2 },
    ],
  },
  2: {
    id: 2, name: 'Terrace', w: 9, h: 13, seconds: 55, start: START, cups: [0, 1, 2],
    tables: [[2, 7], [3, 7], [5, 7], [6, 7], [3, 4], [4, 4], [5, 4]],
    brew: [{ x: 1, y: 10, drink: 1 }],
    visitors: [
      { who: 'milo', sx: 7, sy: 9, bx: 8, by: 9, want: 0 },
      { who: 'pip', sx: 1, sy: 6, bx: 0, by: 6, want: 1 },
      { who: 'velvet', sx: 7, sy: 3, bx: 8, by: 3, want: 2 },
      { who: 'lumi', sx: 1, sy: 2, bx: 0, by: 2, want: 1 },
    ],
  },
  3: {
    id: 3, name: 'Market lane', w: 9, h: 13, seconds: 60, start: START, cups: [0, 1, 2],
    tables: [[3, 4], [4, 4], [5, 4], [2, 9], [3, 9], [5, 2], [6, 2]],
    brew: [{ x: 1, y: 11, drink: 1 }, { x: 7, y: 5, drink: 0 }],
    cart: { path: [[2, 7], [3, 7], [4, 7], [5, 7], [6, 7]], every: 2 },   // rolls to and fro, one cell every 2 steps
    visitors: [
      { who: 'milo', sx: 7, sy: 10, bx: 8, by: 10, want: 0 },
      { who: 'pip', sx: 1, sy: 8, bx: 0, by: 8, want: 1 },
      { who: 'velvet', sx: 7, sy: 6, bx: 8, by: 6, want: 2 },
      { who: 'lumi', sx: 1, sy: 4, bx: 0, by: 4, want: 1 },
      { who: 'biscuit', sx: 4, sy: 1, bx: 4, by: 0, want: 0 },
    ],
  },
  4: {
    id: 4, name: 'Rainy alley', w: 9, h: 13, seconds: 65, start: START, cups: [0, 1, 2],
    tables: [[3, 5], [4, 5], [5, 5], [2, 8], [6, 8]],
    puddles: [[3, 8], [5, 8], [4, 3], [2, 5]],
    brew: [{ x: 1, y: 10, drink: 0 }, { x: 7, y: 4, drink: 2 }],
    visitors: [
      { who: 'milo', sx: 7, sy: 9, bx: 8, by: 9, want: 0 },
      { who: 'pip', sx: 1, sy: 7, bx: 0, by: 7, want: 1 },
      { who: 'velvet', sx: 7, sy: 6, bx: 8, by: 6, want: 2 },
      { who: 'lumi', sx: 1, sy: 3, bx: 0, by: 3, want: 0 },
      { who: 'biscuit', sx: 4, sy: 1, bx: 4, by: 0, want: 2 },
    ],
  },
  5: {
    id: 5, name: 'Library nook', w: 9, h: 13, seconds: 75, start: START, cups: [0, 1, 2],
    tables: [...rect(0, 7, 3, 7), ...rect(5, 7, 8, 7)],
    shutters: [{ x: 4, y: 7, on: 6, off: 8, phase: 0 }],
    brew: [{ x: 1, y: 11, drink: 1 }, { x: 5, y: 11, drink: 0 }, { x: 1, y: 1, drink: 2 }],
    visitors: [
      { who: 'milo', sx: 7, sy: 8, bx: 8, by: 8, want: 0 },
      { who: 'pip', sx: 1, sy: 8, bx: 0, by: 8, want: 1 },
      { who: 'velvet', sx: 7, sy: 10, bx: 8, by: 10, want: 2 },
      { who: 'lumi', sx: 1, sy: 5, bx: 0, by: 5, want: 0 },
      { who: 'biscuit', sx: 7, sy: 3, bx: 8, by: 3, want: 1 },
      { who: 'milo', sx: 7, sy: 1, bx: 8, by: 1, want: 2 },
    ],
  },
  6: {
    id: 6, name: 'Moon bridge', w: 9, h: 13, seconds: 75, start: START, cups: [0, 1, 2],
    tables: [...rect(0, 5, 3, 8), ...rect(5, 5, 8, 8)],     // a river: one narrow bridge in the middle (x = 4)
    thief: { path: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2]], every: 3 },
    brew: [{ x: 1, y: 10, drink: 1 }, { x: 7, y: 10, drink: 0 }],
    visitors: [
      { who: 'milo', sx: 7, sy: 9, bx: 8, by: 9, want: 0 },
      { who: 'pip', sx: 1, sy: 9, bx: 0, by: 9, want: 1 },
      { who: 'velvet', sx: 7, sy: 3, bx: 8, by: 3, want: 2 },
      { who: 'lumi', sx: 1, sy: 3, bx: 0, by: 3, want: 1 },
      { who: 'biscuit', sx: 4, sy: 1, bx: 4, by: 0, want: 0 },
    ],
  },
  7: {
    id: 7, name: 'Street party', w: 9, h: 13, seconds: 95, start: START, cups: [0, 1, 2],
    tables: [...rect(0, 5, 3, 8), ...rect(5, 5, 8, 8)],
    shutters: [{ x: 4, y: 6, on: 5, off: 9, phase: 3 }],
    cart: { path: [[2, 11], [3, 11], [4, 11], [5, 11], [6, 11]], every: 2 },
    puddles: [[2, 3], [6, 3]],
    thief: { path: [[3, 1], [4, 1], [5, 1]], every: 3 },   // patrols the top middle: the bridge exit and the side visitors are out of his reach
    brew: [{ x: 1, y: 10, drink: 1 }, { x: 7, y: 10, drink: 0 }, { x: 1, y: 4, drink: 2 }, { x: 7, y: 4, drink: 0 }],
    visitors: [
      { who: 'milo', sx: 7, sy: 9, bx: 8, by: 9, want: 0 },
      { who: 'pip', sx: 1, sy: 9, bx: 0, by: 9, want: 1 },
      { who: 'velvet', sx: 6, sy: 12, bx: 7, by: 12, want: 2 },
      { who: 'lumi', sx: 1, sy: 3, bx: 0, by: 3, want: 1 },
      { who: 'biscuit', sx: 7, sy: 3, bx: 8, by: 3, want: 0 },
      { who: 'velvet', sx: 1, sy: 1, bx: 0, by: 1, want: 0 },
      { who: 'milo', sx: 7, sy: 1, bx: 8, by: 1, want: 2 },
    ],
  },
};
export const NIGHT_IDS = Object.keys(NIGHTS).map(Number);

// SAMPLE levels: not part of the Nights 1-7 story (they are not in NIGHT_IDS, so the menu list and "next night" never reach them).
// Level 20 is a hard preview of what the endless levels could feel like: two shutters, a rolling cart, puddles, a patrolling thief, nine visitors.
NIGHTS[20] = {
  id: 20, name: 'Midnight rush', w: 9, h: 13, seconds: 45, start: START, cups: [0, 1, 2],
  tables: [[1, 7], [2, 7], [3, 7], [5, 7], [6, 7], [7, 7], [1, 4], [2, 4], [3, 4], [5, 4], [6, 4], [7, 4]],
  shutters: [{ x: 4, y: 7, on: 4, off: 6, phase: 0 }, { x: 4, y: 4, on: 5, off: 5, phase: 4 }],
  cart: { path: [[1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8]], every: 2 },
  puddles: [[2, 9], [6, 9], [3, 3], [5, 3]],
  thief: { path: [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2]], every: 3 },
  brew: [{ x: 2, y: 10, drink: 1 }, { x: 6, y: 10, drink: 0 }, { x: 2, y: 6, drink: 2 }, { x: 6, y: 5, drink: 0 }, { x: 6, y: 3, drink: 1 }, { x: 2, y: 3, drink: 1 }],
  visitors: [
    { who: 'milo', sx: 7, sy: 10, bx: 8, by: 10, want: 0 },
    { who: 'pip', sx: 1, sy: 10, bx: 0, by: 10, want: 1 },
    { who: 'velvet', sx: 7, sy: 12, bx: 8, by: 12, want: 2 },
    { who: 'lumi', sx: 1, sy: 5, bx: 0, by: 5, want: 1 },
    { who: 'biscuit', sx: 7, sy: 6, bx: 8, by: 6, want: 0 },
    { who: 'velvet', sx: 1, sy: 1, bx: 0, by: 1, want: 0 },
    { who: 'milo', sx: 7, sy: 1, bx: 8, by: 1, want: 2 },
    { who: 'pip', sx: 4, sy: 1, bx: 4, by: 0, want: 1 },
    { who: 'biscuit', sx: 1, sy: 3, bx: 0, by: 3, want: 2 },
  ],
};
export const SAMPLE_IDS = [20];

const pingPong = (path) => { const s = path.slice(); for (let i = path.length - 2; i >= 1; i--) s.push(path[i]); return s; };   // a b c d e d c b
const seqs = {};
const seqOf = (nightId, key) => { const k = nightId + key; if (!seqs[k]) seqs[k] = pingPong(NIGHTS[nightId][key].path); return seqs[k]; };

// Endless levels are built at run time: register one under an id (never one of the story nights) before newState(id).
export function registerLevel(id, def) { NIGHTS[id] = def; delete seqs[id + 'cart']; delete seqs[id + 'thief']; }

export function newState(nightId) {
  const n = NIGHTS[nightId];
  if (!n) throw new Error('unknown night');
  return {
    night: nightId, t: 0, limit: n.seconds * STEPS_PER_SEC,
    x: n.start.x, y: n.start.y, dir: n.start.dir, holding: false, bumped: false, soft: false,
    cups: n.cups.slice(), hist: [], served: n.visitors.map(() => false), brewCool: n.brew.map(() => 0),
    cartI: 0, thiefI: 0, thiefCool: 0, wrong: 0, spills: 0, bumps: 0, snatched: 0, over: false, won: false, events: [],
  };
}

export const cellBlocked = (st, x, y) => blocked(st, NIGHTS[st.night], x, y);
export const cartCell = (st) => { const n = NIGHTS[st.night]; if (!n.cart) return null; const s = seqOf(st.night, 'cart'); return s[st.cartI % s.length]; };
export const thiefCell = (st) => { const n = NIGHTS[st.night]; if (!n.thief) return null; const s = seqOf(st.night, 'thief'); return s[st.thiefI % s.length]; };
export const shutterClosed = (n, t, x, y) => { if (!n.shutters) return false; for (const s of n.shutters) if (s.x === x && s.y === y && ((t + s.phase) % (s.on + s.off)) < s.on) return true; return false; };
const isPuddle = (n, x, y) => !!n.puddles && n.puddles.some(([a, b]) => a === x && b === y);

// Is cell (x,y) free for Toddy to step on? The cups just follow him and never block him. Closed shutters are handled separately.
function blocked(st, n, x, y) {
  if (x < 0 || y < 0 || x >= n.w || y >= n.h) return true;
  for (const [tx, ty] of n.tables) if (tx === x && ty === y) return true;
  for (const v of n.visitors) if (v.bx === x && v.by === y) return true;
  const c = cartCell(st); if (c && c[0] === x && c[1] === y) return true;
  return false;
}

// Toddy steps onto (nx, ny): his line follows, then brew spots and visitors on that tile react.
function moveTo(st, n, nx, ny) {
  st.hist.unshift({ x: st.x, y: st.y });
  if (st.hist.length > MAX_LINE + 1) st.hist.pop();
  st.x = nx; st.y = ny;
  for (let i = 0; i < n.brew.length; i++) {
    const b = n.brew[i];
    if (b.x === nx && b.y === ny && st.brewCool[i] === 0 && st.cups.length < MAX_LINE) { st.cups.push(b.drink); st.brewCool[i] = BREW_COOLDOWN; st.events.push({ type: 'brew', drink: b.drink }); }
  }
  for (let i = 0; i < n.visitors.length; i++) {
    const v = n.visitors[i];
    if (st.served[i] || v.sx !== nx || v.sy !== ny) continue;
    if (st.cups.length > 0 && st.cups[0] === v.want) { st.cups.shift(); st.served[i] = true; st.events.push({ type: 'serve', visitor: i }); }
    else { st.wrong++; st.events.push({ type: 'sigh', visitor: i }); }
  }
}

// One step. turn: null or a direction 0..3 chosen since the last step. Read st.events for what happened.
export function step(st, turn) {
  if (st.over) return;
  const n = NIGHTS[st.night];
  st.events = [];
  // Hold and steer: turn 0-3 = finger down and steering that way (Toddy walks); turn 4 = finger lifted (Toddy stands still).
  if (turn === 4) { st.holding = false; st.bumped = false; st.soft = false; }
  else if (turn !== null && turn !== undefined && ((turn >= 0 && turn <= 3) || (n.diag && turn >= 5 && turn <= 8))) {
    if (turn !== st.dir || !st.holding || (st.bumped && st.soft)) { st.bumped = false; st.soft = false; }   // a new push ends a stop; turning right around is always allowed
    st.dir = turn; st.holding = true;
  }
  // the cart rolls on (it waits if Toddy or his line is in the way)
  if (n.cart && st.t % n.cart.every === n.cart.every - 1) {
    const seq = seqOf(st.night, 'cart'), next = seq[(st.cartI + 1) % seq.length];
    let free = !(next[0] === st.x && next[1] === st.y);
    for (let k = 0; k < st.cups.length; k++) if (st.hist[k] && st.hist[k].x === next[0] && st.hist[k].y === next[1]) free = false;
    if (free) st.cartI = (st.cartI + 1) % seq.length;
  }
  // the night thief walks his path
  if (n.thief && st.t % n.thief.every === n.thief.every - 1) st.thiefI = (st.thiefI + 1) % seqOf(st.night, 'thief').length;
  if (st.thiefCool > 0) st.thiefCool--;
  for (let i = 0; i < st.brewCool.length; i++) if (st.brewCool[i] > 0) st.brewCool[i]--;
  if (st.holding && !st.bumped) {
    const nx = st.x + DX[st.dir], ny = st.y + DY[st.dir];
    if (shutterClosed(n, st.t, nx, ny)) { /* Toddy waits at the shutter; nothing is lost */ }
    else if (n.visitors.some((v) => v.bx === nx && v.by === ny)) {   // walking into a visitor hands them a cup, like stepping on their square
      const vi = n.visitors.findIndex((v) => v.bx === nx && v.by === ny), v = n.visitors[vi];
      if (!st.served[vi]) {
        if (st.cups.length > 0 && st.cups[0] === v.want) { st.cups.shift(); st.served[vi] = true; st.events.push({ type: 'serve', visitor: vi }); }
        else { st.wrong++; st.events.push({ type: 'sigh', visitor: vi }); }
      }
      st.bumped = true; st.soft = true;   // Toddy stops until the next swipe (any swipe); nothing is lost
    }
    else if (st.dir >= 5 && (blocked(st, n, st.x + DX[st.dir], st.y) || blocked(st, n, st.x, st.y + DY[st.dir]))) {
      st.bumped = true; st.soft = true;   // diagonal trial: no cutting a corner past a table or wall; Toddy just stops, nothing is lost
    }
    else if (blocked(st, n, nx, ny)) {
      st.bumped = true; st.soft = false; st.bumps++;
      if (st.cups.length > 0) { st.cups.pop(); st.spills++; st.events.push({ type: 'spill' }); } else st.events.push({ type: 'bump' });
    } else {
      moveTo(st, n, nx, ny);
      if (isPuddle(n, st.x, st.y)) {   // rain: slide one extra step if the way is clear
        const sx = st.x + DX[st.dir], sy = st.y + DY[st.dir];
        if (!blocked(st, n, sx, sy) && !shutterClosed(n, st.t, sx, sy)) { st.events.push({ type: 'slide' }); moveTo(st, n, sx, sy); }
      }
    }
  }
  // the thief snatches the last cup if Toddy is on or beside him
  const tc = thiefCell(st);
  if (tc && st.thiefCool === 0 && st.cups.length > 0 && Math.abs(tc[0] - st.x) + Math.abs(tc[1] - st.y) <= 1) {
    st.cups.pop(); st.snatched++; st.thiefCool = THIEF_COOLDOWN; st.events.push({ type: 'snatch' });
  }
  st.t++;
  if (st.served.every(Boolean)) { st.over = true; st.won = true; }
  else if (st.t >= st.limit) { st.over = true; }
}

// Score out of 1,000: visitors served 600 + cups kept 200 (minus 40 per spilled or snatched cup) + speed 200 (only if everyone is served).
export function score(st) {
  const n = NIGHTS[st.night], count = st.served.filter(Boolean).length;
  const serve = Math.floor((600 * count) / n.visitors.length);
  const kept = Math.max(0, 200 - 40 * (st.spills + st.snatched));
  const speed = st.won ? Math.floor((200 * (st.limit - st.t)) / st.limit) : 0;
  return { score: serve + kept + speed, served: count, of: n.visitors.length, serve, kept, speed, seconds: Math.floor(st.t / STEPS_PER_SEC) };
}

// Replay a log of turns [[step, dir], ...] (step numbers rising) for a night. Used by the Worker later.
export function replay(nightId, turns, maxSteps) {
  const st = newState(nightId);
  let i = 0;
  const cap = Math.min(maxSteps === undefined ? st.limit : maxSteps, st.limit);
  while (!st.over && st.t < cap) {
    let turn = null;
    while (i < turns.length && turns[i][0] === st.t) { turn = turns[i][1]; i++; }
    if (i < turns.length && turns[i][0] < st.t) return { st, bad: true };
    step(st, turn);
  }
  return { st, bad: false };
}
