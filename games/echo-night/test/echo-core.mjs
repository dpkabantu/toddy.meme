import { NIGHTS, NODES, J, L1, L2, VA, VB, VC, P, runLoop, newLoop, step, verifyNight, recordPlan, servedCount } from '../src/core.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// helper: record a whole night from per-loop plans
function solve(night, plans) {
  const logs = [];
  for (const plan of plans) logs.push(recordPlan(night, logs.slice(), plan).log);
  return logs;
}
const N = id => NIGHTS.find(n => n.id === id);

// Night 1: the basics, winnable alone (machine, cup, guest, back to the machine, second guest).
{
  const logs = solve(N(1), [[L1, VA, L1, VB]]);
  const r = verifyNight(N(1), logs);
  ok(r.ok && r.loops === 1, 'night 1 solved alone in 1 loop: ' + JSON.stringify(r));
  const lazy = recordPlan(N(1), [], [L1, VA], true).state;
  ok(servedCount(lazy) === 1, 'night 1: one cup serves only one guest (a second trip is needed)');
}
// Night 2: loop 1 holds the second lever, loop 2 brews and serves
{
  const logs = solve(N(2), [[L2], [L1, VA, L1, VB]]);
  const r = verifyNight(N(2), logs);
  ok(r.ok && r.loops === 2, 'night 2 solved in 2 loops: ' + JSON.stringify(r));
  const alone = recordPlan(N(2), [], [L1, VA, L1, VB]).state;
  ok(servedCount(alone) === 0, 'night 2 alone serves nobody (both levers needed)');
}
// Night 3: three Toddys
{
  const logs = solve(N(3), [[L2], [L1, VA, L1, VC], [L1, VB]]);
  const r = verifyNight(N(3), logs);
  ok(r.ok && r.loops === 3, 'night 3 solved in 3 loops: ' + JSON.stringify(r));
}
// Determinism: replay equals
{
  const logs = solve(N(3), [[L2], [L1, VA, L1, VC], [L1, VB]]);
  const a = verifyNight(N(3), logs), b = verifyNight(N(3), JSON.parse(JSON.stringify(logs)));
  ok(JSON.stringify(a) === JSON.stringify(b), 'replay is identical');
}
// Search: no single-loop plan (up to 6 spots) wins any night; no 2-loop plan wins night 3
function plans(maxLen, spots) {
  const out = [[]];
  const rec = (cur) => { if (cur.length >= maxLen) return; for (const sp of spots) { const n = cur.concat(sp); out.push(n); rec(n); } };
  rec([]); return out;
}
for (const id of [2, 3]) {
  const spots = [L1, L2, VA, VB, VC];
  let win = null; const all = plans(6, spots).filter(p => p.length);
  for (const p of all) { const r = recordPlan(N(id), [], p, true).state; if (r.status === 'won') { win = p; break; } }
  ok(win === null, `night ${id}: no single Toddy plan (${all.length} tried) wins in one loop`);
}
{
  const spots = [L1, L2, VA, VB, VC];
  const ghostPlans = plans(4, spots).filter(p => p.length), livePlans = plans(5, spots).filter(p => p.length);
  let win = null, tried = 0;
  outer: for (const g of ghostPlans) {
    const gl = recordPlan(N(3), [], g).log;
    for (const p of livePlans) { tried++; const r = recordPlan(N(3), [gl], p, true).state; if (r.status === 'won') { win = [g, p]; break outer; } }
  }
  ok(win === null, `night 3: no 2-loop plan (${tried} tried) wins`);
}
process.exit(fails ? 1 : 0);
