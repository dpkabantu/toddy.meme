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
import { RULES } from '../rules.js';
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

// sign in from the Season page: new player -> Passport join -> straight back to Season 1
const page = await ctx.newPage(); watch(page);
await page.goto(base + '/season/'); await page.waitForSelector('#signin-card:not([hidden])');
check(await page.locator('#tg .tg-card').count() === 3 && !(await page.locator('#mine').isVisible()) && await page.locator('#how-list li').count() >= 6, 'Season page as a guest: 3 game cards, sign-in card, how it works, no personal data');
check(/Test mode/.test(await page.locator('#testbanner').innerText()), 'Season page: honest test-mode banner while the Season has not started');
await page.screenshot({ path: shots + '/season_guest.png', fullPage: true });
await page.click('#signin'); await page.waitForSelector('#s-join:not([hidden])');
await page.fill('#j-name', 'Night_Owl'); await page.check('#j-adult'); await page.check('#j-terms'); await page.click('#j-go');
await page.waitForURL('**/season/'); await page.waitForSelector('#mine:not([hidden])');
check((await page.locator('#h-name').innerText()) === 'Night_Owl' && /^TDY-/.test(await page.locator('#h-id').innerText()), 'after joining: lands on the Season page with the player\'s name and Passport ID');
check(!(await page.locator('#signin-card').isVisible()) && await page.locator('#acct').isVisible() && (await page.locator('.topnav a').first().getAttribute('href')) === '/', 'signed in: no sign-in card, "My account" link, and a way back to the TODDY home');
check(/0/.test(await page.locator('#dash .big b').innerText()) && /Nothing yet/.test(await page.locator('#dash').innerText()), 'Season page, brand new player: 0 points and a friendly empty state');
const cards = await page.locator('#tg').innerText();
check((cards.match(/Play tonight/g) || []).length === 3 && !/Joins the Season soon/.test(cards) && !/practice only/.test(cards), 'tonight cards: three "Play tonight\u2019s challenge" buttons (Scam Lab is connected now)');
await page.screenshot({ path: shots + '/season_empty.png', fullPage: true });

// ---- Full Moon: reached through the Season page link ----
await Promise.all([page.waitForURL(/full-moon\/\?play=daily|full-moon\/$/), page.click('#tg .tg-card:nth-child(2) a')]);
await page.waitForFunction(() => window.__mm && window.__mm.mode === 'play', null, { timeout: 30000 });
check(!/play=daily/.test(page.url()), 'Season page link starts tonight\'s Full Moon challenge directly (and tidies the address)');
const t0 = Date.now();
await page.evaluate(() => { window.__drop = setInterval(() => { if (window.__mm.mode === 'play') window.__mm.dropAt(560); }, 60); });
await page.waitForFunction(() => window.__mm.mode !== 'play' && window.__mm.lastRun, null, { timeout: 170000, polling: 500 });
console.log('     (Full Moon night lasted ' + Math.round((Date.now() - t0) / 1000) + ' s of real time)');
await page.evaluate(() => clearInterval(window.__drop));
await page.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 15000 });
const fmLine = await page.locator('#seasonline').innerText(); const fmScore = await page.evaluate(() => window.__mm.lastRun.score);
check(await page.locator('.pair a[href="/"]').isVisible() && await page.locator('.pair a[href="/season/"]').isVisible(), 'Full Moon result: visible buttons back to TODDY home and My Season');
check(/^Season points: \+\d+/.test(fmLine) && /not your score/.test(fmLine), 'Full Moon: result screen says "' + fmLine.slice(0, 90) + '..."');
const row1 = db.prepare("SELECT r.score, m.counted FROM game_runs r JOIN run_meta m ON m.run_id = r.id WHERE r.game_id = 'full-moon' AND r.status = 'accepted'").get();
check(row1 && row1.score === fmScore && row1.counted === 1, 'Full Moon: the server replayed the run and stored the very same score (' + fmScore + ')');
check(await page.locator('.card a[href="/season/"]').count() === 2 && await page.locator('.card a[href="/games/"]').count() === 1, 'Full Moon result screen: links to My Season and All games');
await page.screenshot({ path: shots + '/fullmoon_result.png' });
await page.evaluate(() => window.__mm.showMenu());
const menu = await page.locator('.card').innerText();
check(/Tonight.s challenge/.test(menu) && /counts for Season points/.test(menu) && /Practice/.test(menu) && /does not count for Season/.test(menu) && await page.locator('.card .tag').count() === 2 && /Weekly Challenge/.test(menu) && /half points if finished late/.test(menu), 'Full Moon menu: "Tonight\u2019s challenge" and "Weekly Challenge" tagged Season; "Practice" says it does not count');
await page.screenshot({ path: shots + '/fullmoon_menu.png' });

