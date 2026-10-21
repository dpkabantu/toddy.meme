// Toddy Trail core: on every night a bot can serve every visitor, the same log replays to the same score, bad logs are refused.
// Run: node --no-warnings server/test/trail-core.mjs
import assert from 'node:assert/strict';
import { NIGHTS, NIGHT_IDS, newState, step, score, replay, cartCell, thiefCell, shutterClosed, DX, DY } from '../../games/toddy-trail/src/core.js';

// Greedy bot: for each target in order, take the first step of a shortest path. It avoids walls, its own line, the cart and (if it can) the thief.
function bot(nightId, targets) {
  const n = NIGHTS[nightId], st = newState(nightId), turns = [];
  let ti = 0;
  const blockedFor = (s, x, y, avoidThief) => {
    if (x < 0 || y < 0 || x >= n.w || y >= n.h) return true;
    if (n.tables.some(([a, b]) => a === x && b === y)) return true;
    if (n.visitors.some((v) => v.bx === x && v.by === y)) return true;
    const c = cartCell(s); if (c && ((c[0] === x && c[1] === y) || (avoidThief && c[1] === y && Math.abs(c[0] - x) <= 1))) return true;   // careful: also keep a cell away from the cart, which rolls sideways
    const th = thiefCell(s); if (avoidThief && th && s.thiefCool === 0 && Math.abs(th[0] - x) + Math.abs(th[1] - y) <= 1) return true;
    return false;
  };
  const path = (tx, ty, avoidThief) => {
    const q = [[st.x, st.y]], seen = new Set([st.x + ',' + st.y]), prev = new Map();
    while (q.length) {
      const [x, y] = q.shift();
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d], k = nx + ',' + ny;
        if (seen.has(k) || blockedFor(st, nx, ny, avoidThief && !(nx === tx && ny === ty))) continue;
        seen.add(k); prev.set(k, [x, y, d]);
        if (nx === tx && ny === ty) { let kk = k, first = null; while (prev.has(kk)) { const [px, py, dd] = prev.get(kk); first = dd; kk = px + ',' + py; if (px === st.x && py === st.y) break; } return first; }
        q.push([nx, ny]);
      }
    }
    return null;
  };
  while (!st.over) {
    while (ti < targets.length && targets[ti].done(st)) ti++;
    let turn = null;
    if (ti < targets.length) {
      const [tx, ty] = targets[ti].cell;
      let first = path(tx, ty, true); if (first === null) first = path(tx, ty, false);
      if (first !== null && (first !== st.dir || st.bumped)) turn = first;
    }
    if (turn !== null) turns.push([st.t, turn]);
    step(st, turn);
    if (process.env.TRAIL_DEBUG && st.events.length) console.log('t=' + st.t + ' at (' + st.x + ',' + st.y + ') dir ' + st.dir + ' cups [' + st.cups + '] ' + JSON.stringify(st.events));
    assert.ok(st.t < 5000, 'bot ran away');
  }
  return { st, turns };
}
const S = (n, i) => ({ cell: [NIGHTS[n].visitors[i].sx, NIGHTS[n].visitors[i].sy], done: (s) => s.served[i] });
const B = (n, i) => { let got = false; return { cell: [NIGHTS[n].brew[i].x, NIGHTS[n].brew[i].y], done: (s) => got || (s.brewCool[i] > 0 && (got = true)) }; };

const PLANS = {
  1: (n) => [S(n, 0), S(n, 1), S(n, 2)],
  2: (n) => [B(n, 0), S(n, 0), S(n, 1), S(n, 2), S(n, 3)],
  3: (n) => [B(n, 0), S(n, 0), S(n, 1), S(n, 2), B(n, 1), S(n, 3), S(n, 4)],
  4: (n) => [B(n, 0), S(n, 0), S(n, 1), S(n, 2), B(n, 1), S(n, 3), S(n, 4)],
  5: (n) => [B(n, 1), B(n, 0), S(n, 0), S(n, 1), S(n, 2), S(n, 3), S(n, 4), B(n, 2), S(n, 5)],
  6: (n) => [B(n, 0), B(n, 1), S(n, 0), S(n, 1), S(n, 2), S(n, 3), S(n, 4)],
  7: (n) => [B(n, 0), B(n, 1), S(n, 0), S(n, 1), S(n, 2), S(n, 3), S(n, 4), B(n, 3), B(n, 2), S(n, 5), S(n, 6)],
};

