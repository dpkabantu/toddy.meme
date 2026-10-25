// TODDY Echo Night: pure rules core (no drawing, no Math.random, no Date, integers only).
// One loop = one night run. Earlier loops come back as ghost Toddys that repeat their taps exactly.
// A replay is the night id plus one tap log per loop: [[tick, spot], ...].
export const TPS = 30; // fixed game ticks per second

// Spots (tappable nodes). Positions are in picture pixels of the café floor (780 x 1174).
export const NODES = [
  { id: 'J', x: 390, y: 440, tap: true },   // 0 crossing (start)
  { id: 'L1', x: 190, y: 300, tap: true },  // 1 machine lever 1 (cup comes out here)
  { id: 'L2', x: 590, y: 300, tap: true },  // 2 machine lever 2
  { id: 'VA', x: 170, y: 650, tap: true },  // 3 table A
  { id: 'VB', x: 610, y: 650, tap: true },  // 4 table B
  { id: 'VC', x: 390, y: 880, tap: true },  // 5 table C
  { id: 'P', x: 390, y: 1060, tap: true },  // 6 parking corner
];
export const J = 0, L1 = 1, L2 = 2, VA = 3, VB = 4, VC = 5, P = 6;
const EDGES = [[J, L1], [J, L2], [J, VA], [J, VB], [J, VC], [VC, P], [VA, VC], [VB, VC]];
const SPEED_PX_PER_TICK = 5; // 150 px per second

// Edge lengths in ticks (integer).
const LEN = Array.from({ length: NODES.length }, () => Array(NODES.length).fill(0));
const ADJ = Array.from({ length: NODES.length }, () => []);
for (const [a, b] of EDGES) {
  const dx = NODES[a].x - NODES[b].x, dy = NODES[a].y - NODES[b].y;
  const len = Math.max(8, Math.round(Math.sqrt(dx * dx + dy * dy) / SPEED_PX_PER_TICK));
  LEN[a][b] = len; LEN[b][a] = len;
  ADJ[a].push(b); ADJ[b].push(a);
}
// All-pairs shortest paths (Floyd-Warshall), ties broken by lowest node index.
const INF = 1e9;
const DIST = Array.from({ length: NODES.length }, (_, i) => Array.from({ length: NODES.length }, (_, j) => (i === j ? 0 : LEN[i][j] || INF)));
const NEXT = Array.from({ length: NODES.length }, (_, i) => Array.from({ length: NODES.length }, (_, j) => (i === j ? j : LEN[i][j] ? j : -1)));
for (let k = 0; k < NODES.length; k++) for (let i = 0; i < NODES.length; i++) for (let j = 0; j < NODES.length; j++) {
  if (DIST[i][k] + DIST[k][j] < DIST[i][j]) { DIST[i][j] = DIST[i][k] + DIST[k][j]; NEXT[i][j] = NEXT[i][k]; }
}
export function edgeLen(a, b) { return LEN[a][b]; }
export function dist(a, b) { return DIST[a][b]; }
function pathNodes(a, b) { // nodes after a, up to and including b
  const out = []; let cur = a;
  while (cur !== b) { cur = NEXT[cur][b]; out.push(cur); }
  return out;
}

// The nights. visitors: node, arrive tick, patience ticks (leaves at arrive + patience if not served).
export const NIGHTS = [
  { id: 1, title: 'First cup', levers: [L1], hold: 75, length: 900, visitors: [
    { who: 'milo', node: VA, arrive: 60, patience: 360 },
    { who: 'pip', node: VB, arrive: 90, patience: 330 } ] },
  { id: 2, title: 'Two hands', levers: [L1, L2], hold: 60, length: 900, visitors: [
    { who: 'lumi', node: VA, arrive: 60, patience: 420 },
    { who: 'milo', node: VB, arrive: 90, patience: 480 } ] },
  { id: 3, title: 'Full house', levers: [L1, L2], hold: 60, length: 1200, visitors: [
    { who: 'pip', node: VA, arrive: 60, patience: 300 },
    { who: 'lumi', node: VB, arrive: 60, patience: 300 },
    { who: 'milo', node: VC, arrive: 400, patience: 300 } ] },
];

export function newLoop(night, ghostLogs) {
  const n = ghostLogs.length;
  const toddys = [];
  for (let i = 0; i <= n; i++) toddys.push({ node: J, to: -1, p: 0, route: [], carrying: false });
  return {
    night, tick: 0, ghostLogs, nextTap: ghostLogs.map(() => 0), liveLog: [],
    toddys, progress: 0, cups: 0, status: 'running', endTick: -1,
    visitors: night.visitors.map(v => ({ node: v.node, arrive: v.arrive, patience: v.patience, who: v.who, state: 'away', servedAt: -1 })),
    events: [], // {t, type, ...} for sound and effects; cleared by the client
  };
}

function tapToddy(td, spot) {
  // route[0] is always the node the toddy is heading to next (the 'to' end while on a path).
  if (td.to === -1) { td.route = pathNodes(td.node, spot); return; }
  const len = LEN[td.node][td.to];
  const viaTo = (len - td.p) + DIST[td.to][spot];
  const viaFrom = td.p + DIST[td.node][spot];
  if (viaFrom < viaTo) { // turn around on the path
    const old = td.node; td.node = td.to; td.to = old; td.p = len - td.p;
  }
  td.route = [td.to].concat(td.to === spot ? [] : pathNodes(td.to, spot));
}

function stationary(td) { return td.to === -1 && td.route.length === 0; }

