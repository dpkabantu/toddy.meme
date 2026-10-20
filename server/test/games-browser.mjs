// Real-browser test: signed-in play of Full Moon and Moon Brew sends the daily run to the real Worker code (fake Google, SQLite instead of D1),
// points appear in the Passport dashboard, guests send nothing. Needs Playwright, so it is run by hand:
//   node --no-warnings server/test/games-browser.mjs [screenshot-folder]        (takes about 2 minutes: the games run in real time)
import http from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../index.js';
import { fakeD1 } from './fake-d1.mjs';
const require = createRequire('/opt/npm-tools/');
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..', '..');
const shots = process.argv[2] || '/tmp';

const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON');
for (const f of readdirSync(path.join(root, 'server', 'migrations')).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(path.join(root, 'server', 'migrations', f), 'utf8'));
const env = { DB: fakeD1(db), GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sek', ID_SALT: 'salt' };
let nonce = '';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const deps = { fetch: async () => new Response(JSON.stringify({ id_token: b64({ a: 1 }) + '.' + b64({ iss: 'https://accounts.google.com', aud: 'cid', sub: 'g-77', email: 'play@example.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600, nonce }) + '.s' }), { status: 200 }) };

// the site's real CSP per path, from _headers
const blocks = []; let cur = null;
for (const line of readFileSync(path.join(root, '_headers'), 'utf8').split('\n')) { if (/^\S/.test(line) && !line.startsWith('#')) { cur = { pat: line.trim(), csp: null }; blocks.push(cur); } else if (cur && /Content-Security-Policy:/.test(line)) cur.csp = line.split('Content-Security-Policy:')[1].trim(); }
const cspFor = (p) => { const hit = blocks.filter((b) => b.csp && (b.pat === '/*' || (b.pat.endsWith('*') && p.startsWith(b.pat.slice(0, -1))))).pop(); return (hit ? hit.csp : '').replace('upgrade-insecure-requests', ''); };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const apiCalls = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  if (url.pathname.startsWith('/api/')) {
    apiCalls.push(req.method + ' ' + url.pathname + (req.headers.cookie ? ' (signed in)' : ' (no cookie)'));
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks), redirect: 'manual' }), env, deps);
    const h = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; }); h['set-cookie'] = r.headers.getSetCookie();
    res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let p = path.join(root, decodeURIComponent(url.pathname)); if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Content-Security-Policy': cspFor(url.pathname) }); res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = 'http://localhost:' + server.address().port;

let bad = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) bad++; };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
const viol = [], errs = [];
const watch = (page) => { page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text()); }); page.on('pageerror', (e) => errs.push(e.message)); };
await ctx.route(/\/api\/auth\/google\/start/, async (route) => {
  const resp = await route.fetch({ maxRedirects: 0 }); const g = new URL(resp.headers()['location']); nonce = g.searchParams.get('nonce');
  await route.fulfill({ response: resp, status: 302, headers: { ...resp.headers(), location: g.searchParams.get('redirect_uri') + '?code=abc&state=' + g.searchParams.get('state') } });
});
for (const c of [ctx]) { await c.route('https://fonts.g*apis.com/**', (r) => r.abort()); await c.route('https://fonts.gstatic.com/**', (r) => r.abort()); }

// sign in and make a Passport
const page = await ctx.newPage(); watch(page);
await page.goto(base + '/passport/'); await page.waitForSelector('#s-out:not([hidden])'); await page.click('#signin'); await page.waitForSelector('#s-join:not([hidden])');
await page.fill('#j-name', 'Night_Owl'); await page.check('#j-adult'); await page.check('#j-terms'); await page.click('#j-go'); await page.waitForSelector('#s-in:not([hidden])');
await page.waitForSelector('#dash:not([hidden])');
check(/0/.test(await page.locator('#dash .big b').innerText()) && await page.locator('#dash .game').count() === 3, 'dashboard, brand new Passport: 0 points and three game cards');
check(/Nothing yet/.test(await page.locator('#dash').innerText()), 'dashboard: friendly empty state');
await page.screenshot({ path: shots + '/dash_empty.png', fullPage: true });
const pid = await page.locator('#p-id').innerText();

