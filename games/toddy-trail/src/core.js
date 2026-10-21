// TODDY Trail rules. PURE and DETERMINISTIC: integers only, no Math.random, no Date.
// The phone and (later) the Worker run this same file, so a log of turns replays to the same score.
// ROUGH PROTOTYPE: nights 1 and 3 only. Numbers are starting estimates.

export const STEPS_PER_SEC = 6;     // Toddy walks 6 cells a second (the page uses this for timing)
export const MAX_LINE = 6;          // most cups Toddy can carry
export const BREW_COOLDOWN = 40;    // steps before a brew spot hands out another cup
export const DX = [0, 1, 0, -1];    // directions: 0 up, 1 right, 2 down, 3 left
export const DY = [-1, 0, 1, 0];
export const DRINKS = ['moon', 'star', 'crescent'];

// A night: grid w x h, Toddy's start, first cups, tables (blocked cells), visitors, brew spots, an optional cart.
// Visitor: body cell (blocked, drawn) and spot cell (the tile in front; step on it to serve), the drink it wants.
export const NIGHTS = {
  1: {
    id: 1, name: 'Café floor', w: 9, h: 13, seconds: 45,
    start: { x: 4, y: 9, dir: 0 }, cups: [0, 1, 2], tables: [], brew: [], cart: null,
    visitors: [
      { who: 'milo', sx: 6, sy: 9, bx: 7, by: 9, want: 0 },
      { who: 'pip', sx: 2, sy: 6, bx: 1, by: 6, want: 1 },
      { who: 'velvet', sx: 6, sy: 3, bx: 7, by: 3, want: 2 },
    ],
  },
  3: {
    id: 3, name: 'Market lane', w: 9, h: 13, seconds: 60,
    start: { x: 4, y: 9, dir: 0 }, cups: [0, 1, 2],
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
};

const cartSeq = (night) => {   // out and back: a b c d e d c b
  const p = night.cart.path, s = p.slice();
  for (let i = p.length - 2; i >= 1; i--) s.push(p[i]);
  return s;
};

export function newState(nightId) {
  const n = NIGHTS[nightId];
  if (!n) throw new Error('unknown night');
  return {
    night: nightId, t: 0, limit: n.seconds * STEPS_PER_SEC,
    x: n.start.x, y: n.start.y, dir: n.start.dir, bumped: false,
    cups: n.cups.slice(), hist: [], served: n.visitors.map(() => false), brewCool: n.brew.map(() => 0),
    cartI: 0, wrong: 0, spills: 0, bumps: 0, over: false, won: false, events: [],
  };
}

export const cartCell = (st) => { const n = NIGHTS[st.night]; return n.cart ? cartSeq(n)[st.cartI % cartSeq(n).length] : null; };

// Is cell (x,y) free for Toddy to step on? line = the cups' cells (the tail cell frees up as Toddy moves).
function blocked(st, n, x, y) {
  if (x < 0 || y < 0 || x >= n.w || y >= n.h) return true;
  for (const [tx, ty] of n.tables) if (tx === x && ty === y) return true;
  for (const v of n.visitors) if (v.bx === x && v.by === y) return true;
  const c = cartCell(st); if (c && c[0] === x && c[1] === y) return true;
  const len = st.cups.length;
  for (let k = 0; k < len - 1; k++) if (st.hist[k] && st.hist[k].x === x && st.hist[k].y === y) return true;   // own line (not the tail)
  return false;
}

// One step. turn: null or a direction 0..3 chosen since the last step. Returns nothing; read st.events for what happened.
export function step(st, turn) {
  if (st.over) return;
  const n = NIGHTS[st.night];
  st.events = [];
  if (turn !== null && turn !== undefined && turn >= 0 && turn <= 3) {
    const opposite = (turn + 2) % 4 === st.dir;
    if (!(opposite && st.cups.length > 0) && turn !== st.dir) { st.bumped = false; st.dir = turn; }   // a new direction ends a stumble
  }
  // the cart rolls on (it waits if Toddy or his line is in the way)
  if (n.cart && st.t % n.cart.every === n.cart.every - 1) {
    const seq = cartSeq(n), next = seq[(st.cartI + 1) % seq.length];
    let free = !(next[0] === st.x && next[1] === st.y);
    for (let k = 0; k < st.cups.length; k++) if (st.hist[k] && st.hist[k].x === next[0] && st.hist[k].y === next[1]) free = false;
    if (free) st.cartI = (st.cartI + 1) % seq.length;
  }
  for (let i = 0; i < st.brewCool.length; i++) if (st.brewCool[i] > 0) st.brewCool[i]--;
  if (!st.bumped) {
    const nx = st.x + DX[st.dir], ny = st.y + DY[st.dir];
    if (blocked(st, n, nx, ny)) {
      st.bumped = true; st.bumps++;
      if (st.cups.length > 0) { st.cups.pop(); st.spills++; st.events.push({ type: 'spill' }); } else st.events.push({ type: 'bump' });
    } else {
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
  }
  st.t++;
  if (st.served.every(Boolean)) { st.over = true; st.won = true; }
  else if (st.t >= st.limit) { st.over = true; }
}

// Score out of 1,000: visitors served 600 + cups kept 200 (minus 40 per spill) + speed 200 (only if everyone is served).
export function score(st) {
  const n = NIGHTS[st.night], count = st.served.filter(Boolean).length;
  const serve = Math.floor((600 * count) / n.visitors.length);
  const kept = Math.max(0, 200 - 40 * st.spills);
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
