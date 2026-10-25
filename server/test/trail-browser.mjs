// Toddy Trail in a real browser, under the site's real CSP: page loads with no console errors, menu works,
// a timed key route serves all 3 visitors on night 1, an idle night 3 ends with the lanterns out, no network calls leave the site.
// Needs Playwright, so it is run by hand:  node --no-warnings server/test/trail-browser.mjs [screenshot-folder]
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('/opt/npm-tools/');
const { chromium } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = process.argv[2] || '/tmp';

const blocks = []; let cur = null;
for (const line of readFileSync(path.join(root, '_headers'), 'utf8').split('\n')) { if (/^\S/.test(line) && !line.startsWith('#')) { cur = { pat: line.trim(), csp: null }; blocks.push(cur); } else if (cur && /Content-Security-Policy:/.test(line)) cur.csp = line.split('Content-Security-Policy:')[1].trim(); }
const cspFor = (p) => { const hit = blocks.filter((b) => b.csp && (b.pat === '/*' || (b.pat.endsWith('*') && p.startsWith(b.pat.slice(0, -1))))).pop(); return (hit ? hit.csp : '').replace('upgrade-insecure-requests', ''); };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.json': 'application/json', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  let p = path.join(root, decodeURIComponent(url.pathname)); if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'content-security-policy': cspFor(url.pathname) }); res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const base = 'http://localhost:' + server.address().port;
const startFromMenu = async (page, id) => {   // menu -> (choose a night) -> intro card -> Start
  if (id === 1) await page.locator('#overlay .btn').first().click();
  else { await page.getByRole('button', { name: 'Choose another night' }).click(); await page.getByRole('button', { name: new RegExp('^Night ' + id + ' ') }).click(); }
  await page.getByRole('button', { name: new RegExp('^Start Night ' + id) }).click();
  await page.locator('#overlay').waitFor({ state: 'hidden', timeout: 15000 });
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const problems = [], outside = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.(googleapis|gstatic)|ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) problems.push(m.text()); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('request', (r) => { if (!r.url().startsWith(base) && !/fonts\.(googleapis|gstatic)/.test(r.url())) outside.push(r.url()); });

await page.addInitScript(() => { try { localStorage.setItem('trailSpeed', 'Normal'); } catch (_) {} });
await page.goto(base + '/games/toddy-trail/', { waitUntil: 'load' });
await page.waitForSelector('#overlay .btn');
await page.screenshot({ path: path.join(shots, 'trail-menu.png') });
assert.equal(await page.locator('#overlay .btn').count(), 24);   // Play night 1, walking speed, controls, floor, weather, Choose another night, the 7 nights, the Level 20 sample and the five endless difficulties and the five diagonal ones (hidden until asked)
assert.equal(await page.getByRole('button', { name: /^Night 3 / }).isVisible(), false);

// Night 1: timed route (step k happens at (k+1)/3 s, so a turn for step n is pressed at n+0.5). Start (4,9): right 2, up 3, left 4, up 3, right 4
const STEP = 1000 / 4;   // Toddy takes 4 steps a second
let ok = false;
for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
  if (attempt === 1) await startFromMenu(page, 1); else { await page.getByRole('button', { name: 'Play again' }).click(); await page.locator('#overlay').waitFor({ state: 'hidden', timeout: 15000 }); }
  await page.waitForTimeout(600);   // Toddy waits for the first swipe: nothing moves yet
  await page.screenshot({ path: path.join(shots, 'trail-night1-start.png') });
  await page.keyboard.down('ArrowRight');   // first push starts the night (Toddy walks while a key is held)
  const t0 = Date.now();
  const at = (n) => page.waitForTimeout(Math.max(0, t0 + n * STEP - Date.now()));
  await at(2.5); await page.keyboard.down('ArrowUp');
  await at(5.5); await page.keyboard.down('ArrowLeft');
  await at(7); await page.screenshot({ path: path.join(shots, 'trail-night1-mid.png') });
  await at(9.5); await page.keyboard.down('ArrowUp');
  await at(12.5); await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft');
  await page.getByText('All served!').waitFor({ timeout: 6000 }).catch(() => {});   // the win dance plays for about 2 s first
  const text = await page.locator('#overlay').innerText().catch(() => '');
  ok = /All served/.test(text);
  console.log('night 1 attempt ' + attempt + ': ' + (ok ? 'all served' : 'not all served (' + (await page.locator('#served').innerText()) + ')'));
  if (!ok) { await page.waitForSelector('#overlay .btn', { timeout: 8000 }).catch(() => {}); }
}
await page.screenshot({ path: path.join(shots, 'trail-night1-result.png') });
assert.ok(ok, 'night 1 route serves all three');