// ---- Moon Brew: reached through the Season page link ----
await page.goto(base + '/season/'); await page.waitForSelector('#mine:not([hidden])');
check(/Done tonight: \w+ medal/.test(await page.locator('#tg .tg-card:nth-child(2)').innerText()) && /Not played tonight|Same challenge/.test(await page.locator('#tg .tg-card:nth-child(1)').innerText() + 'Not played tonight'), 'Season page: Full Moon card shows tonight\'s medal after playing');
await Promise.all([page.waitForURL(/moon-brew/), page.click('#tg .tg-card:nth-child(1) a')]);
await page.waitForFunction(() => window.__moonbrew && window.__moonbrew.g && window.__moonbrew.g.status === 'playing' && window.__moonbrew.mode.kind === 'daily', null, { timeout: 30000 });
check(true, 'Season page link starts tonight\'s Daily Brew directly');
await page.waitForTimeout(800);
for (let i = 0; i < 200; i++) {
  const st = await page.evaluate(() => { const m = window.__moonbrew, g = m.g; if (g.status !== 'playing') return { done: true }; const fz = (b) => b.ice > 0 && g.rolled < b.ice; const next = g.level.solution.map((ids) => g.beans[ids[0]]).find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))) || g.beans.find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))); return { done: false, id: next ? next.id : -1, pt: next ? m.beanPoint(next.id) : null }; });
  if (st.done || st.id < 0) break; await page.mouse.click(st.pt.x, st.pt.y); await page.waitForTimeout(1000);
}
await page.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 20000 });
const mbLine = await page.locator('#seasonline').innerText();
check(await page.locator('#o-site').isVisible() && (await page.locator('#o-site').getAttribute('href')) === '/' && (await page.locator('#o-season').getAttribute('href')) === '/season/', 'Moon Brew result: visible buttons back to TODDY home and My Season');
check(/^Season points: \+\d+/.test(mbLine) && /not your score/.test(mbLine), 'Moon Brew: result screen says "' + mbLine.slice(0, 90) + '..."');
const row2 = db.prepare("SELECT r.score, m.counted FROM game_runs r JOIN run_meta m ON m.run_id = r.id WHERE r.game_id = 'moon-brew' AND r.status = 'accepted'").get();
const mbScore = await page.evaluate(() => window.__moonbrew.save.daily[Object.keys(window.__moonbrew.save.daily).pop()].score);
check(row2 && row2.counted === 1 && row2.score === mbScore, 'Moon Brew: server score equals the score the game showed (' + mbScore + ')');
await page.screenshot({ path: shots + '/moonbrew_result.png' });
await page.click('#o-home'); await page.waitForTimeout(500);
const title = await page.locator('#screen-title').innerText().catch(() => '');
check(await page.locator('a[href="/season/"]').first().isVisible() && await page.locator('a[href="/games/"]').first().isVisible(), 'Moon Brew title screen: links to My Season and All games');
check(/Daily Brew/.test(title) && /counts for Season/.test(title) && /Story/.test(title) && /no Season points/.test(title), 'Moon Brew title: Daily Brew tagged "counts for Season"; Story and Endless say "no Season points"');
await page.screenshot({ path: shots + '/moonbrew_title.png' });


