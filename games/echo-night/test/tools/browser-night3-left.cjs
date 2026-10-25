const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('http://localhost:8801/games/echo-night/index.html'); await p.waitForTimeout(1000);
  await p.evaluate(() => window.__echo.startNight(3)); await p.waitForTimeout(300);
  await p.screenshot({ path: '/home/claude/work4/n3a.png' });
  const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { l: c.left, t: c.top, w: c.width }; }); await p.mouse.click(r.l + 590 * r.w / 780, r.t + 300 * r.w / 780); await p.waitForTimeout(11500);
  await p.screenshot({ path: '/home/claude/work4/n3b.png' });
  console.log(await p.evaluate(() => document.getElementById('banner').textContent), errs); await b.close();
})();
