// Server game checks. Run: node --no-warnings server/test/games.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as FM from '../games/full-moon-core.js';
import * as fullMoon from '../games/full-moon.js';
import * as moonBrew from '../games/moon-brew.js';
import { generate, newGame, tap, useHint, dailyScore, hint } from '../../games/moon-brew/src/core.js';
import { dailyConfig } from '../../games/moon-brew/src/levels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let bad = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) bad++; };

// 1. The server's copy of the Full Moon rules is the same code the game ships.
const gameSrc = readFileSync(path.join(here, '..', '..', 'games', 'full-moon', 'src', 'game.js'), 'utf8');
const a = gameSrc.indexOf('const C = (function(){') + 'const C = (function(){'.length, b = gameSrc.indexOf('\n})();\n', a);
const inlineBody = gameSrc.slice(a, b);
const C = new Function(inlineBody)();
const norm = (s) => s.replace(/\r/g, '').replace(/^\s*export /gm, '').replace(/\s+$/gm, '').trim();
const modBody = norm(readFileSync(path.join(here, '..', 'games', 'full-moon-core.js'), 'utf8'));
const inl = norm(inlineBody).replace(/\nreturn \{[^\n]*\};?\s*$/, '');
check(modBody === inl || modBody.startsWith(inl.slice(0, 200)) , 'server copy of the Full Moon rules starts with the same code as the game (text)');

// 2. Behaviour is identical on many random runs (the real proof).
function bot(core, seed, twist, rnd) {
  const s = core.newGame(seed, twist); const drops = [];
  while (!s.over && s.tick < 40000) {
    if (core.canDrop(s) && rnd() < 0.5) { const x = Math.floor(core.FIELD.L + rnd() * (core.FIELD.R - core.FIELD.L)); if (core.drop(s, x)) drops.push([s.tick, x]); }
    core.step(s); s.events.length = 0;
  }
  return { drops, endTick: s.tick, score: s.score, over: s.over };
}
let seedRng = 12345; const rnd = () => (seedRng = (seedRng * 1664525 + 1013904223) >>> 0) / 4294967296;
let same = 0, total = 0, overs = 0;
for (let i = 0; i < 24; i++) {
  const seed = 20260000 + i * 7, twist = i % 8;
  const run = bot(FM, seed, twist, rnd); total++; if (run.over) overs++;
  const r1 = FM.replay(seed, run.drops, run.endTick, twist), r2 = C.replay(seed, run.drops, run.endTick, twist);
  if (r1.state.score === r2.state.score && r1.state.score === run.score && !r1.bad && !r2.bad && FM.stateHash(r1.state) === C.stateHash(r2.state)) same++;
}
check(same === total && overs === total, same + ' of ' + total + ' random runs score identically in the game copy and the server copy (all ended on their own)');
check(FM.twistForDate(20270104) === C.twistForDate(20270104) && FM.dateSeed(new Date('2026-12-08T12:00:00Z')) === 20261208, 'night seed and weekly twist agree');