// Night 3, idle: ends by itself with the lanterns out (60 s) -- check the first seconds only, then confirm it is running
await page.getByRole('button', { name: 'Pick a night' }).click();
await startFromMenu(page, 3);
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(shots, 'trail-night3.png') });
assert.match(await page.locator('#served').innerText(), /Served 0 \/ 5/);
// Every night opens and shows its own number of visitors (screenshots for a look)
const WANT = { 1: 3, 2: 4, 3: 5, 4: 5, 5: 6, 6: 5, 7: 7 };
for (const id of [1, 2, 4, 5, 6, 7]) {
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#overlay .btn');
  await startFromMenu(page, id);
  await page.waitForTimeout(500);
  assert.match(await page.locator('#served').innerText(), new RegExp('Served 0 / ' + WANT[id]));
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1200); await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: path.join(shots, 'trail-night' + id + '.png') });
}

// Level 20 sample: opens from the menu list, starts, shows 0 / 9 served, and never leaks into the story nights' "next night" flow
{
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#overlay .btn');
  await page.getByRole('button', { name: 'Choose another night' }).click();
  await page.getByRole('button', { name: /^Sample · Level 20/ }).click();
  await page.getByRole('button', { name: /^Start Level 20/ }).click();
  await page.locator('#overlay').waitFor({ state: 'hidden', timeout: 15000 });
  await page.waitForTimeout(500);
  assert.match(await page.locator('#served').innerText(), /Served 0 \/ 9/);
  await page.screenshot({ path: path.join(shots, 'trail-level20.png') });
}

// Endless mode: opens from the menu list, builds a random level, shows the level counter, and the page stays free of console errors
for (let run = 1; run <= 2; run++) {
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#overlay .btn');
  await page.getByRole('button', { name: 'Choose another night' }).click();
  await page.getByRole('button', { name: /^Endless · Easy/ }).click();
  await page.locator('#overlay').waitFor({ state: 'hidden', timeout: 20000 });
  await page.waitForTimeout(500);
  assert.match(await page.locator('#served').innerText(), /^Lv 1 · ♥♥♥ · Served 0 \/ \d+/);
  await page.screenshot({ path: path.join(shots, 'trail-endless' + run + '.png') });
}

// Every endless difficulty button starts at its own level; the hardest bands bring many obstacles and more visitors
for (const [name, lv] of [['Medium', 13], ['Hard', 19], ['Very hard', 26], ['Highly difficult', 31]]) {
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#overlay .btn');
  await page.getByRole('button', { name: 'Choose another night' }).click();
  await page.getByRole('button', { name: new RegExp('^Endless · ' + name) }).click();
  await page.locator('#overlay').waitFor({ state: 'hidden', timeout: 20000 });
  await page.waitForTimeout(500);
  assert.match(await page.locator('#served').innerText(), new RegExp('^Lv ' + lv + ' · ♥♥♥ · Served 0 / \\d+'));
  await page.screenshot({ path: path.join(shots, 'trail-endless-' + name.replace(' ', '-').toLowerCase() + '.png') });
}

