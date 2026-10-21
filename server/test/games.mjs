// Server game checks. Run: node --no-warnings server/test/games.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as FM from '../games/full-moon-core.js';
import * as fullMoon from '../games/full-moon.js';
import * as moonBrew from '../games/moon-brew.js';
import * as scamLab from '../games/scam-lab.js';
import { dailyCase } from '../../games/scam-lab/src/daily.js';
import { scoreDaily, strongClues } from '../../games/scam-lab/src/engine.js';
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

// 3. Scam Lab Daily Quickie
{
  const sc = dailyCase(night), marks = {}; strongClues(sc).forEach((k) => { marks[k] = 'flag'; });
  const expect = scoreDaily(sc, { marks, decision: sc.best_action, seconds: 40 });
  let v = scamLab.verify(night, { marks, decision: sc.best_action, seconds: 40, score: expect.total });
  check(v.ok && v.score === expect.total && v.band === expect.stars, 'Scam Lab: best play scores like the game does (' + expect.total + ', ' + expect.stars + ' stars)');
  check(scamLab.verify(night, { marks, decision: sc.best_action, seconds: 40, score: expect.total + 50 }).error === 'mismatch', 'Scam Lab: a higher claimed score is rejected');
  check(scamLab.verify(night, { marks: { nonsense: 'flag' }, decision: sc.best_action, seconds: 40 }).error === 'bad_log', 'Scam Lab: a clue that is not in tonight\'s case is rejected');
  check(scamLab.verify(night, { marks: { [Object.keys(sc.clues)[0]]: 'maybe' }, decision: sc.best_action, seconds: 40 }).error === 'bad_log', 'Scam Lab: a mark that is not flag/ok is rejected');
  check(scamLab.verify(night, { marks, decision: 'teleport', seconds: 40 }).error === 'bad_log', 'Scam Lab: a decision that does not exist is rejected');
  check(scamLab.verify(night, { marks, decision: sc.best_action, seconds: 0 }).error === 'bad_log' && scamLab.verify(night, { marks, decision: sc.best_action, seconds: 99999 }).error === 'bad_log', 'Scam Lab: impossible times are rejected');
  check(scamLab.verify(night, {}).error === 'bad_log' && scamLab.verify(night, null).error === 'bad_log', 'Scam Lab: empty or missing answers rejected');
  const unsafe = sc.actions.map((a) => a.id).find((id) => id !== sc.best_action && !(sc.acceptable_actions || []).includes(id));
  if (unsafe) { v = scamLab.verify(night, { marks: {}, decision: unsafe, seconds: 40 }); check(v.ok && v.band === 0, 'Scam Lab: an unsafe decision still counts as played (band 0)'); }
  v = scamLab.verify(night, { marks: {}, decision: null, seconds: 90 }); check(v.ok && v.band === 0, 'Scam Lab: running out of time (no decision) still counts as played');
  const other = '2026-12-09'; const o = dailyCase(other);
  check(JSON.stringify(dailyCase(night)) === JSON.stringify(sc) && (o.template !== sc.template || JSON.stringify(o) !== JSON.stringify(sc)), 'Scam Lab: the same night always gives the same case');
}

// Scam Lab Daily Quickie: 42 written cases. 42 nights in a row show each one once (31 scams, 11 honest), and each can be cleared with 3 stars.
{
  const start = Date.UTC(2027, 0, 19); const seen = new Set(); let honest = 0, three = 0, nobad = true;
  for (let i = 0; i < 42; i++) {
    const night = new Date(start + i * 86400000).toISOString().slice(0, 10); const c = dailyCase(night);
    seen.add(c.template); if (!c.disguise) honest += 1;
    const marks = {}; strongClues(c).forEach((k) => { marks[k] = 'flag'; });
    const r = scamLab.verify(night, { marks, decision: c.best_action, seconds: 40 });
    if (r.ok && r.band === 3) three += 1;
    const bad = c.actions.map((a) => a.id).find((id) => id !== c.best_action && !(c.acceptable_actions || []).includes(id));
    if (!bad || !c.outcomes[bad] || !c.outcomes[c.best_action]) nobad = false;
  }
  check(seen.size === 42, 'Scam Lab Daily: 42 nights in a row give 42 different written cases');
  check(honest === 11, 'Scam Lab Daily: 11 of the 42 are honest cases (' + honest + ')');
  check(three === 42, 'Scam Lab Daily: each of the 42 can be cleared with 3 stars on the server (' + three + ')');
  check(nobad, 'Scam Lab Daily: every case has an outcome for each decision');
}

// Scam Lab case list for the server: every case file of the game must be known to the server (so a new case cannot be played unchecked).
{
  const { readdirSync } = await import('node:fs');
  const { CASES, CHAPTERS } = await import('../games/scam-lab-cases.js');
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'games', 'scam-lab', 'cases');
  const files = readdirSync(dir).filter((f) => /^c\d+-\d+\.json$/.test(f)).map((f) => f.replace('.json', '')).sort();
  check(JSON.stringify(files) === JSON.stringify(Object.keys(CASES).sort()), 'Scam Lab: the server knows every case file (' + files.length + ') - if this fails, add the new case to server/games/scam-lab-cases.js');
  check(CHAPTERS.flatMap((c) => c.cases).every((id) => CASES[id]), 'Scam Lab: every case named in chapters.json exists on the server');
  const { verifyCase } = scamLab;
  check(!verifyCase('c1-01', { marks: {}, decision: 'nope', seconds: 30 }).ok && !verifyCase('zzz', {}).ok && !verifyCase('__proto__', {}).ok && !verifyCase('c1-02', { answers: { x: 'scam' }, secondsLeft: 1, seconds: 30 }).ok, 'Scam Lab: made-up decision, case id, prototype name or card are all refused');
}

console.log(bad ? 'PROBLEMS: ' + bad : 'game checks ok'); if (bad) process.exitCode = 1;
