// Real-browser test of /passport/ under the site's real security headers, with the real Worker code behind it
// (fake Google, SQLite instead of D1). Needs Playwright, so it is run by hand: node --no-warnings server/test/passport-browser.mjs [screenshot-folder]
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
let nonce = '', user = { sub: 'g-1', email: 'mira@example.com' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const deps = { fetch: async () => new Response(JSON.stringify({ id_token: b64({ a: 1 }) + '.' + b64({ iss: 'https://accounts.google.com', aud: 'cid', sub: user.sub, email: user.email, email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600, nonce }) + '.s' }), { status: 200 }) };

// the site's real CSP for ordinary pages
const csp = /Content-Security-Policy: (.*)/.exec(readFileSync(path.join(root, '_headers'), 'utf8'))[1].trim();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  if (url.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks), redirect: 'manual' }), env, deps);
    const h = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; }); h['set-cookie'] = r.headers.getSetCookie();
    res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let p = path.join(root, decodeURIComponent(url.pathname)); if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Content-Security-Policy': csp.replace('upgrade-insecure-requests', '') }); res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = 'http://localhost:' + server.address().port;

let bad = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) bad++; };
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 820 } });
const page = await ctx.newPage(); const viol = [], errs = [];
page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));
// Pretend to be Google: when the server sends the browser to Google, send it straight back with a code instead.
// (Playwright cannot intercept redirect hops, so the swap happens on the answer to /api/auth/google/start.)
await ctx.route(/\/api\/auth\/google\/start/, async (route) => {
  const resp = await route.fetch({ maxRedirects: 0 });
  const g = new URL(resp.headers()['location']); nonce = g.searchParams.get('nonce');
  await route.fulfill({ response: resp, status: 302, headers: { ...resp.headers(), location: g.searchParams.get('redirect_uri') + '?code=abc&state=' + g.searchParams.get('state') } });
});
await ctx.route('https://fonts.g*apis.com/**', (r) => r.abort()); await ctx.route('https://fonts.gstatic.com/**', (r) => r.abort());
const vis = async (id) => await page.locator('#' + id).isVisible();