// ---- Scam Lab: Daily Quickie reached through the Season page ----
await page.goto(base + '/games/scam-lab/'); await page.waitForTimeout(2500);
await page.evaluate(() => { const k = 'toddy.scamlab.v2'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.stars = { 'c1-01': 3 }; d.best = { 'c1-01': 900 }; d.howto = true; localStorage.setItem(k, JSON.stringify(d)); });
await page.goto(base + '/season/'); await page.waitForSelector('#mine:not([hidden])');
check((await page.locator('#tg .tg-card:nth-child(3) a').getAttribute('href')) === '/games/scam-lab/?play=daily', 'Season page: the Scam Lab button opens tonight\u2019s Daily Quickie');
await page.goto(base + '/games/scam-lab/?play=daily&qa');   // same address the Season button opens; &qa only adds the test hook
await page.waitForSelector('#btn-go', { timeout: 30000 });
check(!/play=daily/.test(page.url()) && /Daily Quickie/.test(await page.locator('h2').first().innerText()), 'Scam Lab: the link opens tonight\u2019s Daily Quickie intro (and tidies the address)');
await page.click('#btn-go'); await page.click('#notif'); await page.waitForSelector('#btn-decide', { timeout: 30000 });
const sl = await page.evaluate(() => { const S = window.__lab.playState(); const c = S.c; Object.entries(c.clues).forEach(([k, v]) => { if (v.strength === 'strong') S.marks[k] = 'flag'; }); return { best: c.best_action }; });
await page.waitForTimeout(1500);
await page.click('#btn-decide'); await page.click('.choice[data-action="' + sl.best + '"]');
await page.waitForSelector('#btn-continue', { timeout: 15000 }); await page.click('#btn-continue');
await page.waitForSelector('#btn-quick', { timeout: 15000 }); await page.click('#btn-quick');
await page.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 20000 });
const slLine = await page.locator('#seasonline').innerText(); const slScore = await page.evaluate(() => Number(document.getElementById('total').firstChild.textContent));
check(await page.locator('#btn-site').isVisible() && (await page.locator('#btn-season').getAttribute('href')) === '/season/', 'Scam Lab result: links back to TODDY home and My Season');
check(/^Season points: \+\d+/.test(slLine) && /not your score/.test(slLine), 'Scam Lab: result screen says "' + slLine.slice(0, 90) + '..."');
const row3 = db.prepare("SELECT r.score, m.counted, m.band FROM game_runs r JOIN run_meta m ON m.run_id = r.id WHERE r.game_id = 'scam-lab' AND r.status = 'accepted'").get();
check(row3 && row3.counted === 1 && row3.score === slScore && row3.band === 3, 'Scam Lab: server score equals the score the game showed (' + slScore + ', Gold)');
await page.screenshot({ path: shots + '/scamlab_result.png' });