// Advance one tick. liveSpot: spot index tapped by the player this tick, or -1.
export function step(s, liveSpot) {
  if (s.status !== 'running') return s;
  const t = s.tick;
  const live = s.toddys.length - 1;
  // 1. taps (ghosts first, then live)
  for (let g = 0; g < s.ghostLogs.length; g++) {
    const log = s.ghostLogs[g];
    while (s.nextTap[g] < log.length && log[s.nextTap[g]][0] === t) { applyTap(s.toddys[g], log[s.nextTap[g]][1]); s.nextTap[g]++; }
  }
  if (liveSpot >= 0) { s.liveLog.push([t, liveSpot]); applyTap(s.toddys[live], liveSpot); }
  // 2. movement
  for (const td of s.toddys) moveToddy(td);
  // 3. visitors arrive / leave
  for (let i = 0; i < s.visitors.length; i++) {
    const v = s.visitors[i];
    if (v.state === 'away' && t >= v.arrive) { v.state = 'waiting'; s.events.push({ t, type: 'arrive', v: i }); }
    if (v.state === 'waiting' && t >= v.arrive + v.patience) { v.state = 'left'; s.events.push({ t, type: 'left', v: i }); }
  }
  // 4. machine
  const levers = s.night.levers;
  let allHeld = true;
  for (const lv of levers) if (!s.toddys.some(td => stationary(td) && td.node === lv)) allHeld = false;
  if (allHeld) {
    if (s.progress < s.night.hold) s.progress++;
    if (s.progress >= s.night.hold) {
      const taker = s.toddys.findIndex(td => stationary(td) && td.node === levers[0] && !td.carrying);
      if (taker >= 0) { s.toddys[taker].carrying = true; s.progress = 0; s.cups++; s.events.push({ t, type: 'cup', who: taker }); }
    }
  }
  // 5. serving
  for (let i = 0; i < s.visitors.length; i++) {
    const v = s.visitors[i];
    if (v.state !== 'waiting') continue;
    const k = s.toddys.findIndex(td => stationary(td) && td.carrying && td.node === v.node);
    if (k >= 0) { s.toddys[k].carrying = false; v.state = 'served'; v.servedAt = t; s.events.push({ t, type: 'serve', v: i, who: k }); }
  }
  // 6. end of loop
  s.tick = t + 1;
  if (s.visitors.every(v => v.state === 'served')) { s.status = 'won'; s.endTick = s.tick; s.events.push({ t, type: 'won' }); }
  else if (s.tick >= s.night.length) { s.status = 'timeup'; s.endTick = s.tick; s.events.push({ t, type: 'timeup' }); }
  return s;
}

function applyTap(td, spot) { tapToddy(td, spot); }

function moveToddy(td) {
  if (td.route.length === 0 && td.to === -1) return;
  if (td.to === -1) { td.to = td.route[0]; td.p = 0; }
  td.p++;
  if (td.p >= LEN[td.node][td.to]) {
    td.node = td.to; td.to = -1; td.p = 0; td.route.shift();
    if (td.route.length) { /* next edge starts on the next tick */ }
  }
}

export function servedCount(s) { return s.visitors.filter(v => v.state === 'served').length; }

// Run a whole loop from logs (used by tests and server replay).
export function runLoop(night, ghostLogs, liveLog) {
  const s = newLoop(night, ghostLogs);
  const byTick = new Map(liveLog.map(([t, sp]) => [t, sp]));
  while (s.status === 'running') { step(s, byTick.has(s.tick) ? byTick.get(s.tick) : -1); s.events.length = 0; }
  return s;
}

// Verify a whole night: logs[0..k-1]; loops 0..k-2 must not already win; the last must win.
export function verifyNight(night, logs) {
  for (let j = 0; j < logs.length; j++) {
    const s = runLoop(night, logs.slice(0, j), logs[j]);
    if (j < logs.length - 1 && s.status === 'won') return { ok: false, reason: 'won early', loops: j + 1 };
    if (j === logs.length - 1) return { ok: s.status === 'won', loops: logs.length, endTick: s.endTick, served: servedCount(s) };
  }
  return { ok: false, reason: 'no logs' };
}

// Stars from loops used: par = the fewest loops the designer's solution needs.
export const PAR = { 1: 2, 2: 2, 3: 3 };
export function starsFor(nightId, loops) { const par = PAR[nightId]; return loops <= par ? 3 : loops <= par + 1 ? 2 : 1; }

// Bot used by tests: drives the live toddy by a plan (list of spots) while ghosts replay.
export function recordPlan(night, ghostLogs, plan, stopOnMiss = false) {
  const s = newLoop(night, ghostLogs);
  const live = s.toddys.length - 1;
  let i = 0, started = false;
  while (s.status === 'running') {
    let tap = -1;
    const td = s.toddys[live];
    if (i < plan.length) {
      if (!started) { tap = plan[i]; started = true; i++; }
      else if (stationary(td)) {
        const cur = td.node;
        const isL1 = cur === night.levers[0];
        const visitor = s.visitors.find(v => v.node === cur);
        const canLeave = isL1 ? td.carrying : visitor ? visitor.state !== 'waiting' && visitor.state !== 'away' : false;
        if (canLeave) { tap = plan[i]; i++; }
      }
    }
    step(s, tap); s.events.length = 0;
    if (stopOnMiss && s.visitors.some(v => v.state === 'left')) break;
  }
  return { log: s.liveLog, state: s };
}

export { stationary };