// ---- Full Moon, signed in ----
const fm = await ctx.newPage(); watch(fm);
await fm.goto(base + '/games/full-moon/'); await fm.waitForFunction(() => window.__mm && window.__mm.mode === 'menu', null, { timeout: 30000 });
await fm.evaluate(() => window.__mm.startRun('daily'));
check(await fm.evaluate(() => /Tonight/.test(document.getElementById('mode') ? document.getElementById('mode').textContent : 'Tonight')), 'Full Moon: tonight\'s night started');
const t0 = Date.now();
await fm.evaluate(() => { window.__drop = setInterval(() => { if (window.__mm.mode === 'play') window.__mm.dropAt(560); }, 60); });
await fm.waitForFunction(() => window.__mm.mode !== 'play' && window.__mm.lastRun, null, { timeout: 170000, polling: 500 });
console.log('     (Full Moon night lasted ' + Math.round((Date.now() - t0) / 1000) + ' s of real time)');
await fm.evaluate(() => clearInterval(window.__drop));
await fm.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 15000 });
const fmLine = await fm.locator('#seasonline').innerText(); const fmScore = await fm.evaluate(() => window.__mm.lastRun.score);
check(/^Season points: \+\d+/.test(fmLine), 'Full Moon: result screen says "' + fmLine.slice(0, 90) + '"');
const row1 = db.prepare("SELECT r.score, m.band, m.counted, m.points FROM game_runs r JOIN run_meta m ON m.run_id = r.id WHERE r.game_id = 'full-moon' AND r.status = 'accepted'").get();
check(row1 && row1.score === fmScore && row1.counted === 1, 'Full Moon: the server replayed the run and stored the very same score (' + fmScore + ')');
check(await fm.locator('.card a[href="/passport/"]').count() === 2, 'Full Moon result screen has All games and My Passport links plus the Season line link');
await fm.screenshot({ path: shots + '/fullmoon_result.png' });
await fm.evaluate(() => window.__mm.showMenu());
check(await fm.locator('.card a[href="/passport/"]').count() === 1 && await fm.locator('.card a[href="/games/"]').count() === 1, 'Full Moon menu has All games and My Passport links');

// ---- Moon Brew, signed in ----
const mb = await ctx.newPage(); watch(mb);
await mb.goto(base + '/games/moon-brew/'); await mb.waitForFunction(() => window.__moonbrew, null, { timeout: 30000 });
await mb.waitForTimeout(800);
await mb.evaluate(() => window.__moonbrew.startDaily());
// play like a person: one tap about every second, using the tray's own solution order
for (let i = 0; i < 200; i++) {
  const st = await mb.evaluate(() => { const m = window.__moonbrew, g = m.g; if (g.status !== 'playing') return { done: true, status: g.status }; const fz = (b) => b.ice > 0 && g.rolled < b.ice; const next = g.level.solution.map((ids) => g.beans[ids[0]]).find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))) || g.beans.find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))); return { done: false, id: next ? next.id : -1, pt: next ? m.beanPoint(next.id) : null }; });
  if (st.done) break; if (st.id < 0) break;
  await mb.mouse.click(st.pt.x, st.pt.y); await mb.waitForTimeout(1000);
}
await mb.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 20000 });
const mbLine = await mb.locator('#seasonline').innerText();
check(/not your score/.test(mbLine), 'Moon Brew: result line says the medal, not the score, sets the points');
check(/^Season points: \+\d+/.test(mbLine), 'Moon Brew: result screen says "' + mbLine.slice(0, 90) + '"');
const row2 = db.prepare("SELECT r.score, m.counted FROM game_runs r JOIN run_meta m ON m.run_id = r.id WHERE r.game_id = 'moon-brew' AND r.status = 'accepted'").get();
const mbScore = await mb.evaluate(() => window.__moonbrew.save.daily[Object.keys(window.__moonbrew.save.daily).pop()].score);
check(row2 && row2.counted === 1 && row2.score === mbScore, 'Moon Brew: server score equals the score the game showed (' + mbScore + ')');
await mb.screenshot({ path: shots + '/moonbrew_result.png' });
await mb.click('#o-home'); await mb.waitForTimeout(500);
check(await mb.locator('a[href="/passport/"]').first().isVisible() && await mb.locator('a[href="/games/"]').first().isVisible(), 'Moon Brew title screen has All games and My Passport links');

