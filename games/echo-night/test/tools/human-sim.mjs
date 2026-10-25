import { NIGHTS, L1, L2, VA, VB, VC, newLoop, step, stationary } from '../../src/core.js';
const N = id => NIGHTS.find(n => n.id === id);
// human-like bot: first tap after d0 ticks, later taps d1 ticks after the previous leave-condition became true
function rec(night, ghosts, plan, d0, d1) {
  const s = newLoop(night, ghosts); const live = s.toddys.length - 1; let i = 0, ready = d0, condAt = -1;
  while (s.status === 'running') {
    let tap = -1; const td = s.toddys[live];
    if (i < plan.length && s.tick >= ready) {
      if (i === 0) { tap = plan[0]; i++; ready = 0; }
      else if (stationary(td)) {
        const cur = td.node, isL1 = cur === night.levers[0], v = s.visitors.find(q => q.node === cur);
        const can = isL1 ? td.carrying : v ? v.state === 'served' || v.state === 'left' : false;
        if (can && condAt < 0) condAt = s.tick;
        if (can && s.tick >= condAt + d1) { tap = plan[i]; i++; condAt = -1; }
      }
    }
    // reaction delay: after any tap, wait d1 before next leave condition is acted on
    step(s, tap); s.events.length = 0;
  }
  return s;
}
function night(id, plans, d0, d1) {
  const logs = []; let last;
  for (const p of plans) { last = rec(N(id), logs.slice(), p, d0, d1); logs.push(last.liveLog.slice()); }
  console.log(`night ${id} d0=${d0} d1=${d1}: ${last.status}`, last.visitors.map(v => `${v.who}:${v.state}@${v.servedAt} (due ${v.arrive + v.patience})`).join(' | '));
}
for (const [d0, d1] of [[0, 0], [0, 25], [0, 40], [0, 60]]) {
  night(1, [[L1, VA, L1, VB]], d0, d1);
  night(2, [[L2], [L1, VA, L1, VB]], d0, d1);
  night(3, [[L2], [L1, VA, L1, VC], [L1, VB]], d0, d1);
}
