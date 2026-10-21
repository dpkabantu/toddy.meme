// Real-browser check (run by hand): while only Season night 1 is open, Full Moon hides the later pieces, Practice uses 5 pieces,
// and the daily challenge is paused. Uses a pretend /api/season answer. Needs Playwright.
//   node --no-warnings server/test/fm-secret-browser.mjs
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/'); const { chromium } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); let p = path.join(root, decodeURIComponent(url.pathname)); if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port;
let bad = 0; const check = (ok, name) => { console.log((ok ? 'ok   ' : 'FAIL ') + name); if (!ok) bad++; };
const browser = await chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
const nights = Array.from({ length: 7 }, (_, i) => ({ night: i + 1, opensAt: '2027-03-15T13:00:00Z', open: i === 0 }));
await page.route('**/api/season', (r) => r.fulfill({ json: { ok: true, seasonWeek: 3, season: { status: 'live' }, games: [{ id: 'full-moon', dailyFromWeek: 4 }], missions: [{ id: 'full-moon-season', game: 'full-moon', kind: 'moonset', state: 'open', week: 3, nights, cases: [], stages: [] }] } }));
await page.route('https://fonts.g*apis.com/**', (r) => r.abort()); await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.goto(base + '/games/full-moon/'); await page.waitForSelector('.card .strip', { timeout: 30000 });
check((await page.locator('.strip .lock').count()) === 6 && (await page.locator('.strip img').count()) === 5, 'menu strip: 5 pieces shown, 6 secret');
const menu = await page.locator('.card').innerText();
check(/Opens in week 4/.test(menu) && (await page.locator('[data-act="daily"]').count()) === 0 && !/Weekly twists/.test(menu), 'daily is paused in week 3 (no play button) and the twists list is hidden');
await page.click('[data-act="pieces"]'); check(/secret/.test(await page.locator('.card').innerText()) && (await page.locator('.strip .lock').count()) === 6, 'Pieces screen keeps the rest secret');
await page.click('[data-act="back"], [data-act="menu"]').catch(() => {}); await page.waitForSelector('[data-act="free"]');
await page.click('[data-act="free"]'); await page.waitForFunction(() => window.__mm.mode === 'play');
check((await page.evaluate(() => window.__mm.S.tw.topLevel)) === 5 && (await page.locator('#prog img:visible').count()) === 5, 'Practice uses only the 5 unlocked pieces');
await browser.close(); server.close(); console.log(bad ? 'PROBLEMS: ' + bad : 'secret pieces ok'); if (bad) process.exitCode = 1;