// ---- the Season page now shows everything ----
const total = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM points_ledger WHERE status='settled'").get().s;
await page.goto(base + '/season/'); await page.waitForSelector('#mine:not([hidden])');
check((await page.locator('#dash .big b').innerText()) === String(total) && total > 0, 'Season page: shows ' + total + ' points, the same as the ledger');
const done = await page.locator('#tg').innerText();
check(/Done tonight: \w+ medal/.test(done) && /Top medal reached/.test(done), 'Season page: both played games show tonight\'s medal; a Gold game says the top medal is reached');
check(await page.locator('#dash .recent li').count() >= 3 && await page.locator('#dash .goal').count() === 3, 'Season page: recent points and three weekly goals listed');
for (const w of [320, 390, 1280]) { await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(150); check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Season page: no sideways scroll at ' + w + ' px'); }
await page.setViewportSize({ width: 390, height: 900 }); await page.screenshot({ path: shots + '/season_full.png', fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: shots + '/season_desktop.png', fullPage: true });
{ const bx = async (sel) => page.locator(sel).boundingBox(); const t = await bx('#tonight'), hl = await bx('#hello'), m = await bx('#mine'), mi = await bx('#missions'), h = await page.evaluate(() => document.documentElement.scrollHeight);
  check(t && hl && m && hl.x > t.x + t.width - 2 && m.x === hl.x && Math.abs(hl.y - t.y) < 4 && mi.x === t.x, 'desktop 1280 px: two columns (tonight and missions on the left, your Season on the right, side by side)');
  check(h < 2400, 'desktop 1280 px: the whole page is ' + h + ' px tall (was about 4500)'); }
// account page
await page.goto(base + '/passport/'); await page.waitForSelector('#s-in:not([hidden])');
check(await page.locator('a[href="/season/"]').first().isVisible() && await page.locator('#dash').count() === 0, 'Passport page: account page with a "Go to Season 1" button (no duplicate dashboard)');
// main page menu
await page.goto(base + '/'); await page.waitForSelector('#nav-season:not([hidden])', { timeout: 20000 });
check(/Night_Owl . Season 1/.test(await page.locator('#nav-season').innerText()) && (await page.locator('#nav-season a').getAttribute('href')) === '/season/', 'main page menu: shows the player\'s name and goes to Season 1');
await page.screenshot({ path: shots + '/home_menu.png', clip: { x: 0, y: 0, width: 1280, height: 120 } });

// ---- Scam Lab chapter mission: a chapter case played for the mission, from the Season page link ----
await page.goto(base + '/season/'); await page.waitForSelector('#missions:not([hidden])'); await page.evaluate(() => document.querySelectorAll('#mg details').forEach((d) => { d.open = true; }));
const chCard = page.locator('#mg .mrow', { hasText: 'Chapter 1' });
check(/0 of 6 cases/.test(await chCard.innerText()) && (await chCard.locator('a').getAttribute('href')) === '/games/scam-lab/?mission=scam-lab-ch1', 'Season page: Scam Lab chapter 1 mission card shows 0 of 6 cases and opens the chapter');
check(/Opening soon/.test(await page.locator('#mg').innerText()) === false, 'Season page: nothing is locked while the Season is in test mode');
await page.goto(base + '/games/scam-lab/?mission=scam-lab-ch1&qa');
await page.waitForFunction(() => window.__lab, null, { timeout: 30000 }); await page.waitForTimeout(800);
check(!/mission=/.test(page.url()) && /qa/.test(page.url()), 'Scam Lab: the mission link opens the chapter page and tidies the address');
await page.waitForFunction(() => { const e = document.getElementById('chseason'); return e && !e.hidden; }, null, { timeout: 15000 });
check(/0 of 6 cases counted/.test(await page.locator('#chseason').innerText()) && /3 cases: \+25/.test(await page.locator('#chseason').innerText()), 'Scam Lab chapter page: a line says "' + (await page.locator('#chseason').innerText()).slice(0, 70) + '..." (Season progress, separate from this device\u2019s dots)');
await page.evaluate(() => ['c1-01', 'c1-02', 'c1-03', 'c1-04', 'c1-05', 'c1-06'].forEach((id) => window.__lab.store.record(id, 3, 900)));   // like a device that already played all of chapter 1 before the Season
await page.evaluate(() => window.__lab.caseIntro('c1-03'));
await page.waitForSelector('#btn-go', { timeout: 30000 }); await page.click('#btn-go');
for (let i = 0; i < 12 && !(await page.locator('#btn-decide').isVisible()); i++) {   // Milo's intro, the notification and similar steps: press whatever is offered
  const next = page.locator('#notif:visible, button:visible:text-is("Begin"), button:visible:text-is("Next"), button:visible:text-is("Got it")').first();
  if (await next.count()) await next.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600);
}
await page.waitForSelector('#btn-decide', { timeout: 30000 }).catch(async (e) => { console.log('DEBUG', (await page.locator('body').innerText()).slice(0, 600).replace(/\n+/g, ' | ')); await page.screenshot({ path: shots + '/debug_chapter.png' }); throw e; });
const ch3 = await page.evaluate(() => { const S = window.__lab.playState(); const c = S.c; Object.entries(c.clues).forEach(([k, v]) => { if (v.strength === 'strong') S.marks[k] = 'flag'; }); return { best: c.best_action, quick: c.quick_check.answer }; });
await page.waitForTimeout(21000);   // the server refuses a case finished in under 20 seconds of real time
await page.click('#btn-decide'); await page.click('.choice[data-action="' + ch3.best + '"]');
await page.waitForSelector('#btn-continue', { timeout: 15000 }); await page.click('#btn-continue');
await page.waitForSelector('#btn-quick', { timeout: 15000 }); await page.click('#btn-quick');
await page.waitForSelector('.choice[data-option="' + ch3.quick + '"]', { timeout: 15000 }); await page.click('.choice[data-option="' + ch3.quick + '"]');
await page.waitForSelector('#btn-result', { timeout: 15000 }); await page.click('#btn-result');
await page.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 20000 });
const chLine = await page.locator('#seasonline').innerText();
check(/Next: Case 4/.test(await page.locator('#btn-next').innerText()), 'Scam Lab: replaying case 3 of a finished chapter offers "Next: Case 4", not another chapter ("' + (await page.locator('#btn-next').innerText()) + '")');
check(/Case counted for the chapter mission: 1 of 6 cases done/.test(chLine), 'Scam Lab chapter case result says: "' + chLine.slice(0, 80) + '"');
const chRow = db.prepare("SELECT r.score, r.seed FROM game_runs r WHERE r.mode = 'weekly' AND r.game_id = 'scam-lab' AND r.status = 'accepted'").get();
const chScore = await page.evaluate(() => Number(document.getElementById('total').firstChild.textContent));
check(chRow && chRow.seed === 'scam-lab-ch1:c1-03' && chRow.score === chScore, 'Scam Lab chapter case: the server scored it again and got the same score (' + chScore + ')');
await page.goto(base + '/season/'); await page.waitForSelector('#missions:not([hidden])'); await page.evaluate(() => document.querySelectorAll('#mg details').forEach((d) => { d.open = true; }));
check(/1 of 6 cases/.test(await page.locator('#mg .mrow', { hasText: 'Chapter 1' }).innerText()), 'Season page: the chapter card now shows 1 of 6 cases');