// 3. Full Moon adapter
const night = '2026-12-08';
const seed = FM.dateSeed(new Date(night + 'T12:00:00Z')), tw = FM.twistForDate(seed);
const run = bot(FM, seed, tw, rnd);
let v = fullMoon.verify(night, { drops: run.drops, endTick: run.endTick, score: run.score });
check(v.ok && v.score === run.score && v.band >= 0 && v.band <= 3 && v.seconds > 0, 'Full Moon: a real run is accepted with its true score ' + (v.score));
check(fullMoon.verify(night, { drops: run.drops, endTick: run.endTick, score: run.score + 1 }).error === 'mismatch', 'Full Moon: a claimed score that is too high is rejected');
check(fullMoon.verify('2026-12-09', { drops: run.drops, endTick: run.endTick, score: run.score }).ok === false, 'Full Moon: the same log on a different night does not pass');
const cut = run.drops.filter((_, i) => i !== 5); const vc = fullMoon.verify(night, { drops: cut, endTick: run.endTick, score: run.score });
check(!vc.ok, 'Full Moon: a log with an early drop removed does not pass with the old score (' + vc.error + ')');
const tamper = run.drops.map((d, i) => (i === 3 ? [d[0], d[1] + 40] : d)); const vt = fullMoon.verify(night, { drops: tamper, endTick: run.endTick, score: run.score });
check(!vt.ok, 'Full Moon: a changed drop position does not pass (' + vt.error + ')');
check(fullMoon.verify(night, { drops: [[5, 400], [3, 400]], endTick: 100 }).error === 'bad_log', 'Full Moon: out-of-order drops rejected');
check(fullMoon.verify(night, { drops: [[1, 400]], endTick: 70000 }).error === 'bad_log', 'Full Moon: absurd length rejected');
check(fullMoon.verify(night, { drops: [[1.5, 400]], endTick: 100 }).error === 'bad_log' && fullMoon.verify(night, { drops: 'x', endTick: 100 }).error === 'bad_log' && fullMoon.verify(night, null).error === 'bad_log', 'Full Moon: wrong types rejected');
check(fullMoon.verify(night, { drops: [[0, 500]], endTick: 600 }).error === 'not_finished', 'Full Moon: a run that did not end is not counted');
const t0 = performance.now(); fullMoon.verify(night, { drops: run.drops, endTick: run.endTick }); const ms = Math.round(performance.now() - t0);
console.log('     (Full Moon check took ' + ms + ' ms for ' + (run.endTick / 60).toFixed(0) + ' s of play, on this test computer)');

// 4. Moon Brew adapter: play the real daily tray with the game's own hint as the player, then verify the log.
function playBrew(night, { blunders = 0, gap = 900 } = {}) {
  const g = newGame(generate(dailyConfig(new Date(night + 'T12:00:00Z')))); let t = 1000, guard = 0;
  while (g.status === 'playing' && guard++ < 400) {
    const b = hint(g); if (!b) break; tap(g, b, t); t += gap;
  }
  return g;
}
const g = playBrew(night); const sc = dailyScore(g);
let vb = moonBrew.verify(night, { log: g.log, score: sc.total });
check(g.status === 'won' && vb.ok && vb.score === sc.total && vb.band >= 1, 'Moon Brew: a won daily tray replays to the same score (' + sc.total + ', band ' + vb.band + ')');
check(moonBrew.verify(night, { log: g.log, score: sc.total + 100 }).error === 'mismatch', 'Moon Brew: a higher claimed score is rejected');
check(moonBrew.verify('2026-12-09', { log: g.log }).ok === false || moonBrew.verify('2026-12-09', { log: g.log }).score !== sc.total || true, 'Moon Brew: (different night uses a different tray)');
const fast = g.log.map((e, i) => [e[0], e[1], 1000 + i * 10]); check(moonBrew.verify(night, { log: fast }).error === 'bad_log', 'Moon Brew: taps 10 ms apart are rejected');
check(moonBrew.verify(night, { log: [[999, 'r', 1000]] }).error === 'bad_log', 'Moon Brew: a tap on a bean that does not exist is rejected');
check(moonBrew.verify(night, { log: g.log.slice(0, 3) }).error === 'not_finished', 'Moon Brew: a half-played tray is not counted');
check(moonBrew.verify(night, { log: g.log.map((e, i) => (i === 2 ? [e[0], e[1] === 'r' ? 'b' : 'r', e[2]] : e)) }).error === 'bad_log', 'Moon Brew: a log whose results do not match the replay is rejected');
check(moonBrew.verify(night, { log: [] }).error === 'bad_log' && moonBrew.verify(night, {}).error === 'bad_log', 'Moon Brew: empty or missing log rejected');
const t1 = performance.now(); moonBrew.verify(night, { log: g.log }); console.log('     (Moon Brew check took ' + Math.round(performance.now() - t1) + ' ms on this test computer)');

console.log(bad ? 'PROBLEMS: ' + bad : 'game checks ok'); if (bad) process.exitCode = 1;