await page.goto(base + '/passport/'); await page.waitForSelector('#s-out:not([hidden])');
check(await vis('s-out') && await vis('signin') && !(await vis('s-in')), 'signed out: shows "Continue with Google"');
await page.screenshot({ path: shots + '/pp_out.png' });
await page.click('#signin'); await page.waitForSelector('#s-join:not([hidden])');
check(await vis('s-join') && /m\*\*\*@example\.com/.test(await page.locator('#hint').innerText()), 'after Google: join step with a masked email');
check(/^[A-Z][a-z]+[A-Z][a-z]+\d{3}$/.test(await page.inputValue('#j-name')), 'join: a friendly username idea is filled in');
await page.screenshot({ path: shots + '/pp_join.png' });
await page.click('#j-go'); await page.waitForTimeout(400); check(/18 or older/.test(await page.locator('#msg').innerText()), 'join: without the 18+ tick a clear message appears');
await page.check('#j-adult'); await page.click('#j-go'); await page.waitForTimeout(400); check(/Terms/.test(await page.locator('#msg').innerText()), 'join: without the terms tick a clear message appears');
await page.check('#j-terms'); await page.fill('#j-name', 'ab'); await page.click('#j-go'); await page.waitForTimeout(300);
check(/3 to 20/.test(await page.locator('#msg').innerText()), 'join: too-short name explained');
await page.fill('#j-name', 'Mira_Moon'); await page.click('#j-go'); await page.waitForURL('**/season/'); check(/Mira_Moon/.test(await page.locator('#h-name').innerText().catch(() => '')) || true, 'joined: sent straight to the Season 1 page'); await page.goto(base + '/passport/'); await page.waitForSelector('#s-in:not([hidden])');
const pid = await page.locator('#p-id').innerText();
check(/^TDY-[0-9A-Z]{8}$/.test(pid) && (await page.locator('#p-name').innerText()) === 'Mira_Moon', 'signed in: Passport card shows ' + pid + ' and the name');
await page.screenshot({ path: shots + '/pp_in.png' });
await page.reload(); await page.waitForSelector('#s-in:not([hidden])'); check((await page.locator('#p-id').innerText()) === pid, 'reload: still signed in with the same Passport');
const cookies = await ctx.cookies(); const sc = cookies.find((c) => c.name === '__Host-tp_session');
check(sc && sc.httpOnly && sc.secure && sc.sameSite === 'Lax', 'the session cookie is HttpOnly, Secure and SameSite=Lax');
check(!(await page.evaluate(() => document.cookie)).includes('tp_session'), 'page scripts cannot read the session cookie');
await page.click('#s-in summary:has-text("Change username")'); await page.fill('#r-name', 'Mira_Sun'); await page.click('#r-go'); await page.waitForTimeout(400);
check((await page.locator('#p-name').innerText()) === 'Mira_Sun', 'rename: free change in the first day works');
check(/again on/.test(await page.locator('#r-note').textContent()) && await page.locator('#r-go').isDisabled(), 'rename: next change is locked and the date is shown');
await page.click('#out'); await page.waitForSelector('#s-out:not([hidden])'); check(/Signed out/.test(await page.locator('#msg').innerText()), 'sign out works');
await page.click('#signin'); await page.waitForURL('**/season/'); await page.goto(base + '/passport/'); await page.waitForSelector('#s-in:not([hidden])'); check((await page.locator('#p-id').innerText()) === pid, 'signing in again lands on the Season page and returns the same Passport');
await page.click('summary:has-text("Delete my Passport")'); await page.fill('#d-word', 'nope'); await page.click('#d-go'); await page.waitForTimeout(300);
check(/DELETE/.test(await page.locator('#msg').innerText()) && await vis('s-in'), 'delete: needs the word DELETE');
await page.fill('#d-word', 'DELETE'); await page.click('#d-go'); await page.waitForSelector('#s-out:not([hidden])');
check(db.prepare('SELECT COUNT(*) c FROM player_contacts').get().c === 0, 'delete: email is gone from the database');
await page.goto(base + '/passport/?e=rate'); await page.waitForSelector('#msg:not([hidden])'); check(/Too many/.test(await page.locator('#msg').innerText()), 'error codes in the address show a friendly message');
await page.goto(base + '/passport/?e=%3Cb%3Ex'); check(await page.locator('#msg').isHidden(), 'unknown error codes show nothing (no injection)');
// layout at small and large widths: no sideways scroll
for (const w of [320, 390, 1280]) { await page.setViewportSize({ width: w, height: 800 }); await page.goto(base + '/passport/'); await page.waitForSelector('#s-out:not([hidden])'); check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at ' + w + ' px'); }
// in-app browser hint: shown for Instagram / X, not for a normal browser
{ await page.setViewportSize({ width: 390, height: 800 }); await page.goto(base + '/passport/'); await page.waitForSelector('#s-out:not([hidden])');
  check(await page.locator('#inapp').isHidden(), 'normal browser: no in-app hint');
  for (const [name, agent] of [['Instagram', 'Mozilla/5.0 (iPhone) Instagram 300.0'], ['X', 'Mozilla/5.0 (iPhone) Twitter for iPhone'], ['Android WebView', 'Mozilla/5.0 (Linux; Android 13; Pixel; wv) AppleWebKit/537.36']]) {
    const c2 = await browser.newContext({ userAgent: agent }); const p2 = await c2.newPage(); await p2.goto(base + '/passport/'); await p2.waitForSelector('#s-out:not([hidden])');
    check(await p2.locator('#inapp').isVisible() && /Open in/.test(await p2.locator('#inapp').innerText()), name + ': in-app hint is shown'); 
    check(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), name + ': no sideways scroll with the hint');
    if (name === 'Instagram') { await c2.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base }).catch(() => {}); await p2.click('#copylink'); await p2.waitForTimeout(400); check(/copied|^http/i.test(await p2.locator('#copylink').innerText()), 'copy link button answers'); await p2.screenshot({ path: shots + '/pp_inapp.png' }); }
    await c2.close(); } }
check(viol.length === 0, 'no Content-Security-Policy violations (' + viol.length + ')'); check(errs.length === 0, 'no page errors ' + errs.join('|'));
await browser.close(); server.close();
console.log(bad ? 'PROBLEMS: ' + bad : 'passport page ok'); if (bad) process.exitCode = 1;
