// Toddy Trail core: a bot can serve every visitor, the same log replays to the same score, and bad logs are refused.
// Run: node --no-warnings server/test/trail-core.mjs
import assert from 'node:assert/strict';
import { NIGHTS, newState, step, score, replay, cartCell, DX, DY } from '../../games/toddy-trail/src/core.js';

// Greedy bot: for each target in order, take the first step of a shortest path (own line and walls avoided).
function bot(nightId, targets) {
  const n = NIGHTS[nightId], st = newState(nightId), turns = [];
  let ti = 0;
  const blockedFor = (s, x, y) => {
    if (x < 0 || y < 0 || x >= n.w || y >= n.h) return true;
    if (n.tables.some(([a, b]) => a === x && b === y)) return true;
    if (n.visitors.some((v) => v.bx === x && v.by === y)) return true;
    const c = cartCell(s); if (c && c[0] === x && c[1] === y) return true;
    for (let k = 0; k < s.cups.length - 1; k++) if (s.hist[k] && s.hist[k].x === x && s.hist[k].y === y) return true;
    return false;
  };
  while (!st.over) {
    // done targets: serve targets are done when served; brew targets done when the cup was taken
    while (ti < targets.length && targets[ti].done(st)) ti++;
    let turn = null;
    if (ti < targets.length) {
      const [tx, ty] = targets[ti].cell;
      const q = [[st.x, st.y, -1]], seen = new Set([st.x + ',' + st.y]), prev = new Map();
      let found = null;
      while (q.length && !found) {
        const [x, y] = q.shift();
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d], k = nx + ',' + ny;
          if (seen.has(k) || blockedFor(st, nx, ny)) continue;
          seen.add(k); prev.set(k, [x, y, d]);
          if (nx === tx && ny === ty) { found = k; break; }
          q.push([nx, ny, d]);
        }
      }
      if (found) {
        let k = found, first = null;
        while (prev.has(k)) { const [px, py, d] = prev.get(k); first = d; k = px + ',' + py; if (px === st.x && py === st.y) break; }
        if (first !== st.dir || st.bumped) turn = first;
      }
    }
    if (turn !== null) turns.push([st.t, turn]);
    step(st, turn);
    assert.ok(st.t < 5000, 'bot ran away');
  }
  return { st, turns };
}
const serveT = (n, i) => ({ cell: [NIGHTS[n].visitors[i].sx, NIGHTS[n].visitors[i].sy], done: (s) => s.served[i] });
const brewT = (n, i, extra) => ({ cell: [NIGHTS[n].brew[i].x, NIGHTS[n].brew[i].y], done: (s) => s.brewCool[i] > 0 || extra });

// Night 1: pass the visitors in cup order.
{
  const r = bot(1, [serveT(1, 0), serveT(1, 1), serveT(1, 2)]);
  const sc = score(r.st);
  assert.ok(r.st.won, 'night 1: bot serves everyone');
  console.log('night 1 bot: served ' + sc.served + '/' + sc.of + ', score ' + sc.score + ', ' + sc.seconds + ' s, spills ' + r.st.spills + ', turns ' + r.turns.length);
  // replay gives the same
  const rp = replay(1, r.turns);
  assert.ok(!rp.bad); assert.equal(score(rp.st).score, sc.score); assert.deepEqual(rp.st.served, r.st.served);
  // an empty log still ends (the lanterns go out) and scores low
  const idle = replay(1, []);
  assert.ok(idle.st.over && !idle.st.won); assert.ok(score(idle.st).score < sc.score);
  // bad log: steps going backwards
  assert.ok(replay(1, [[10, 1], [5, 2]]).bad);
}
// Night 3: brew spot P, serve 3, brew Q, serve 2.
{
  const r = bot(3, [brewT(3, 0), serveT(3, 0), serveT(3, 1), serveT(3, 2), brewT(3, 1), serveT(3, 3), serveT(3, 4)]);
  const sc = score(r.st);
  console.log('night 3 bot: served ' + sc.served + '/' + sc.of + ', score ' + sc.score + ', ' + sc.seconds + ' s, spills ' + r.st.spills + ', wrong ' + r.st.wrong + ', turns ' + r.turns.length);
  assert.ok(r.st.won, 'night 3: bot serves everyone');
  const rp = replay(3, r.turns);
  assert.equal(score(rp.st).score, sc.score);
}
// Rules spot checks
{
  const st = newState(1);
  for (let i = 0; i < 40 && !st.over; i++) step(st, null);   // walks straight up into the top wall: one stumble, then stands still, no more spills
  assert.equal(st.spills, 1); assert.equal(st.cups.length, 2); assert.ok(st.bumped);
  const t0 = st.t; step(st, null); assert.equal(st.cups.length, 2); assert.equal(st.t, t0 + 1);
}
console.log('trail core: all checks passed');
