#!/usr/bin/env node
// Builds the Scam Lab case files from tools/scam-lab/layout.json (see author.mjs for the compact case format).
//   node tools/scam-lab/build.mjs          write case files, chapters.json and the server's case list
//   node tools/scam-lab/build.mjs --check  check every case with the game's own checker, plus the safety scan; write nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './author.mjs';
import { checkCase } from '../../games/scam-lab/src/engine.js';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', '..');
const casesDir = path.join(root, 'games', 'scam-lab', 'cases'), archive = path.join(here, 'archive');
const layout = JSON.parse(fs.readFileSync(path.join(here, 'layout.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');
const TODAY = '2026-10-21';
const pad = (n) => String(n).padStart(2, '0');
const sources = JSON.parse(fs.readFileSync(path.join(casesDir, 'sources.json'), 'utf8'));
const problems = [];
const written = {};

for (const ch of layout.chapters.filter((c) => c.built)) {
  const specs = (await import('./specs/ch' + ch.n + '.mjs')).default;
  const ids = [];
  ch.cases.forEach((ref, i) => {
    const id = `c${ch.n}-${pad(i + 1)}`; ids.push(id);
    const [kind, key] = ref.split(':');
    let c;
    if (kind === 'old') {
      c = JSON.parse(fs.readFileSync(path.join(archive, key + '.json'), 'utf8')); c.id = id; c.chapter = ch.n;
    } else {
      const s = specs[key]; if (!s) { problems.push(`${id}: no spec "${key}"`); return; }
      c = build({ ...s, id, chapter: ch.n, checked_on: s.checked_on || TODAY });
    }
    for (const p of checkCase(c)) problems.push(`${id}: ${p}`);
    for (const s of c.sources || []) if (!sources[s]) problems.push(`${id}: unknown source ${s}`);
    written[id] = c;
  });
  ch._ids = ids;
}

// Safety scan (owner rule: no real names). The list is checked against every word of every case.
const BANNED = JSON.parse(fs.readFileSync(path.join(here, 'banned-names.json'), 'utf8')).names;
for (const [id, c] of Object.entries(written)) {
  const { sources: _s, checked_on: _c, ...body } = c; const text = JSON.stringify(body).toLowerCase();
  for (const n of BANNED) if (new RegExp('(^|[^a-z0-9])' + n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(text)) problems.push(`${id}: contains the real name "${n}"`);
}

if (problems.length) { console.error('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log(`${Object.keys(written).length} cases built and checked`);
if (checkOnly) process.exit(0);

for (const [id, c] of Object.entries(written)) fs.writeFileSync(path.join(casesDir, id + '.json'), JSON.stringify(c, null, 2) + '\n');
const chPath = path.join(casesDir, 'chapters.json'), chj = JSON.parse(fs.readFileSync(chPath, 'utf8'));
for (const ch of layout.chapters.filter((c) => c.built)) {
  const entry = { n: ch.n, title: ch.title, blurb: ch.blurb, card: ch.card, cases: ch._ids, status: 'open', learn: ch.learn };
  const i = chj.chapters.findIndex((x) => x.n === ch.n);
  if (i >= 0) chj.chapters[i] = entry; else chj.chapters.push(entry);
}
fs.writeFileSync(chPath, JSON.stringify(chj, null, 2) + '\n');

// the server's list of case files
const files = fs.readdirSync(casesDir).filter((f) => /^c\d-\d\d\.json$/.test(f)).sort();
const v = (f) => f.replace('.json', '').replace('-', '_');
let js = "// Scam Lab case files for the server checks. Generated list (tools/scam-lab/build.mjs): every case in games/scam-lab/cases is imported here, so the server\n// scores exactly what the game shows. A test fails if a case file is missing from this list (server/test/games.mjs).\n";
js += "import chapters from '../../games/scam-lab/cases/chapters.json' with { type: 'json' };\n";
for (const f of files) js += `import ${v(f)} from '../../games/scam-lab/cases/${f}' with { type: 'json' };\n`;
js += 'export const CHAPTERS = chapters.chapters;\nexport const CASES = { ' + files.map((f) => `'${f.replace('.json', '')}': ${v(f)}`).join(', ') + ' };\n';
fs.writeFileSync(path.join(root, 'server', 'games', 'scam-lab-cases.js'), js);
console.log('written: ' + files.length + ' case files in the server list');
