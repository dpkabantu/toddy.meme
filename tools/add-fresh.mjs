// Gives levels of the diagonal pool a "cups go cold" time. For each level the solver finds a winning route, the route is replayed to see how
// long each cup waited before it was served (A steps at most), and the level gets fresh = A * mult + add (never below 24 steps = 6 s), so the
// known route always still wins. Progress is saved in a JSON file so the job can be run in pieces.
//   node --no-warnings tools/add-fresh.mjs <tier> <mult> <add> [stateFile]   then   node tools/add-fresh.mjs --apply [stateFile]
import fs from 'node:fs';
import { solve } from './trail-solver.mjs';
import { newState, step, registerLevel, NIGHTS } from '../games/toddy-trail/src/core.js';
const POOLF = new URL('../games/toddy-trail/src/endless-diag-pool.js', import.meta.url).pathname;
const { POOL } = await import(POOLF);
const SF = process.argv.find((a, i) => i > 2 && a.endsWith('.json')) || '/tmp/claude-0/dp/fresh.json';
const state = fs.existsSync(SF) ? JSON.parse(fs.readFileSync(SF, 'utf8')) : {};
if (process.argv[2] === '--apply') {
  POOL.forEach((l, i) => { if (state[i]) l.fresh = Math.max(40, state[i]); });   // never under 10 s: a longer time only makes a level easier, so the proof still holds
  const head = fs.readFileSync(POOLF, 'utf8').split('\n').filter((x) => x.startsWith('//')).join('\n');
  fs.writeFileSync(POOLF, head + '\nexport const POOL = ' + JSON.stringify(POOL) + ';\n');
  console.log('applied', Object.keys(state).length, 'levels'); process.exit(0);
}
const tier = +process.argv[2], mult = +process.argv[3], add = +process.argv[4];
const t0 = Date.now();
for (let i = 0; i < POOL.length; i++) {
  const l = POOL[i]; if (l.tier !== tier || state[i]) continue;
  if (Date.now() - t0 > 480000) { console.log('time up, run again'); break; }
  const r = solve(l, { width: tier <= 2 ? 1500 : 6000, maxSeconds: 70, maxMs: 90000 });
  if (!r.won) { console.log(i, 'no clean route found, skipped'); state[i] = 0; continue; }
  registerLevel(9998, { ...l, seconds: 90, fresh: 9999 }); const st = newState(9998); let a = 0, li = 0;
  while (!st.over && li <= r.log.length + 1) {
    const turn = r.log[li] && r.log[li][0] === st.t ? r.log[li++][1] : null;
    const age0 = st.ages[0]; step(st, turn); if (st.events.some((e) => e.type === 'serve')) a = Math.max(a, age0);
  }
  const fresh = Math.max(24, Math.ceil(a * mult + add));
  registerLevel(9997, { ...l, seconds: 90, fresh }); const v = newState(9997); li = 0;
  while (!v.over && li <= r.log.length + 1) { const turn = r.log[li] && r.log[li][0] === v.t ? r.log[li++][1] : null; step(v, turn); }
  delete NIGHTS[9998]; delete NIGHTS[9997];
  if (!v.won || v.cold) { console.log(i, 'replay with fresh', fresh, 'failed'); state[i] = 0; continue; }
  state[i] = fresh; console.log(i, 'tier', tier, 'steps', r.steps, 'oldest served cup', a, '-> fresh', fresh, '(' + (fresh / 4).toFixed(1) + ' s)');
  fs.writeFileSync(SF, JSON.stringify(state));
}
fs.writeFileSync(SF, JSON.stringify(state));