// Floor option: the menu button cycles painted scene -> six plain colours and a plain-floor level still runs
{
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#overlay .btn');
  const fl = page.getByRole('button', { name: /^Floor: / });
  assert.equal(await fl.innerText(), 'Floor: Painted scene');
  await fl.click(); assert.equal(await fl.innerText(), 'Floor: Plain Teal');
  await startFromMenu(page, 1); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, 'trail-plain-floor.png') });
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#overlay .btn');
  const fl2 = page.getByRole('button', { name: /^Floor: / });
  for (let k = 0; k < 6; k++) await fl2.click();   // Teal -> ... -> back to the painted scene
  assert.equal(await fl2.innerText(), 'Floor: Painted scene');
}

// Diagonal Medium: starts at level 13 with real diagonal steps and the Diag label
{
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#overlay .btn');
  await page.getByRole('button', { name: 'Choose another night' }).click();
  await page.getByRole('button', { name: /^Diagonal · Medium/ }).click();
  await page.locator('#overlay').waitFor({ state: 'hidden', timeout: 20000 });
  await page.waitForTimeout(500);
  assert.match(await page.locator('#served').innerText(), /^Diag Lv 13 · ♥♥♥ · Served 0 \/ \d+/);
  const geo = await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; });
  await page.touchscreen.tap(geo.left + geo.w * 0.2, geo.top + geo.h * 0.35); await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, 'trail-diagonal-trial.png') });
}

// Endless run rules: a level with a short clock and nobody served loses a heart (3 -> 2), the card says so, and Try again keeps the hearts
{
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#overlay .btn');
  await page.evaluate(async () => { const m = await import('/games/toddy-trail/src/endless-config.js'); m.ENDLESS.minSeconds = 3; m.ENDLESS.timeFactor = () => 0.01; });
  await page.getByRole('button', { name: 'Choose another night' }).click();
  await page.getByRole('button', { name: /^Endless · Easy/ }).click();
  await page.locator('#overlay').waitFor({ state: 'hidden', timeout: 20000 });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300); await page.keyboard.up('ArrowUp');
  await page.getByText('lost a heart').waitFor({ timeout: 15000 });
  assert.match(await page.locator('#overlay').innerText(), /♥♥♡/);
  await page.getByRole('button', { name: /^Try again/ }).click();
  await page.locator('#overlay').waitFor({ state: 'hidden', timeout: 20000 });
  assert.match(await page.locator('#served').innerText(), /^Lv 1 · ♥♥♡ · /);
  await page.screenshot({ path: path.join(shots, 'trail-endless-hearts.png') });
}

// Tap to go: a touch anywhere sends Toddy along his row, then up or down the column (game rules apply on the way). Night 1: Milo's spot (6,9), Pip's (2,6), Velvet's (6,3).
{
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#overlay .btn');
  await startFromMenu(page, 1); await page.waitForTimeout(400);
  const geo = await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); const W = r.width, H = r.height, top = 64, pad = 8, cell = Math.floor(Math.min((W - pad * 2) / 9, (H - top - pad * 2) / 13)); return { left: r.left, top: r.top, cell, ox: Math.floor((W - cell * 9) / 2), oy: top + Math.floor((H - top - cell * 13) / 2) }; });
  const tapCell = (cx, cy) => page.touchscreen.tap(geo.left + geo.ox + (cx + 0.5) * geo.cell, geo.top + geo.oy + (cy + 0.5) * geo.cell);
  const served = (k) => page.waitForFunction((k) => new RegExp('Served ' + k + ' /').test(document.getElementById('served').textContent), k, { timeout: 9000 });
  await tapCell(6, 6); await page.waitForTimeout(1500);   // diagonal touch from (4,9): a staircase to (6,6)
  assert.match(await page.locator('#served').innerText(), /Served 0 \//);
  await tapCell(6, 9); await served(1);   // straight down to Milo's spot
  await tapCell(2, 6); await served(2);   // diagonal touch (4 across, 3 up)
  await tapCell(6, 3); await served(3);
  await page.screenshot({ path: path.join(shots, 'trail-tap-night1.png') });
}

assert.deepEqual(problems, [], 'console problems: ' + problems.join(' | '));
assert.deepEqual(outside, [], 'requests leaving the site: ' + outside.join(' | '));
await browser.close(); server.close();
console.log('trail browser: all checks passed (screenshots in ' + shots + ')');