// ---- Weekly Challenge (Full Moon), reached from the Season page ----
RULES.fullMoonWeekly.silverBand = 0;   // test only: any finished try reaches stage one (a real Silver needs a skilled player)
await page.goto(base + '/season/'); await page.waitForSelector('#missions:not([hidden])'); await page.evaluate(() => document.querySelectorAll('#mg details').forEach((d) => { d.open = true; }));
const mtxt = await page.locator('#mg').innerText();
check(/Full Moon/.test(mtxt) && /Weekly Challenge/.test(mtxt) && /Silver \+40/.test(mtxt) && /Gold \+10/.test(mtxt) && /open until/.test(mtxt), 'Season page: the Weekly Challenge card shows its stages and when it closes');
await page.screenshot({ path: shots + '/season_mission.png', fullPage: true });
await Promise.all([page.waitForURL(/full-moon/), page.click('#mg .mrow:has-text("Full Moon") a')]);
await page.waitForFunction(() => window.__mm && window.__mm.mode === 'play', null, { timeout: 30000 });
check(!/play=weekly/.test(page.url()) && /Weekly/.test(await page.locator('#mode').innerText().catch(() => 'Weekly')), 'Season page button starts the Weekly Challenge directly');
await page.evaluate(() => { window.__drop = setInterval(() => { if (window.__mm.mode === 'play') window.__mm.dropAt(560); }, 60); });
await page.waitForFunction(() => window.__mm.mode !== 'play' && window.__mm.lastRun, null, { timeout: 170000, polling: 500 });
await page.evaluate(() => clearInterval(window.__drop));
await page.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 15000 });
const wLine = await page.locator('#seasonline').innerText(); const wScore = await page.evaluate(() => window.__mm.lastRun.score);
check(/^Weekly Challenge points: \+40/.test(wLine) && !/Active night/.test(wLine), 'Weekly Challenge result says: "' + wLine.slice(0, 80) + '..."');
const wRow = db.prepare("SELECT r.score, r.seed FROM game_runs r WHERE r.mode = 'weekly' AND r.game_id = 'full-moon' AND r.status = 'accepted'").get();
check(wRow && wRow.score === wScore && wRow.seed === 'full-moon-w3', 'Weekly Challenge: the server replayed the fixed puzzle and stored the same score (' + wScore + ')');
check(db.prepare("SELECT COUNT(*) c FROM points_ledger WHERE source_type = 'mission' AND amount = 40").get().c === 1, 'Weekly Challenge: exactly one 40-point ledger row');
await page.goto(base + '/season/'); await page.waitForSelector('#missions:not([hidden])'); await page.evaluate(() => document.querySelectorAll('#mg details').forEach((d) => { d.open = true; }));
check(/\u2713 Silver \+40/.test(await page.locator('#mg').innerText()), 'Season page: the finished stage shows a tick');
RULES.fullMoonWeekly.silverBand = 2;

