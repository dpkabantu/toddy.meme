import { NIGHTS, L1, L2, VA, VB, VC, recordPlan, verifyNight, runLoop, servedCount } from '../../src/core.js';
const N = id => NIGHTS.find(n => n.id === id);
function solve(night, plans) { const logs = []; for (const p of plans) logs.push(recordPlan(night, logs.slice(), p).log); return logs; }
function show(id, plans) {
  const night = N(id); const logs = solve(night, plans);
  const r = verifyNight(night, logs);
  const s = runLoop(night, logs.slice(0, -1), logs[logs.length - 1]);
  console.log('night', id, JSON.stringify(r), s.visitors.map((v, i) => `${v.who}: served@${v.servedAt} deadline ${v.arrive + v.patience} slack ${v.arrive + v.patience - v.servedAt}`).join(' | '));
}
show(1, [[L1, VA, L1, VB]]);
show(2, [[L2], [L1, VA, L1, VB]]);
show(3, [[L2], [L1, VA, L1, VC], [L1, VB]]);
const solo = recordPlan(N(1), [], [L1, VA, L1, VB]).state; console.log('N1 solo', solo.visitors.map(v => v.state + '@' + v.servedAt));
const solo3 = recordPlan(N(3), [], [L2]).state;
