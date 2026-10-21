// TODDY Trail rough test page: canvas, swipe steering, grey boxes plus approved pictures. No server yet.
import { NIGHTS, NIGHT_IDS, STEPS_PER_SEC, newState, step, score, cartCell, thiefCell, shutterClosed, DX, DY } from './core.js';

const $ = (id) => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const STEP_MS = 1000 / STEPS_PER_SEC;
const IMGS = {};
const loadImg = (name) => new Promise((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = 'assets/' + name + '.webp'; IMGS[name] = im; });
const VISITOR_FILE = { milo: ['visitor_milo_v02', 'visitor_milo_happy_v01'], pip: ['visitor_pip_v01', 'visitor_pip_happy_v01'], velvet: ['visitor_velvet_v01', 'visitor_velvet_happy_v01'], lumi: ['visitor_lumi_v01', 'visitor_lumi_happy_v01'], biscuit: ['visitor_biscuit_v01', 'visitor_biscuit_happy_v01'] };

let st = null, nightId = 0, turns = [], pendingTurn = null, running = false, waiting = false, last = 0, acc = 0;
let prevPts = [], curPts = [], flashes = [], soundOn = false, actx = null, bannerTimer = 0, totalTime = 0;
let W = 0, H = 0, DPR = 1, cell = 30, ox = 0, oy = 0;

// Toddy and his cups. At the start the cups wait in a line behind him (the game only records real steps later).
const pts = (s) => {
  const n = NIGHTS[s.night], list = [{ x: s.x, y: s.y }, ...s.hist.slice(0, s.cups.length)];
  while (list.length < s.cups.length + 1) { const l = list[list.length - 1]; list.push({ x: l.x - DX[n.start.dir], y: l.y - DY[n.start.dir] }); }
  return list;
};

// ---- sound (tiny, made in code) ----
function beep(freq, dur, type, vol) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq; g.gain.value = vol || 0.08;
    o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime; g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  } catch (e) { /* sound is optional */ }
}
const SND = { serve: () => { beep(523, 0.12); setTimeout(() => beep(784, 0.18), 90); }, sigh: () => beep(196, 0.22, 'triangle'), spill: () => beep(130, 0.25, 'sawtooth', 0.06), brew: () => beep(659, 0.1), turn: () => beep(440, 0.04, 'sine', 0.03), win: () => { beep(523, 0.15); setTimeout(() => beep(659, 0.15), 130); setTimeout(() => beep(784, 0.3), 260); } };

// ---- layout ----
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const n = NIGHTS[nightId || 1], top = 64, pad = 8;
  cell = Math.floor(Math.min((W - pad * 2) / n.w, (H - top - pad * 2) / n.h));
  ox = Math.floor((W - cell * n.w) / 2); oy = top + Math.floor((H - top - cell * n.h) / 2);
}
window.addEventListener('resize', resize);

// ---- drawing ----
function drawDrink(d, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#3E1C14'; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.strokeStyle = '#C99A3B'; ctx.stroke();
  const s = r * 0.62;
  if (d === 0) { ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.fillStyle = '#FDE3BD'; ctx.fill(); ctx.beginPath(); ctx.arc(cx - s * 0.3, cy - s * 0.25, s * 0.22, 0, Math.PI * 2); ctx.fillStyle = '#E3C79B'; ctx.fill(); }
  else if (d === 1) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.45 : s * 1.1; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = '#FDAF1E'; ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.fillStyle = '#EB8936'; ctx.fill(); ctx.beginPath(); ctx.arc(cx + s * 0.45, cy - s * 0.1, s * 0.85, 0, Math.PI * 2); ctx.fillStyle = '#3E1C14'; ctx.fill(); }
  ctx.restore();
}
const cc = (x, y) => [ox + x * cell + cell / 2, oy + y * cell + cell / 2];
function drawImgBottom(im, cx, bottom, h) { if (!im || !im.complete || !im.naturalWidth) return; const w = (im.naturalWidth / im.naturalHeight) * h; ctx.drawImage(im, cx - w / 2, bottom - h, w, h); }