// ---- Season Nights (Moon Brew launch mission), reached from the Season page ----
await page.goto(base + '/season/'); await page.waitForSelector('#missions:not([hidden])');
const wtxt = await page.locator('#mg').innerText();
check(/Week 1/.test(wtxt) && /Moon Brew . Season Nights/.test(wtxt) && /Up to 420 points/.test(wtxt) && /15 points every 5 trays/.test(wtxt), 'Season page: week 1 shows Moon Brew Season Nights (up to 420, 15 every 5 trays)');
check(await page.locator('#mg details.rest summary').first().isVisible() && !(await page.locator('#mg .mrow', { hasText: 'Weekly Challenge' }).isVisible()), 'Season page: Scam Lab (week 2) and Full Moon (week 3) are folded under coming weeks');
await page.screenshot({ path: shots + '/season_byweek.png', fullPage: true });
await Promise.all([page.waitForURL(/moon-brew/), page.click('#mg .mrow:has-text("Season Nights") a')]);
await page.waitForSelector('.nights button[data-night="1"]', { state: 'visible', timeout: 30000 });
const sn = await page.locator('#brewset-body').innerText();
check(/7 nights/.test(sn) && /Cinnamon sticks/.test(sn) && /Moon doors/.test(sn) && (await page.locator('.sn-night').count()) === 7, 'Season Nights: the Moon Brew page lists 7 nights, each with what is new');
await page.screenshot({ path: shots + '/season_nights.png', fullPage: true });
await page.click('.nights button[data-night="1"]');
await page.waitForFunction(() => window.__moonbrew && window.__moonbrew.g && window.__moonbrew.g.status === 'playing' && window.__moonbrew.mode.kind === 'brewset', null, { timeout: 30000 });
await page.waitForTimeout(800);
for (let i = 0; i < 200; i++) {
  const st = await page.evaluate(() => { const m = window.__moonbrew, g = m.g; if (g.status !== 'playing') return { done: true }; const fz = (b) => b.ice > 0 && g.rolled < b.ice; const next = g.level.solution.map((ids) => g.beans[ids[0]]).find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))) || g.beans.find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))); return { done: false, id: next ? next.id : -1, pt: next ? m.beanPoint(next.id) : null }; });
  if (st.done || st.id < 0) break; await page.mouse.click(st.pt.x, st.pt.y); await page.waitForTimeout(1000);
}
await page.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 20000 });
const bsLine = await page.locator('#seasonline').innerText();
check(/Tray counted. Night 1: 1 of 20 trays/.test(bsLine), 'Season Nights result says "' + bsLine.slice(0, 80) + '"');
const bsRow = db.prepare("SELECT seed, score FROM game_runs WHERE mode = 'weekly' AND game_id = 'moon-brew' AND status = 'accepted'").get();
check(bsRow && bsRow.seed === 'moon-brew-season:n1t1' && bsRow.score > 0, 'Season Nights: the server replayed night 1 tray 1 and accepted it (seed ' + (bsRow && bsRow.seed) + ')');
check(await page.locator('#o-site').isVisible() && await page.locator('#o-season').isVisible() && await page.locator('#o-next').isVisible(), 'Season Nights result: Next tray, TODDY home and My Season buttons');
await page.click('#o-set'); await page.waitForSelector('.nights button[data-night="1"]', { state: 'visible' });
check(/Continue: tray 2/.test(await page.locator('.nights button[data-night="1"]').innerText()), 'Season Nights list: night 1 now says "Continue: tray 2"');