// ---- the dashboard now shows the points ----
const total = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM points_ledger WHERE status='settled'").get().s;
await page.reload(); await page.waitForSelector('#dash:not([hidden])');
check((await page.locator('#dash .big b').innerText()) === String(total) && total > 0, 'dashboard: shows ' + total + ' points, the same as the ledger');
const gamesTxt = await page.locator('#dash .games').innerText();
check(/Full Moon/.test(gamesTxt) && /Moon Brew/.test(gamesTxt) && /Scam Lab/.test(gamesTxt) && /Joins the Season soon/.test(gamesTxt) && /Tonight: /.test(gamesTxt), 'dashboard: both played games show tonight\'s band, Scam Lab says it joins soon');
check(await page.locator('#dash .recent li').count() >= 3, 'dashboard: recent points listed');
check(await page.locator('img.logo').isVisible() && await page.locator('.moon').count() === 0, 'Passport shows the TODDY logo (not the moon drawing)');
await page.click('#dash summary:has-text("How Season points work")'); const how = await page.locator('#dash .howto').innerText();
check(/Silver 16/.test(how) && /Gold 20/.test(how) && /separate/.test(how) && /6:30 pm/.test(how), 'dashboard: "How Season points work" explains medals, separate game score and the night time');
for (const w of [320, 390, 1280]) { await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(150); check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'dashboard: no sideways scroll at ' + w + ' px'); }
await page.setViewportSize({ width: 390, height: 900 }); await page.screenshot({ path: shots + '/dash_full.png', fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: shots + '/dash_desktop.png', fullPage: true });

// ---- a guest plays Moon Brew: nothing is sent ----
const gctx = await browser.newContext({ viewport: { width: 420, height: 860 } }); await gctx.route('https://fonts.g*apis.com/**', (r) => r.abort()); await gctx.route('https://fonts.gstatic.com/**', (r) => r.abort());
const g = await gctx.newPage(); watch(g); apiCalls.length = 0;
await g.goto(base + '/games/moon-brew/'); await g.waitForFunction(() => window.__moonbrew, null, { timeout: 30000 }); await g.waitForTimeout(800); await g.evaluate(() => window.__moonbrew.startDaily());
for (let i = 0; i < 200; i++) {
  const st = await g.evaluate(() => { const m = window.__moonbrew, gm = m.g; if (gm.status !== 'playing') return { done: true }; const fz = (b) => b.ice > 0 && gm.rolled < b.ice; const next = gm.level.solution.map((ids) => gm.beans[ids[0]]).find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))) || gm.beans.find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))); return { done: false, id: next ? next.id : -1, pt: next ? m.beanPoint(next.id) : null }; });
  if (st.done || st.id < 0) break; await g.mouse.click(st.pt.x, st.pt.y); await g.waitForTimeout(450);
}
await g.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 20000 });
check(/Playing as a guest/.test(await g.locator('#seasonline').innerText()) && /Passport/.test(await g.locator('#seasonline a').innerText()), 'guest: result says "Playing as a guest" with a link to sign in');
check(!apiCalls.some((c) => /run\//.test(c)), 'guest: no run was sent to the server (' + apiCalls.join(', ') + ')');
check(db.prepare("SELECT COUNT(*) c FROM game_runs").get().c === 2, 'guest play left no rows in the database');

check(viol.length === 0, 'no Content-Security-Policy violations in any page (' + viol.length + ') ' + viol.slice(0, 2).join(' | ')); check(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join('|'));
await browser.close(); server.close();
console.log(bad ? 'PROBLEMS: ' + bad : 'games + dashboard in a real browser ok'); if (bad) process.exitCode = 1;