function draw(frac) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#14102e'; ctx.fillRect(0, 0, W, H);
  if (!st) return;
  const n = NIGHTS[st.night];
  for (let y = 0; y < n.h; y++) for (let x = 0; x < n.w; x++) { ctx.fillStyle = (x + y) % 2 ? '#241c4d' : '#201946'; ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell); }
  ctx.strokeStyle = 'rgba(201,154,59,.5)'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, cell * n.w, cell * n.h);
  // tables
  for (const [x, y] of n.tables) { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4); ctx.fillStyle = '#a86a3c'; ctx.fillRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell * 0.4); }
  // puddles, shutters, cart, night thief
  for (const [x, y] of n.puddles || []) { ctx.beginPath(); ctx.ellipse(ox + x * cell + cell / 2, oy + y * cell + cell * 0.6, cell * 0.42, cell * 0.24, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(110,180,230,.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,225,250,.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  for (const sh of n.shutters || []) {
    const closed = shutterClosed(n, st.t, sh.x, sh.y), x0 = ox + sh.x * cell, y0 = oy + sh.y * cell;
    if (closed) { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x0 + 1, y0 + 1, cell - 2, cell - 2); ctx.strokeStyle = '#4a2a16'; ctx.lineWidth = 2; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x0 + 2, y0 + (cell * k) / 4); ctx.lineTo(x0 + cell - 2, y0 + (cell * k) / 4); ctx.stroke(); } }
    else { ctx.strokeStyle = 'rgba(201,154,59,.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeRect(x0 + 2, y0 + 2, cell - 4, cell - 4); ctx.setLineDash([]); }
  }
  const cart = cartCell(st);
  if (cart) { ctx.fillStyle = '#c99a3b'; ctx.fillRect(ox + cart[0] * cell + 3, oy + cart[1] * cell + 5, cell - 6, cell - 10); ctx.fillStyle = '#1a0a05'; ctx.fillRect(ox + cart[0] * cell + 3, oy + cart[1] * cell + cell - 8, cell - 6, 3); }
  const thief = thiefCell(st);
  if (thief) { const [hx, hy] = cc(thief[0], thief[1]); ctx.beginPath(); ctx.arc(hx, hy, cell * 0.38, 0, Math.PI * 2); ctx.fillStyle = '#2a1f4a'; ctx.fill(); ctx.strokeStyle = st.thiefCool > 0 ? '#6a5aa0' : '#c2463f'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(hx - cell * 0.13, hy - cell * 0.05, cell * 0.06, 0, Math.PI * 2); ctx.arc(hx + cell * 0.13, hy - cell * 0.05, cell * 0.06, 0, Math.PI * 2); ctx.fill(); }
  // brew spots
  n.brew.forEach((b, i) => { const [cx, cy] = cc(b.x, b.y); ctx.beginPath(); ctx.arc(cx, cy, cell * 0.46, 0, Math.PI * 2); ctx.fillStyle = st.brewCool[i] > 0 ? 'rgba(201,154,59,.15)' : 'rgba(201,154,59,.38)'; ctx.fill(); drawDrink(b.drink, cx, cy, cell * 0.3); });
  // visitor spots and visitors
  const frontWant = st.cups.length ? st.cups[0] : -1, pulse = 0.5 + 0.5 * Math.sin(totalTime / 220);
  n.visitors.forEach((v, i) => {
    const [sx, sy] = cc(v.sx, v.sy), done = st.served[i];
    ctx.fillStyle = done ? 'rgba(120,200,120,.25)' : 'rgba(253,175,30,.22)'; ctx.fillRect(ox + v.sx * cell + 2, oy + v.sy * cell + 2, cell - 4, cell - 4);
    if (!done && v.want === frontWant) { ctx.strokeStyle = 'rgba(255,244,214,' + (0.4 + 0.5 * pulse) + ')'; ctx.lineWidth = 3; ctx.strokeRect(ox + v.sx * cell + 1, oy + v.sy * cell + 1, cell - 2, cell - 2); }
    const [bx, by] = cc(v.bx, v.by), files = VISITOR_FILE[v.who];
    drawImgBottom(IMGS[files[done ? 1 : 0]], bx, oy + (v.by + 1) * cell - 1, cell * 1.75);
    if (!done) {
      const by2 = by - cell * 1.3;
      ctx.fillStyle = 'rgba(20,16,46,.9)'; ctx.beginPath(); ctx.arc(bx, by2, cell * 0.48, 0, Math.PI * 2); ctx.fill();
      if (v.want === frontWant) { ctx.strokeStyle = 'rgba(255,244,214,' + (0.5 + 0.5 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
      drawDrink(v.want, bx, by2, cell * 0.38);
    }
  });
  // Toddy and his line (smoothly between steps)
  const L = (a, b) => a + (b - a) * frac;
  const P = curPts.map((p, i) => { const q = prevPts[i] || p; return { x: L(q.x, p.x), y: L(q.y, p.y) }; });
  for (let k = P.length - 1; k >= 1; k--) { const [cx, cy] = cc(P[k].x, P[k].y); drawDrink(st.cups[k - 1], cx, cy, cell * 0.42); }
  if (P.length > 1) { const [rx, ry] = cc(P[1].x, P[1].y); ctx.beginPath(); ctx.arc(rx, ry, cell * 0.55, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(253,175,30,' + (0.55 + 0.4 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke(); }   // the cup that gets served
  const [tx, ty] = cc(P[0].x, P[0].y);
  ctx.beginPath(); ctx.ellipse(tx, ty + cell * 0.38, cell * 0.32, cell * 0.1, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
  const worried = st.bumped && !st.over;
  drawImgBottom(IMGS[worried ? 'pctoddy_wave_v01' : 'pctoddy_serve_v01'], tx, ty + cell * 0.6, cell * 1.7);
  // guide: a moving dashed line from Toddy to the visitor who wants his first cup
  if (st.cups.length) {
    n.visitors.forEach((v, i) => {
      if (st.served[i] || v.want !== st.cups[0]) return;
      const [gx, gy] = cc(v.sx, v.sy), ang = Math.atan2(gy - ty, gx - tx);
      ctx.save(); ctx.setLineDash([9, 9]); ctx.lineDashOffset = -totalTime / 40; ctx.strokeStyle = 'rgba(255,230,160,.8)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(gx - Math.cos(ang) * cell * 0.45, gy - Math.sin(ang) * cell * 0.45); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(255,230,160,.95)'; ctx.beginPath(); const ax = gx - Math.cos(ang) * cell * 0.3, ay = gy - Math.sin(ang) * cell * 0.3; ctx.moveTo(ax + Math.cos(ang) * 10, ay + Math.sin(ang) * 10); ctx.lineTo(ax + Math.cos(ang + 2.4) * 10, ay + Math.sin(ang + 2.4) * 10); ctx.lineTo(ax + Math.cos(ang - 2.4) * 10, ay + Math.sin(ang - 2.4) * 10); ctx.closePath(); ctx.fill();
    });
  }
  // "Next cup" chip: the cup right behind Toddy is the one that gets served; the visitor wanting it glows
  { const fc = st.cups.length ? st.cups[0] : -1, cw = 132, ch = 44, cx0 = ox, cy0 = Math.max(70, oy - ch - 10);
    ctx.fillStyle = 'rgba(20,16,46,.9)'; ctx.fillRect(cx0, cy0, cw, ch); ctx.strokeStyle = '#C99A3B'; ctx.lineWidth = 2; ctx.strokeRect(cx0, cy0, cw, ch);
    ctx.fillStyle = '#FDE3BD'; ctx.font = '600 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(fc >= 0 ? 'Next cup' : 'No cups!', cx0 + 10, cy0 + 28);
    if (fc >= 0) drawDrink(fc, cx0 + cw - 26, cy0 + ch / 2, 16); }
  if (waiting) {
    const a = 0.5 + 0.5 * Math.sin(totalTime / 260);
    ctx.beginPath(); ctx.arc(tx, ty, cell * (0.75 + 0.12 * a), 0, Math.PI * 2); ctx.strokeStyle = 'rgba(253,175,30,' + (0.5 + 0.4 * a) + ')'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff4d6'; ctx.font = '700 22px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Swipe to start', W / 2, oy + cell * n.h + 34);
    const dy = -8 * a; ctx.fillText('↑', tx, ty - cell * 0.95 + dy);
  }
  // little floating notes
  flashes = flashes.filter((f) => totalTime - f.t0 < 700);
  for (const f of flashes) { const a = 1 - (totalTime - f.t0) / 700, [fx, fy] = cc(f.x, f.y); ctx.globalAlpha = a; ctx.fillStyle = f.color; ctx.font = '700 ' + Math.round(cell * 0.5) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, fx, fy - cell * 0.6 - (1 - a) * cell * 0.8); ctx.globalAlpha = 1; }
}

// ---- game flow ----
function banner(text, ms) { const b = $('banner'); b.textContent = text; b.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), ms || 2500); }
function startNight(id) {
  nightId = id; st = newState(id); turns = []; pendingTurn = null; flashes = []; acc = 0; last = 0;
  prevPts = curPts = pts(st);
  $('overlay').hidden = true; $('overlay').textContent = '';
  resize(); updateHud(); running = true; waiting = true;   // Toddy waits for the first swipe
}
function updateHud() {
  const n = NIGHTS[st.night], c = st.served.filter(Boolean).length;
  $('served').textContent = 'Served ' + c + ' / ' + n.visitors.length;
  $('lanternFill').style.transform = 'scaleX(' + Math.max(0, (st.limit - st.t) / st.limit).toFixed(3) + ')';
}
function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
function showMenu() {
  const o = $('overlay'); o.textContent = ''; o.hidden = false; running = false;
  const card = mk('div', 'card'); card.append(mk('h1', '', 'TODDY Trail'), mk('p', '', '1 · Swipe to walk'), mk('p', '', '2 · Match the cup to a visitor'), mk('p', '', '3 · Step on the glowing square'));
  for (const id of NIGHT_IDS) { const b = mk('button', 'btn', 'Night ' + id + ' · ' + NIGHTS[id].name); b.addEventListener('click', () => { unlockSound(); startNight(id); }); card.append(b); }
  o.append(card);
}
function showResult() {
  const r = score(st), o = $('overlay'); o.textContent = ''; o.hidden = false; running = false;
  const card = mk('div', 'card');
  card.append(mk('h1', '', st.won ? 'All served!' : 'Lanterns out'), mk('div', 'big', String(r.score)), mk('p', '', 'Served ' + r.served + ' of ' + r.of + ' · ' + r.seconds + ' s · spilled ' + (st.spills + st.snatched)));
  const nextId = NIGHT_IDS[NIGHT_IDS.indexOf(nightId) + 1];
  if (st.won && nextId) { const nx = mk('button', 'btn', 'Night ' + nextId + ' · ' + NIGHTS[nextId].name); nx.addEventListener('click', () => startNight(nextId)); card.append(nx); }
  const again = mk('button', 'btn' + (st.won && nextId ? ' alt' : ''), 'Play again'); again.addEventListener('click', () => startNight(nightId));
  const other = mk('button', 'btn alt', 'Pick a night'); other.addEventListener('click', showMenu);
  card.append(again, other); o.append(card);
  if (st.won) SND.win();
}
function unlockSound() { if (soundOn && actx && actx.state === 'suspended') actx.resume(); }

function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now; const dt = Math.min(now - last, 200); last = now; totalTime += dt;
  if (st && running) {
    if (!waiting) acc += dt;
    while (acc >= STEP_MS && !st.over) {
      acc -= STEP_MS;
      prevPts = curPts;
      const turn = pendingTurn; pendingTurn = null;
      if (turn !== null) turns.push([st.t, turn]);
      step(st, turn);
      curPts = pts(st);
      for (const e of st.events) {
        if (e.type === 'serve') { SND.serve(); const v = NIGHTS[st.night].visitors[e.visitor]; flashes.push({ x: v.sx, y: v.sy, t0: totalTime, text: '♥', color: '#ff8fa3' }); }
        else if (e.type === 'sigh') { SND.sigh(); const v = NIGHTS[st.night].visitors[e.visitor]; flashes.push({ x: v.sx, y: v.sy, t0: totalTime, text: 'wrong cup', color: '#ff8f7a' }); }
        else if (e.type === 'spill' || e.type === 'bump') { SND.spill(); flashes.push({ x: st.x, y: st.y, t0: totalTime, text: 'oops', color: '#ff8f7a' }); }
        else if (e.type === 'snatch') { SND.spill(); flashes.push({ x: st.x, y: st.y, t0: totalTime, text: 'snatched!', color: '#ff8f7a' }); }
        else if (e.type === 'brew') { SND.brew(); flashes.push({ x: st.x, y: st.y, t0: totalTime, text: '+1', color: '#fff4d6' }); }
      }
      updateHud();
    }
    if (st.over) { updateHud(); draw(1); showResult(); return; }
  }
  draw(Math.min(acc / STEP_MS, 1));
}

// ---- input: swipe, arrow keys ----
let sx = 0, sy = 0, down = false;
const turnFromDelta = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
const queueTurn = (d) => { pendingTurn = d; waiting = false; SND.turn(); };
cv.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; unlockSound(); });
cv.addEventListener('pointermove', (e) => { if (!down || !running) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) >= 18) { queueTurn(turnFromDelta(dx, dy)); sx = e.clientX; sy = e.clientY; } });
const up = () => { down = false; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
window.addEventListener('keydown', (e) => { const m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 }[e.key]; if (m !== undefined && running) { e.preventDefault(); queueTurn(m); } });
$('btnSound').addEventListener('click', () => { soundOn = !soundOn; $('btnSound').setAttribute('aria-pressed', String(soundOn)); $('btnSound').style.opacity = soundOn ? '1' : '.55'; unlockSound(); beep(660, 0.08); });
$('btnSound').style.opacity = '.55';

Promise.all(['pctoddy_serve_v01', 'pctoddy_wave_v01', ...Object.values(VISITOR_FILE).flat()].map(loadImg)).then(() => {
  resize(); showMenu(); requestAnimationFrame(frame);
});
