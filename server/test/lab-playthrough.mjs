// Real-browser playthrough of every case of one Scam Lab chapter: best route and a wrong route (Inbox Rush: best only), with no console or page errors.
//   node --no-warnings server/test/lab-playthrough.mjs <chapter number> [screenshot-folder]      (needs Playwright; run by hand, about 4 minutes per chapter)
//   ONLY=c1-01,c1-03 limits it to some cases; SHOTS=1 also saves a picture of each case screen.
import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/npm-tools/')('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); const chapter = Number(process.argv[2] || 1); const shots = process.argv[3] || '/tmp/labshots';
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const port = srv.address().port; const b = await chromium.launch();
const errors = []; let bad = 0; const check = (ok, m) => { if (!ok) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const ctx = await b.newContext({ viewport: { width: 390, height: 780 } });
async function fresh() { const pg = await ctx.newPage(); pg.on('pageerror', (e) => errors.push(String(e))); pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); }); await pg.route(/fonts\.g/, (r) => r.abort()); return pg; }
const pg = await fresh();
await pg.goto(`http://localhost:${port}/games/scam-lab/?qa`); await pg.waitForFunction(() => window.__lab, null, { timeout: 30000 }); await pg.waitForTimeout(500);
const ids = await pg.evaluate((n) => window.__lab.chapterPage && JSON.parse(JSON.stringify(Object.values(window.__lab.CASES).filter((c) => c.chapter === n).map((c) => c.id))), chapter);
if (process.env.ONLY) { const keep = process.env.ONLY.split(','); ids.splice(0, ids.length, ...ids.filter((i) => keep.includes(i))); }
console.log('cases', ids.length);
const pressIntro = async () => { for (let i = 0; i < 14; i++) { if (await pg.locator('#btn-decide:visible, #rush-scam:visible, .reply:visible').count()) return; const nx = pg.locator('#notif:visible, #milo-skip:visible, button:visible:text-is("Begin"), button:visible:text-is("Next"), button:visible:text-is("Got it"), #btn-go:visible').first(); if (await nx.count()) await nx.click({ timeout: 2000 }).catch(() => {}); await pg.waitForTimeout(500); } };
async function finishDebrief() {
  for (let i = 0; i < 20; i++) {
    if (await pg.locator('#btn-board:visible').count()) {
      const B = await pg.evaluate(() => { const S = window.__lab.playState(); return { answer: S.c.board.answer, pick: S.c.board.pick, picks: Object.keys(S.c.clues).filter((k) => S.c.clues[k].strength === 'strong' && S.seen.has(k)) }; });
      await pg.click('[data-verdict="' + B.answer + '"]'); for (const k of B.picks.slice(0, B.pick)) await pg.click('[data-pick="' + k + '"]'); await pg.waitForTimeout(300);
    }
    for (const sel of ['#btn-board', '#btn-continue', '#btn-quick', '#btn-result']) { const l = pg.locator(sel + ':visible').first(); if (await l.count()) { if (sel === '#btn-quick') { await l.click(); const ans = await pg.evaluate(() => (() => { const body = document.body.innerText; const cs = [window.__lab.rushState(), window.__lab.playState()].filter(Boolean).map((x) => x.c); const c = cs.find((x) => x.quick_check && body.includes(String(x.quick_check.q || x.quick_check.question || '').slice(0, 25))) || cs.find((x) => x.quick_check) || {}; return (c.quick_check || {}).answer; })()); await pg.click('.choice[data-option="' + ans + '"]', { timeout: 6000 }).catch(async () => { console.log('DEBUGQ', ans, (await pg.locator('body').innerText()).slice(0, 700).replace(/\n+/g, ' | ')); await pg.screenshot({ path: shots + '/dbgq.png' }); }); } else await l.click(); await pg.waitForTimeout(350); } }
    if (await pg.locator('#btn-next:visible, #total:visible').count() && await pg.locator('#btn-result:visible, #btn-continue:visible, #btn-quick:visible').count() === 0) return true;
  }
  return false;
}
for (const id of ids) {
  const c = await pg.evaluate((i) => window.__lab.CASES[i], id);
  for (const route of c.type === 'rush' ? ['best'] : ['best', 'worst']) {
    await pg.evaluate((i) => window.__lab.caseIntro(i), id); await pg.waitForSelector('#btn-go', { timeout: 20000 }); await pg.click('#btn-go');
    await pressIntro();
    if (process.env.SHOTS) { await pg.waitForSelector('#btn-decide, #rush-scam, .reply', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(500); await pg.screenshot({ path: `${shots}/play_${id}_${route}.png` }); }
    if (c.type === 'rush') {
      for (const k of c.cards) { await pg.waitForSelector('#rush-scam', { timeout: 8000 }); await pg.click(k.scam ? '#rush-scam' : '#rush-safe'); await pg.waitForTimeout(450); }
    } else {
      const worst = (c.actions.find((a) => a.id !== c.best_action && !(c.acceptable_actions || []).includes(a.id)) || c.actions[0]).id;
      const want = route === 'best' ? c.best_action : worst;
      for (let step = 0; step < 14; step++) {
        if (await pg.locator('#btn-continue:visible, #btn-quick:visible, #btn-board:visible').count()) break;
        if (await pg.locator('#trap-go:visible').count()) { await pg.click('#trap-go'); await pg.waitForTimeout(500); continue; }
        if (await pg.locator('.reply:visible').count()) {
          const st = await pg.evaluate(() => { const S = window.__lab.playState(); return { node: S.node, nodes: S.c.duel.nodes }; }).catch(() => null);
          let idx = 0; if (st && st.node && st.nodes[st.node]) { const reps = st.nodes[st.node].replies; const e = reps.findIndex((r) => r.end === want); const nxt = reps.findIndex((r) => r.next); idx = e >= 0 ? e : (nxt >= 0 ? nxt : 0); }
          await pg.locator('.reply:visible').nth(idx).click(); await pg.waitForTimeout(900); continue;
        }
        if (await pg.locator('.choice[data-action]:visible').count()) {
          const have = await pg.evaluate(() => [...document.querySelectorAll('.choice[data-action]')].map((e) => e.dataset.action));
          const pick = have.includes(want) ? want : (c.actions.find((a) => a.goto && have.includes(a.id)) || { id: have[0] }).id;
          await pg.click('.choice[data-action="' + pick + '"]'); await pg.waitForTimeout(600); continue;
        }
        if (await pg.locator('#btn-decide:visible').count()) {
          await pg.evaluate(() => { const S = window.__lab.playState(); Object.entries(S.c.clues).forEach(([k, v]) => { if (v.strength === 'strong') { S.marks[k] = 'flag'; S.seen.add(k); } }); });
          await pg.click('#btn-decide'); await pg.waitForTimeout(500); continue;
        }
        await pg.waitForTimeout(500);
      }
    }
    const okDeb = await finishDebrief();
    if (!okDeb) { console.log('DEBUG', (await pg.locator('body').innerText()).slice(0, 500).replace(/\n+/g, ' | ')); await pg.screenshot({ path: `${shots}/fail_${id}_${route}.png` }); }
    check(okDeb, `${id} ${c.type} (${route}) plays to the result`);
    if (route === 'best') { const sc = await pg.evaluate(() => document.getElementById('total') ? document.getElementById('total').textContent : ''); await pg.screenshot({ path: `${shots}/${id}.png` }); }
  }
}
check(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); console.log(bad ? 'PROBLEMS ' + bad : 'playthrough ok'); process.exit(bad ? 1 : 0);