// ---- a guest plays Moon Brew from the Season page: nothing is sent ----
const gctx = await browser.newContext({ viewport: { width: 420, height: 860 } }); await gctx.route('https://fonts.g*apis.com/**', (r) => r.abort()); await gctx.route('https://fonts.gstatic.com/**', (r) => r.abort());
const g = await gctx.newPage(); watch(g);
await g.goto(base + '/'); await g.waitForTimeout(1500);
check(await g.locator('#nav-season').isHidden() || /Sign in/.test(await g.locator('#nav-season').innerText()), 'main page menu for a guest: "Season 1 \u00b7 Sign in" (or hidden in the folded phone menu)');
await g.goto(base + '/season/'); await g.waitForSelector('#signin-card:not([hidden])'); apiCalls.length = 0;
await Promise.all([g.waitForURL(/moon-brew/), g.click('#tg .tg-card:nth-child(1) a')]);
await g.waitForFunction(() => window.__moonbrew && window.__moonbrew.g && window.__moonbrew.g.status === 'playing', null, { timeout: 30000 }); await g.waitForTimeout(800);
for (let i = 0; i < 200; i++) {
  const st = await g.evaluate(() => { const m = window.__moonbrew, gm = m.g; if (gm.status !== 'playing') return { done: true }; const fz = (b) => b.ice > 0 && gm.rolled < b.ice; const next = gm.level.solution.map((ids) => gm.beans[ids[0]]).find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))) || gm.beans.find((b) => !b.gone && (!b.awake || (m.canRoll(b.id) && !fz(b)))); return { done: false, id: next ? next.id : -1, pt: next ? m.beanPoint(next.id) : null }; });
  if (st.done || st.id < 0) break; await g.mouse.click(st.pt.x, st.pt.y); await g.waitForTimeout(450);
}
await g.waitForFunction(() => { const e = document.getElementById('seasonline'); return e && !e.hidden && e.textContent.length > 5; }, null, { timeout: 20000 });
check(/Playing as a guest/.test(await g.locator('#seasonline').innerText()) && (await g.locator('#seasonline a').getAttribute('href')) === '/season/', 'guest: result says "Playing as a guest" with a link to the Season page');
check(!apiCalls.some((c) => /run\//.test(c)), 'guest: no run was sent to the server (' + apiCalls.join(', ') + ')');
check(db.prepare("SELECT COUNT(*) c FROM game_runs").get().c === 6, 'guest play left no rows in the database (3 daily runs, 1 Weekly Challenge, 1 chapter case and 1 Season Nights tray from the signed-in player)');

check(viol.length === 0, 'no Content-Security-Policy violations in any page (' + viol.length + ') ' + viol.slice(0, 2).join(' | ')); check(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join('|'));
await browser.close(); server.close();
console.log(bad ? 'PROBLEMS: ' + bad : 'Season page + games in a real browser ok'); if (bad) process.exitCode = 1;
