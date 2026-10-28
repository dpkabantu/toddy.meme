// Toddy Trail in a real browser, under the site's real CSP: page loads with no console errors, every screen opens and has a Back button,
// level 1 is won by tapping (stars, saved progress, unlocking), pause, settings, plain floors, Daily Run, boss and endless levels open,
// an idle level ends with the lanterns out and 0 stars, no network calls leave the site.
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
const { loadAll, buildLevel } = await import('../../games/toddy-trail/src/levels.js');
const ALL = await loadAll();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const problems = [], outside = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.(googleapis|gstatic)|ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) problems.push(m.text()); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('request', (r) => { if (!r.url().startsWith(base) && !/fonts\.(googleapis|gstatic)/.test(r.url())) outside.push(r.url()); });

const btn = (name) => page.getByRole('button', { name });
const shot = (n) => page.screenshot({ path: path.join(shots, 'trail-' + n + '.png') });
const home = async () => { await page.goto(base + '/games/toddy-trail/', { waitUntil: 'load' }); await page.waitForSelector('#overlay .btn'); };
const hidden = () => page.locator('#overlay').waitFor({ state: 'hidden', timeout: 20000 });
const cardText = () => page.locator('#overlay').innerText();
const geoOf = async (def) => page.evaluate((def) => { const r = document.getElementById('c').getBoundingClientRect(); const W = r.width, H = r.height, top = 64, pad = 8, cell = Math.floor(Math.min((W - pad * 2) / (def.w + 0.3), (H - top - pad * 2) / (def.h + 0.4))); return { left: r.left, top: r.top, cell, ox: Math.floor((W - cell * def.w) / 2), oy: top + Math.floor(0.4 * cell + (H - top - cell * (def.h + 0.4)) / 2) }; }, def);
const served = (k) => page.waitForFunction((k) => new RegExp('Served ' + k + ' /').test(document.getElementById('served').textContent), k, { timeout: 15000 });
// plays a level by tapping: for each cup in the line, tap the spot of the visitor who wants it, until they are served
async function playByTaps(def) {
  const g = await geoOf(def); let k = 0;
  for (const want of def.cups) {
    const v = def.visitors.find((x, i) => x.want === want && !x._done); if (!v) continue; v._done = true; k++;
    for (let tries = 0; tries < 12; tries++) {
      await page.touchscreen.tap(g.left + g.ox + (v.sx + 0.5) * g.cell, g.top + g.oy + (v.sy + 0.5) * g.cell);
      const ok = await served(k).then(() => true).catch(() => false); if (ok) break;
    }
  }
}

// ---- Home and every side page has its Back button ----
await page.addInitScript(() => { try { if (!sessionStorage.getItem('fresh')) { localStorage.clear(); sessionStorage.setItem('fresh', '1'); } } catch (_) {} });
await home(); await shot('home');
for (const name of ['Play', 'Nights & levels', 'Daily Run', 'How to play', 'Settings', 'About', 'Exit to Games']) assert.ok(await btn(new RegExp('^' + name)).first().isVisible(), 'home has ' + name);
for (const [name, title] of [['How to play', 'How to play'], ['About', 'About'], ['Settings', 'Settings'], ['Daily Run', 'Daily Run'], ['Nights & levels', 'Nights']]) {
  await btn(new RegExp('^' + name)).first().click(); assert.match(await cardText(), new RegExp(title)); await shot('page-' + title.toLowerCase().replace(/ /g, '-'));
  await btn(/^‹ /).first().click(); assert.match(await cardText(), /TODDY Trail/, 'Back from ' + name + ' goes Home');
}
// Nights: only Night 1 is open at the start; levels: level 1 open, level 2 locked
await btn(/^Nights & levels/).click();
assert.equal(await btn(/^Night 1 /).isDisabled(), false); assert.equal(await btn(/Night 2 /).isDisabled(), true);
await btn(/^Night 1 /).click(); await shot('levels');
assert.equal(await page.locator('.lv:not(.locked)').count(), 1);
await btn(/^‹ Nights/).click(); await btn(/^‹ Home/).click();

// ---- Settings change things ----
await btn(/^Settings/).click();
const spd = btn(/^Walking speed/); assert.equal(await spd.innerText(), 'Walking speed: Quick');
await spd.click(); assert.equal(await spd.innerText(), 'Walking speed: Relaxed'); await spd.click(); await spd.click(); assert.equal(await spd.innerText(), 'Walking speed: Quick');
await btn(/^Music/).click(); assert.equal(await btn(/^Music/).innerText(), 'Music: Off'); await btn(/^Music/).click();
await btn(/^Sound effects/).click(); assert.equal(await btn(/^Sound effects/).innerText(), 'Sound effects: Off'); await btn(/^Sound effects/).click();
await btn(/^Floors/).click(); assert.equal(await btn(/^Floors/).innerText(), 'Floors: Painted only'); await btn(/^Floors/).click(); assert.equal(await btn(/^Floors/).innerText(), 'Floors: Plain only');
await btn(/^‹ Back/).click();

