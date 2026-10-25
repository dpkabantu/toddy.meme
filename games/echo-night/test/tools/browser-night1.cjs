const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('http://localhost:8801/games/echo-night/index.html'); await p.waitForTimeout(1000);
  async function click(x, y) { const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { l: c.left, t: c.top, w: c.width }; }); await p.mouse.click(r.l + x * r.w / 780, r.t + y * r.w / 780); }
  const st = () => p.evaluate(() => ({ tick: window.__echo.sim.tick, v: window.__echo.sim.visitors.map(v => v.state), cups: window.__echo.sim.cups, s: window.__echo.sim.status, banner: document.getElementById('banner').textContent }));
  await p.click('text=Night 1 · First cup'); await p.waitForTimeout(300);
  await click(190, 300);
  for (let i = 0; i < 80; i++) { await p.waitForTimeout(100); if ((await st()).cups >= 1) break; }
  await click(170, 650);
  for (let i = 0; i < 80; i++) { await p.waitForTimeout(100); if ((await st()).v[0] === 'served') break; }
  await p.waitForTimeout(600); await p.screenshot({ path: '/home/claude/work4/solo_back.png' });
  console.log('after A', JSON.stringify(await st()));
  await click(190, 300);
  for (let i = 0; i < 100; i++) { await p.waitForTimeout(100); if ((await st()).cups >= 2) break; }
  await click(610, 650);
  for (let i = 0; i < 100; i++) { await p.waitForTimeout(100); if ((await st()).s === 'won') break; }
  await p.waitForTimeout(1500); await p.screenshot({ path: '/home/claude/work4/solo_won.png' });
  console.log('end', JSON.stringify(await st()), errs); await b.close();
})();
