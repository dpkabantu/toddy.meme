#!/usr/bin/env node
// Sets the Bronze / Silver / Gold scores of the 7 Full Moon Season nights and writes them into server/games/full-moon-core.js.
//   node tools/fm-season-tune.mjs          measure and write       node tools/fm-season-tune.mjs --show   measure only
// Rule: Bronze is about what careless random dropping gives; Silver must be above almost all random runs and about three quarters of the
// look-ahead bot; Gold is above random and about the bot's own score. The bot is not a person: re-run after real playtests.
import fs from 'node:fs';
import * as C from '../server/games/full-moon-core.js';
const clone = (s) => ({ ...s, bodies: s.bodies.map((b) => ({ ...b })), events: [], ticket: s.ticket ? { ...s.ticket } : null });

const corePath = new URL('..', import.meta.url).pathname + 'server/games/full-moon-core.js';
let sr = 424242; const rnd = () => (sr = (sr * 1664525 + 1013904223) >>> 0) / 4294967296;
const r10 = (x) => Math.round(x / 10) * 10;
function randomRuns(L, k) {
  const out = [];
  for (let i = 0; i < k; i++) { const s = C.newGame(L.seed, L.tw); while (!s.over && s.tick < 60000) { if (C.canDrop(s)) C.drop(s, C.FIELD.L + rnd() * (C.FIELD.R - C.FIELD.L)); C.step(s); s.events.length = 0; } out.push(s.score); }
  return out.sort((a, b) => a - b);
}
function botRun(L) {
  const s = C.newGame(L.seed, L.tw);
  while (!s.over && s.tick < 59000) {
    if (C.canDrop(s)) {
      const lv = C.heldLevel(s), cands = new Set();
      for (const b of s.bodies) if (b.level === lv) cands.add(Math.round(b.x));
      for (let i = 0; i <= 8; i++) cands.add(Math.round(C.FIELD.L + (C.FIELD.R - C.FIELD.L) * (i / 8)));
      let best = 0, bv = -1e18;
      for (const x0 of cands) {
        const x = Math.round(C.clampX(lv, x0)), c = clone(s); C.drop(c, x);
        for (let i = 0; i < 34 && !c.over; i++) { C.step(c); c.events.length = 0; }
        let minTop = 1e9; for (const b of c.bodies) if (b.y - b.r < minTop) minTop = b.y - b.r;
        const v = c.score + c.merges * 2 - Math.max(0, L.tw.closeY + 90 - minTop) * 2.2 - (c.over ? 1e6 : 0);
        if (v > bv) { bv = v; best = x; }
      }
      C.drop(s, best); s.events.length = 0;
    }
    C.step(s); s.events.length = 0;
  }
  return s;
}
const rows = [], rep = [];
for (let n = 1; n <= C.SEASON.nights; n++) {
  const L = C.seasonNight(n), r = randomRuns(L, 80), q = (p) => r[Math.min(r.length - 1, Math.floor(p * r.length))], bot = botRun(L);
  const p50 = q(0.5), p90 = q(0.9);
  const hard = bot.over && bot.drops < L.tw.dropCap, ks = hard ? 0.6 : 0.75, kg = hard ? 0.8 : 0.95;   // where even the bot fills the crate, the targets are kept a little lower
  const bronze = r10(Math.max(p50 * 0.95, bot.score * 0.3)), silver = r10(Math.max(p90 * 1.02, bot.score * ks, bronze + 50)), gold = r10(Math.max(p90 * 1.1, bot.score * kg, silver + 50));
  rows.push([bronze, silver, gold]);
  rep.push(`Night ${n} (${L.tw.topLevel} pieces, ${L.tw.dropCap} drops): random p10 ${q(0.1)} p50 ${p50} p90 ${p90} max ${r[r.length - 1]} | bot ${bot.score} (${bot.drops} drops, crate ${bot.over && bot.drops < L.tw.dropCap ? 'filled' : 'ok'}) -> Bronze ${bronze} Silver ${silver} Gold ${gold}`);
}
console.log(rep.join('\n'));
if (process.argv.includes('--show')) process.exit(0);
let src = fs.readFileSync(corePath, 'utf8');
src = src.replace(/\/\/ SEASON_BANDS:START[\s\S]*?\/\/ SEASON_BANDS:END/, '// SEASON_BANDS:START (written by tools/fm-season-tune.mjs: Bronze, Silver, Gold score for each night)\nconst SEASON_BANDS = [' + rows.map((x) => '[' + x.join(', ') + ']').join(', ') + '];\n// SEASON_BANDS:END');
fs.writeFileSync(corePath, src);
console.log('bands written');