// ---- Level 1: intro story, tap to win, stars saved ----
await btn(/^Play · Night 1 · Level 1/).click();
assert.match(await cardText(), /Night 1 · Opening Night/); await btn(/^Start/).click(); await hidden();
assert.match(await page.locator('#served').innerText(), /Served 0 \/ 3/); assert.match(await page.locator('#lvl').innerText(), /Night 1 · Level 1/);
await page.waitForTimeout(400); await shot('level1-plain');
const L1 = buildLevel(ALL, 1, { floorMode: 'plain' }).def;
await playByTaps(JSON.parse(JSON.stringify(L1)));
await page.getByText(/Perfect!|All served!|Level cleared/).waitFor({ timeout: 15000 }); await shot('result');
assert.match(await cardText(), /★/); assert.ok(await btn(/^Next level/).isVisible()); assert.ok(await btn(/^Retry/).isVisible()); assert.ok(await btn(/^‹ Night 1 levels/).isVisible());
const stars = (await page.locator('.bigstars').innerText()).split('★').length - 1; assert.ok(stars >= 1, 'at least one star');
// saved: reload, Home says Continue at level 2, level 2 unlocked, level 3 locked
await home(); assert.ok(await btn(/^Continue · Night 1 · Level 2/).isVisible());
await btn(/^Nights & levels/).click(); await btn(/^Night 1 /).click(); assert.equal(await page.locator('.lv:not(.locked)').count(), 2);
await btn(/^‹ Nights/).click(); await btn(/^‹ Home/).click();

// ---- Pause menu and its Back/Resume buttons ----
await btn(/^Continue/).click(); await hidden(); await page.waitForTimeout(300);
await page.locator('#btnPause').click(); assert.ok(await btn(/^Resume/).isVisible()); assert.ok(await btn(/^Restart level/).isVisible()); assert.ok(await btn(/^Leave to levels/).isVisible()); await shot('pause');
await btn(/^Settings/).click(); await btn(/^‹ Back/).click(); assert.ok(await btn(/^Resume/).isVisible(), 'Back from Settings returns to Pause');
await btn(/^Resume/).click(); await hidden();
await page.keyboard.press('Escape'); assert.ok(await btn(/^Resume/).isVisible()); await btn(/^Leave to levels/).click(); assert.match(await cardText(), /Night 1/);

// ---- Idle level ends with the lanterns out and 0 stars (level 2 gives 3 visitors and at least 25 s) ----
await btn(/^‹ Nights/).click(); await btn(/^‹ Home/).click();
await btn(/^Continue/).click(); await hidden();
{ const box = await page.locator('#c').boundingBox(); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.75); }   // the clock starts with the first tap
await page.getByText('Lanterns out').waitFor({ timeout: 90000 }); assert.match(await cardText(), /Serve at least/); await shot('result-fail');
await btn(/^Retry/).click(); await hidden();

// ---- Unlock everything (testing switch): boss level, the 7th night and the endless nights open ----
await page.evaluate(() => { const k = 'trailV2', p = JSON.parse(localStorage.getItem(k)); p.settings.unlockAll = true; localStorage.setItem(k, JSON.stringify(p)); });
await home(); await btn(/^Nights & levels/).click();
assert.equal(await btn(/^Night 7 /).isDisabled(), false); assert.equal(await btn(/^Endless Nights/).isDisabled(), false);
await btn(/^Night 4 /).click(); await page.locator('.lv.boss').click();
await hidden(); await page.waitForTimeout(500); assert.match(await page.locator('#lvl').innerText(), /Night 4 · Level 10 · Boss/); await shot('boss');
await page.locator('#btnPause').click(); await btn(/^Leave to levels/).click(); await btn(/^Night 5 ›/).click(); await btn(/^Night 6 ›/).click(); await btn(/^Night 7 ›/).click(); await btn(/^Night 8 ›/).click();
assert.match(await cardText(), /Endless Night 8/); await page.locator('.lv').first().click(); await page.getByRole('button', { name: /^Start/ }).click({ timeout: 2000 }).catch(() => {}); await hidden();
assert.match(await page.locator('#lvl').innerText(), /Night 8 · Level 1/); await page.waitForTimeout(500); await shot('endless-night8');

// ---- Daily Run: three levels and three goals ----
await home(); await btn(/^Daily Run/).click(); assert.equal(await page.locator('.goal').count(), 3); await shot('daily');
await btn(/^Level 1 of 3/).click(); await hidden(); assert.match(await page.locator('#lvl').innerText(), /Daily Run · 1 of 3/); await page.waitForTimeout(500); await shot('daily-level');
await page.locator('#btnPause').click(); await btn(/^Leave to Daily Run/).click(); assert.match(await cardText(), /Today's goals/);
await btn(/^‹ Home/).click();

// ---- Weather off still plays; a bunch of random levels open without errors ----
await btn(/^Settings/).click(); await btn(/^Weather/).click(); await btn(/^Weather/).click(); assert.equal(await btn(/^Weather/).innerText(), 'Weather: Off'); await btn(/^Weather/).click(); await btn(/^‹ Back/).click();
for (const L of [15, 33, 52, 66]) {
  await btn(/^Nights & levels/).click(); await btn(new RegExp('^Night ' + (Math.floor((L - 1) / 10) + 1) + ' ')).click();
  await page.locator('.lv').nth((L - 1) % 10).click(); await page.getByRole('button', { name: /^Start/ }).click({ timeout: 1500 }).catch(() => {}); await hidden();
  await page.waitForTimeout(600); await shot('level-' + L);
  await page.locator('#btnPause').click(); await btn(/^Home/).click();
}
// the Full screen button exists in the game bar
assert.equal(await page.locator('#btnFull').count(), 1);

assert.deepEqual(problems, [], 'console problems: ' + problems.join(' | '));
assert.deepEqual(outside, [], 'requests leaving the site: ' + outside.join(' | '));
await browser.close(); server.close();
console.log('trail browser: all checks passed (screenshots in ' + shots + ')');