for (const id of NIGHT_IDS) {
  const r = bot(id, PLANS[id](id)), sc = score(r.st);
  console.log('night ' + id + ' (' + NIGHTS[id].name + ') bot: served ' + sc.served + '/' + sc.of + ', score ' + sc.score + ', ' + sc.seconds + ' s of ' + NIGHTS[id].seconds + ', spills ' + r.st.spills + ', snatched ' + r.st.snatched + ', wrong ' + r.st.wrong + ', turns ' + r.turns.length);
  assert.ok(r.st.won, 'night ' + id + ': bot serves everyone');
  const rp = replay(id, r.turns);
  assert.ok(!rp.bad); assert.equal(score(rp.st).score, sc.score, 'replay gives the same score'); assert.deepEqual(rp.st.served, r.st.served);
  const idle = replay(id, []);   // an empty log still ends (the lanterns go out) and scores lower
  assert.ok(idle.st.over && !idle.st.won); assert.ok(score(idle.st).score < sc.score);
}
assert.ok(replay(1, [[10, 1], [5, 2]]).bad, 'steps going backwards are refused');

// Rules spot checks
{
  const st = newState(1);
  for (let i = 0; i < 40 && !st.over; i++) step(st, null);   // walks straight up into the top wall: one stumble, then stands still, no more spills
  assert.equal(st.spills, 1); assert.equal(st.cups.length, 2); assert.ok(st.bumped);
  const t0 = st.t; step(st, null); assert.equal(st.cups.length, 2); assert.equal(st.t, t0 + 1);
}
{ // a closed shutter makes Toddy wait, nothing is lost; once it opens he walks on
  const n = NIGHTS[5]; assert.ok(shutterClosed(n, 0, 4, 7)); assert.ok(!shutterClosed(n, 6, 4, 7));
  const wait = replay(5, [[0, 0]], 5);   // straight up the middle: stands below the shutter
  assert.equal(wait.st.y, 8); assert.equal(wait.st.spills, 0);
  const through = replay(5, [[0, 0]], 10);
  assert.ok(through.st.y < 7 && through.st.spills === 0, 'crossed the shutter after it opened');
}
{ // walking into a visitor hands over the right cup; a wrong cup costs nothing but the visitor sighs
  const st = newState(1); st.x = 7; st.y = 8; st.dir = 2; st.hist = [];   // milo's body is (7,9), he wants drink 0 and Toddy's first cup is 0
  step(st, null); assert.ok(st.served[0] && st.cups.length === 2 && st.spills === 0, 'right cup handed over');
  const w = newState(1); w.x = 1; w.y = 5; w.dir = 2; w.hist = []; w.cups = [1, 0, 0];       // pip's body is (1,6), he wants drink 1, Toddy's first cup is 0
  step(w, null); assert.ok(!w.served[1] && w.cups.length === 3 && w.spills === 0 && w.wrong === 1, 'wrong cup: nothing lost');
}
{ // turning right around is allowed (the cups just follow); after handing a cup over, any swipe moves Toddy on
  const st = newState(1); step(st, null); step(st, 2);
  assert.equal(st.dir, 2); assert.equal(st.spills, 0, 'a U-turn costs nothing');
  const h = newState(1); h.x = 7; h.y = 8; h.dir = 2; h.hist = []; step(h, null);   // hands milo his cup and stops
  assert.ok(h.bumped); step(h, 3); assert.ok(!h.bumped && h.x === 6, 'a swipe left moves on');
}
{ // a puddle slides one extra step
  const st = newState(4); st.x = 4; st.y = 4; st.dir = 0; st.hist = []; st.cups = [];   // (4,3) is a puddle; (4,2) is free
  step(st, null); assert.equal(st.y, 2, 'slid from (4,4) over the puddle at (4,3) to (4,2)');
}
console.log('trail core: all checks passed');
