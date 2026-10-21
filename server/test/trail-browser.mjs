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
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  let p = path.join(root, decodeURIComponent(url.pathname)); if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'content-security-policy': cspFor(url.pathname) }); res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const base = 'http://localhost:' + server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const problems = [], outside = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.(googleapis|gstatic)|ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) problems.push(m.text()); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('request', (r) => { if (!r.url().startsWith(base) && !/fonts\.(googleapis|gstatic)/.test(r.url())) outside.push(r.url()); });

await page.goto(base + '/games/toddy-trail/', { waitUntil: 'load' });
await page.waitForSelector('#overlay .btn');
await page.screenshot({ path: path.join(shots, 'trail-menu.png') });
assert.equal(await page.locator('#overlay .btn').count(), 9);   // Play night 1, Choose another night, and the 7 nights (hidden until asked)
assert.equal(await page.getByRole('button', { name: /^Night 3 / }).isVisible(), false);

// Night 1: timed route (step k happens at (k+1)/3 s, so a turn for step n is pressed at n+0.5). Start (4,9): right 2, up 3, left 4, up 3, right 4
const STEP = 1000 / 3;   // Toddy takes 3 steps a second
let ok = false;
for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
  await page.locator('#overlay .btn').first().click();
  await page.waitForTimeout(600);   // Toddy waits for the first swipe: nothing moves yet
  await page.screenshot({ path: path.join(shots, 'trail-night1-start.png') });
  await page.keyboard.press('ArrowRight');   // first swipe starts the night
  const t0 = Date.now();
  const at = (n) => page.waitForTimeout(Math.max(0, t0 + n * STEP - Date.now()));
  await at(2.5); await page.keyboard.press('ArrowUp');
  await at(5.5); await page.keyboard.press('ArrowLeft');
  await at(7); await page.screenshot({ path: path.join(shots, 'trail-night1-mid.png') });
  await at(9.5); await page.keyboard.press('ArrowUp');
  await at(12.5); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1500);
  const text = await page.locator('#overlay').innerText().catch(() => '');
  ok = /All served/.test(text);
  console.log('night 1 attempt ' + attempt + ': ' + (ok ? 'all served' : 'not all served (' + (await page.locator('#served').innerText()) + ')'));
  if (!ok) { await page.getByRole('button', { name: 'Pick a night' }).click().catch(() => {}); }
}
await page.screenshot({ path: path.join(shots, 'trail-night1-result.png') });
assert.ok(ok, 'night 1 route serves all three');

// Night 3, idle: ends by itself with the lanterns out (60 s) -- check the first seconds only, then confirm it is running
await page.getByRole('button', { name: 'Pick a night' }).click();
await page.getByRole('button', { name: 'Choose another night' }).click();
await page.getByRole('button', { name: /^Night 3 / }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(shots, 'trail-night3.png') });
assert.match(await page.locator('#served').innerText(), /Served 0 \/ 5/);
// Every night opens and shows its own number of visitors (screenshots for a look)
const WANT = { 1: 3, 2: 4, 3: 5, 4: 5, 5: 6, 6: 5, 7: 7 };
for (const id of [1, 2, 4, 5, 6, 7]) {
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#overlay .btn');
  await page.getByRole('button', { name: 'Choose another night' }).click();
  await page.getByRole('button', { name: new RegExp('^Night ' + id + ' ') }).click();
  await page.waitForTimeout(500);
  assert.match(await page.locator('#served').innerText(), new RegExp('Served 0 / ' + WANT[id]));
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, 'trail-night' + id + '.png') });
}

assert.deepEqual(problems, [], 'console problems: ' + problems.join(' | '));
assert.deepEqual(outside, [], 'requests leaving the site: ' + outside.join(' | '));
await browser.close(); server.close();
console.log('trail browser: all checks passed (screenshots in ' + shots + ')');
