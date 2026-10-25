// TODDY Echo Night: private feel test (existing Trail art, no final art). Not in the games list.
import { TPS, NODES, NIGHTS, J, L1, L2, newLoop, step, stationary, edgeLen, servedCount, starsFor, PAR } from './core.js';

const A = 'assets/';
const W = 780, H = 1174; // floor picture size = scene coordinates

// strip definitions (copied from the Trail art notes)
const TODDY = { frame: 192, feet: 178, subj: 140, anims: {
  idle_down: { n: 14, fps: 8, loop: true }, walk_down: { n: 25, fps: 22, loop: true }, walk_up: { n: 22, fps: 22, loop: true },
  walk_right: { n: 24, fps: 22, loop: true }, happy: { n: 30, fps: 14, loop: false }, startled: { n: 16, fps: 12, loop: false },
  win: { n: 36, fps: 12, loop: false } } };
const VIS = { frame: 224, feet: 212, subj: 150, anims: {
  milo_idle: { n: 16, fps: 8, loop: true }, milo_hop: { n: 41, fps: 12, loop: false },
  pip_idle: { n: 12, fps: 8, loop: true }, pip_hop: { n: 35, fps: 12, loop: false },
  lumi_idle: { n: 13, fps: 8, loop: true }, lumi_hop: { n: 45, fps: 12, loop: false } } };

const IMG = {};
function load(name, file) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[name] = i; res(); }; i.onerror = () => rej(new Error('missing ' + file)); i.src = A + file; }); }
const files = { bg: 'trail_bg_n1_v01.webp', station: 'trail_obj_station_v01.webp', ring: 'trail_obj_ring_v01.webp', cup: 'trail_cup_moon_v01.webp',
  badge: 'trail_badge_moon_v01.webp', heart: 'trail_anim_fx_heart_v01.webp', dust: 'trail_anim_fx_dust_v01.webp' };
for (const k of Object.keys(TODDY.anims)) files['t_' + k] = `trail_anim_${k}_v01.webp`;
for (const k of Object.keys(VIS.anims)) files['v_' + k] = `trail_anim_v_${k}_v01.webp`;
for (const w of ['milo', 'pip', 'lumi']) files['imp_' + w] = `trail_cust_${w}_impatient_v01.webp`;

const $ = id => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d');
const off = document.createElement('canvas'); off.width = 192; off.height = 192; const octx = off.getContext('2d');

// ---------- sound (tiny synth, C major) ----------
let actx = null, soundOn = true;
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
function tone(freq, t0, dur, vol = 0.12, type = 'sine') {
  const a = audio(); if (!a || !soundOn) return;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq;
  const t = a.currentTime + t0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, G4 = 392, E4 = 329.63;
const sfx = {
  tap: () => tone(G4, 0, 0.1, 0.08), cup: () => { tone(E5, 0, 0.14); tone(G5, 0.1, 0.18); },
  serve: () => { tone(C5, 0, 0.16); tone(E5, 0.08, 0.16); tone(G5, 0.16, 0.26); },
  won: () => { [C5, E5, G5, C6].forEach((f, i) => tone(f, i * 0.12, 0.3, 0.14)); },
  left: () => tone(E4 / 2, 0, 0.4, 0.1, 'triangle'), ghost: () => { tone(C5, 0, 0.12, 0.06); tone(G5, 0.1, 0.2, 0.06); },
};

// ---------- state ----------
let screen = 'menu';       // menu | play | between | won
let night = NIGHTS[0], logs = [], sim = null, firstTapDone = false;
let acc = 0, last = 0, pendingTap = -1, clockMs = 0;
let fx = [];               // {kind, x, y, t0}
let tAnim = [];            // per toddy override {name, t0}
let visAnim = [];          // per visitor {name, t0}
let bannerT = 0, guide = null;
const GHOST_TINTS = ['rgba(120,170,255,.55)', 'rgba(200,140,255,.55)', 'rgba(110,225,190,.55)', 'rgba(255,205,120,.55)', 'rgba(255,140,170,.55)'];

const HINTS = {
  1: ['Tap the machine', 'Your first Toddy repeats. Serve both!'],
  2: ['The machine needs two hands', 'Now one Toddy holds the second lever'],
  3: ['Three guests. Build a team', ''],
};

let bannerText = '';
function showBanner(text, ms = 2600) { const b = $('banner'); bannerText = text || ''; if (!text) { b.classList.remove('show'); bannerT = 0; return; } b.textContent = text; b.classList.add('show'); bannerT = ms > 0 ? clockMs + ms : 0; }

function startLoop() {
  sim = newLoop(night, logs); acc = 0; pendingTap = -1; fx = []; firstTapDone = false;
  tAnim = sim.toddys.map(() => null); visAnim = sim.visitors.map(() => null);
  screen = 'play'; $('overlay').classList.remove('show'); $('hud').hidden = false; $('bar').hidden = false;
  $('btnEnd').hidden = true;
  updateHud();
  guide = null; $('btnEnd').classList.remove('pulse'); showBanner('');
  if (night.id === 3) showBanner(logs.length === 0 ? 'Serve all three guests' : logs.length === 1 ? 'One echo so far. Add another!' : 'Two echoes. Last Toddy: you!', 4200);
  if (logs.length) sfx.ghost();
}

function updateHud() {
  $('title').textContent = `Night ${night.id} · Loop ${logs.length + 1}`;
  $('helpers').textContent = `Team ${logs.length + 1}`;
  $('served').textContent = `Served ${servedCount(sim)} / ${sim.visitors.length}`;
  $('timerFill').style.transform = `scaleX(${Math.max(0, 1 - sim.tick / night.length)})`;
}

function menu() {
  screen = 'menu'; sim = null; $('hud').hidden = true; $('bar').hidden = true; showBanner('');
  const o = $('overlay'); o.replaceChildren();
  const c = el('div', 'card');
  c.append(el('h1', '', 'Echo Night'), el('p', '', 'Toddy relives the night. Your past runs come back to help.'));
  for (const n of NIGHTS) c.append(btn(`Night ${n.id} · ${n.title}`, () => { night = n; logs = []; startLoop(); }));
  c.append(btn('How it works', howTo, true));
  const note = el('p', '', 'Private feel test. Existing art, rough on purpose.'); note.className = 'small'; c.append(note);
  o.append(c); o.classList.add('show');
}
function howTo() {
  const o = $('overlay'); o.replaceChildren(); const c = el('div', 'card');
  c.append(el('h1', '', 'How it works'));
  for (const t of ['Guests wait for a cup. The ring shows how long.', 'Tap the machine, wait for the cup, then tap a guest.', 'When the loop ends, your run comes back as an echo that repeats you.', 'Serve everyone with the smallest team.']) { const p = el('p', '', t); p.className = 'how'; c.append(p); }
  c.append(btn('Back', menu)); o.append(c);
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
function btn(text, fn, alt) { const b = el('button', 'btn' + (alt ? ' alt' : ''), text); b.type = 'button'; b.addEventListener('click', () => { audio(); fn(); }); return b; }

function computeGuide() {
  if (!sim || screen !== 'play') return null;
  if (sim.visitors.some(v => v.state === 'left') && sim.visitors.every(v => v.state === 'served' || v.state === 'left')) return { btn: 'end', text: 'Guests left. Press End loop' };
  if (night.id > 3 || (night.id === 3 && logs.length > 0)) return null;
  const live = sim.toddys[sim.toddys.length - 1], loop = logs.length, id = night.id, st = stationary(live);
  const carry = () => { const v = sim.visitors.findIndex(q => q.state === 'waiting'); return v >= 0 ? { spot: sim.visitors[v].node, text: 'Carry it to a guest' } : null; };
  if (id === 1) {
    if (!firstTapDone) return { spot: L1, text: loop === 0 ? 'Tap the machine' : 'Your echo is back. Tap the machine' };
    if (live.carrying) return carry();
    if (loop === 0 && servedCount(sim) >= 1) return { btn: 'end', text: 'Too slow for guest 2. End loop' };
    if (st && live.node === L1 && !live.carrying) return { text: 'Wait for the cup' };
    return null;
  }
  if (loop === 0) {
    if (!firstTapDone) return { spot: L2, text: 'Two hands needed. Tap this lever' };
    if (st && live.node === L2) return { btn: 'end', text: 'Hold it. Press End loop' };
    return null;
  }
  if (!firstTapDone) return { spot: L1, text: 'Echo holds one lever. Tap the other' };
  if (live.carrying) return carry();
  if (st && live.node === L1) return { text: 'Wait for the cup' };
  return null;
}

function endLoop() {
  const won = sim.status === 'won';
  if (!sim.status || sim.status === 'running') { sim.status = 'timeup'; sim.endTick = sim.tick; }
  const o = $('overlay'); o.replaceChildren(); const c = el('div', 'card');
  const nextN = NIGHTS.find(n => n.id === night.id + 1);
  if (won) {
    const loops = logs.length + 1, stars = starsFor(night.id, loops);
    screen = 'won'; sfx.won();
    c.append(el('h1', '', 'Night cleared'), el('div', 'stars', '★'.repeat(stars) + '☆'.repeat(3 - stars)),
      el('p', '', `Team of ${loops} (you + ${loops - 1} echo${loops > 2 ? 'es' : ''}) · ${(sim.endTick / TPS).toFixed(1)} s`));
    if (stars < 3) c.append(el('p', '', `Clear it with a team of ${PAR[night.id]} for 3 stars`));
    if (nextN) c.append(btn(`Next: Night ${nextN.id}`, () => { night = nextN; logs = []; startLoop(); }));
    c.append(btn('Play this night again', () => { logs = []; startLoop(); }, true), btn('Menu', menu, true));
  } else {
    screen = 'between';
    c.append(el('h1', '', "Loop over"), el('p', '', `${servedCount(sim)} of ${sim.visitors.length} served. Your run will come back as an echo and repeat itself.`));
    c.append(btn('Add the echo and play again', () => { logs = logs.concat([sim.liveLog.slice()]); startLoop(); }),
      btn('Redo this loop', startLoop, true), btn('Start the night over', () => { logs = []; startLoop(); }, true));
  }
  o.append(c); o.classList.add('show'); $('btnEnd').hidden = true;
}

// ---------- input ----------
function sceneScale() { return Math.min(canvas.width / W, canvas.height / H); }
canvas.addEventListener('pointerdown', ev => {
  if (screen !== 'play') return;
  audio();
  const r = canvas.getBoundingClientRect(), k = canvas.width / r.width / sceneScale();
  const px = (ev.clientX - r.left) * k, py = (ev.clientY - r.top) * k;
  let best = -1, bd = 1e9;
  NODES.forEach((n, i) => { if (!n.tap) return; const d = Math.hypot(n.x - px, (n.y - 60) - py); const d2 = Math.hypot(n.x - px, n.y - py); const dd = Math.min(d, d2); if (dd < bd) { bd = dd; best = i; } });
  if (best >= 0 && bd < 150) { pendingTap = best; sfx.tap(); firstTapDone = true; $('btnEnd').hidden = false; showBanner(''); }
});
$('btnRedo').addEventListener('click', () => { if (screen === 'play') startLoop(); });
$('btnEnd').addEventListener('click', () => { if (screen === 'play') { sim.status = 'timeup'; sim.endTick = sim.tick; endLoop(); } });
$('btnMenu').addEventListener('click', menu);
$('btnSound').addEventListener('click', () => { soundOn = !soundOn; $('btnSound').setAttribute('aria-pressed', String(soundOn)); $('btnSound').textContent = soundOn ? '♪' : '✕'; });

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight, asp = W / H;
  let cw = w, ch = w / asp; if (ch > h) { ch = h; cw = h * asp; }
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
}
window.addEventListener('resize', resize);

// ---------- drawing ----------
function stripFrame(def, name, ms, t0) {
  const a = def.anims[name], f = Math.floor((ms - t0) / 1000 * a.fps * (name.startsWith('walk') ? 1.5 : 1));
  return a.loop ? ((f % a.n) + a.n) % a.n : Math.min(a.n - 1, Math.max(0, f));
}
function drawStrip(g, img, def, frame, x, feetY, scale, flip) {
  const w = def.frame, dw = w * scale;
  g.save(); g.translate(x, feetY - def.feet * scale); if (flip) { g.scale(-1, 1); }
  g.drawImage(img, frame * w, 0, w, w, flip ? -dw / 2 : -dw / 2, 0, dw, dw); g.restore();
}
function toddyPos(td) {
  const a = NODES[td.node];
  if (td.to === -1) return { x: a.x, y: a.y, dx: 0, dy: 1, moving: false };
  const b = NODES[td.to], f = td.p / edgeLen(td.node, td.to);
  const dx = b.x - a.x, dy = b.y - a.y;
  return { x: a.x + dx * f, y: a.y + dy * f, dx, dy, moving: true };
}
function facing(p) {
  if (!p.moving) return { name: 'idle_down', flip: false };
  if (Math.abs(p.dy) > Math.abs(p.dx) * 0.9) return { name: p.dy > 0 ? 'walk_down' : 'walk_up', flip: false };
  return { name: 'walk_right', flip: p.dx < 0 };
}

function render(ms) {
  const s = sceneScale();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.drawImage(IMG.bg, 0, 0, W, H);
  const state = sim;
  const draws = []; // depth sorted by y
  // spot rings
  for (let i = 0; i < NODES.length; i++) {
    if (!NODES[i].tap) continue;
    const n = NODES[i];
    ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(ms / 400 + i); ctx.drawImage(IMG.ring, n.x - 70, n.y - 24, 140, 97); ctx.restore();
  }
  if (!state) return;
  // stations at levers
  night.levers.forEach((lv, idx) => {
    const n = NODES[lv];
    const held = state.toddys.some(td => stationary(td) && td.node === lv);
    draws.push({ y: n.y - 5, f: () => {
      ctx.drawImage(IMG.station, n.x - 86, n.y - 250, 172, 231);
      // lever lamp and progress
      ctx.save(); ctx.beginPath(); ctx.arc(n.x, n.y - 262, 16, 0, Math.PI * 2);
      ctx.fillStyle = held ? '#FCE25D' : 'rgba(20,16,46,.8)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#FDAF1E'; ctx.stroke();
      if (!held && state.night.levers.length > 1 && state.toddys.some(t2 => stationary(t2) && state.night.levers.includes(t2.node))) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(ms / 160); ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      }
      if (idx === 0 && state.progress > 0) { ctx.beginPath(); ctx.arc(n.x, n.y - 262, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.progress / state.night.hold); ctx.lineWidth = 8; ctx.strokeStyle = '#7CFC9A'; ctx.stroke(); }
      ctx.restore();
    } });
  });
  // visitors
  state.visitors.forEach((v, i) => {
    if (v.state === 'away') return;
    const n = NODES[v.node], x = n.x, feet = n.y - 70;
    draws.push({ y: feet, f: () => {
      const sc = 0.95;
      if (v.state === 'left') { ctx.save(); ctx.globalAlpha = 0.5; const im = IMG['imp_' + v.who]; ctx.drawImage(im, x - im.width * 0.4, feet - im.height * 0.8, im.width * 0.8, im.height * 0.8); ctx.restore();
        ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('left', x, feet - 150); return; }
      const va = visAnim[i];
      let img = IMG['v_' + v.who + '_idle'], def = VIS, frame = stripFrame(VIS, v.who + '_idle', ms, 0);
      if (v.state === 'served') {
        const t0 = va ? va.t0 : ms; const a = VIS.anims[v.who + '_hop'];
        const fr = Math.floor((ms - t0) / 1000 * a.fps);
        if (fr < a.n) { img = IMG['v_' + v.who + '_hop']; frame = fr; }
      }
      drawStrip(ctx, img, def, frame, x, feet, sc, false);
      const top = feet - VIS.subj * sc - 38;
      if (v.state === 'waiting') {
        const left = 1 - (state.tick - v.arrive) / v.patience;
        ctx.save(); ctx.drawImage(IMG.badge, x - 30, top - 30, 60, 60);
        ctx.beginPath(); ctx.arc(x, top, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, left)); ctx.lineWidth = 9;
        ctx.strokeStyle = left < 0.25 ? '#ff5a5a' : '#FDAF1E'; ctx.stroke(); ctx.restore();
      } else if (v.state === 'served') { ctx.fillStyle = '#7CFC9A'; ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✓', x, top + 14); }
    } });
  });
  // toddys
  state.toddys.forEach((td, i) => {
    const p = toddyPos(td), ghost = i < state.toddys.length - 1;
    if (ghost) p.x += (i % 2 ? 1 : -1) * 34 * (Math.floor(i / 2) + 1);
    draws.push({ y: p.y + (ghost ? -1 : 1), f: () => {
      let fa = facing(p), name = fa.name, t0 = 0;
      const ov = tAnim[i]; if (ov && ms - ov.t0 < 1300 && !p.moving) { name = ov.name; t0 = ov.t0; }
      const frame = stripFrame(TODDY, name, ms, t0), img = IMG['t_' + name], sc = 1.15;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 40, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (ghost) {
        octx.clearRect(0, 0, 192, 192); octx.globalCompositeOperation = 'source-over';
        octx.drawImage(img, frame * 192, 0, 192, 192, 0, 0, 192, 192);
        octx.globalCompositeOperation = 'source-atop'; octx.fillStyle = GHOST_TINTS[i % GHOST_TINTS.length]; octx.fillRect(0, 0, 192, 192);
        ctx.save(); ctx.globalAlpha = 0.78; ctx.translate(p.x, p.y - TODDY.feet * sc); if (fa.flip) ctx.scale(-1, 1);
        ctx.drawImage(off, -96 * sc, 0, 192 * sc, 192 * sc); ctx.restore();
      } else drawStrip(ctx, img, TODDY, frame, p.x, p.y, sc, fa.flip);
      if (td.carrying) { const ox = fa.flip ? -26 : 26; ctx.save(); if (ghost) ctx.globalAlpha = 0.8; ctx.drawImage(IMG.cup, p.x + ox - 20, p.y - 118, 40, 63); ctx.restore(); }
      ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 24px sans-serif';
      const label = ghost ? 'echo' : 'YOU', ty = p.y - 196;
      ctx.fillStyle = ghost ? 'rgba(20,16,46,.75)' : '#FDAF1E'; const tw = ctx.measureText(label).width + 20;
      ctx.beginPath(); ctx.roundRect(p.x - tw / 2, ty - 22, tw, 30, 15); ctx.fill();
      ctx.fillStyle = ghost ? '#cfe0ff' : '#14102e'; ctx.fillText(label, p.x, ty); ctx.restore();
    } });
  });
  draws.sort((a, b) => a.y - b.y).forEach(d => d.f());
  if (guide && guide.spot >= 0 && screen === 'play') {
    const n = NODES[guide.spot], bob = Math.sin(ms / 220) * 10;
    ctx.save(); ctx.globalAlpha = 0.55 + 0.35 * Math.sin(ms / 220); ctx.lineWidth = 8; ctx.strokeStyle = '#FDAF1E';
    ctx.beginPath(); ctx.ellipse(n.x, n.y + 24, 86 + bob, 34 + bob / 3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.fillStyle = '#FDAF1E'; ctx.strokeStyle = '#14102e'; ctx.lineWidth = 5; ctx.beginPath();
    const ay = n.y - 215 + bob; ctx.moveTo(n.x, ay + 40); ctx.lineTo(n.x - 28, ay); ctx.lineTo(n.x + 28, ay); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
  // effects
  fx = fx.filter(e => ms - e.t0 < 900);
  for (const e of fx) {
    const fr = Math.min(25, Math.floor((ms - e.t0) / 1000 * 14)), im = IMG[e.kind];
    if (im) ctx.drawImage(im, fr * 144, 0, 144, 144, e.x - 72, e.y - 72, 144, 144);
  }
}

// ---------- loop ----------
function handleEvents() {
  for (const e of sim.events) {
    if (e.type === 'cup') { sfx.cup();  const p = toddyPos(sim.toddys[e.who]); tAnim[e.who] = { name: 'happy', t0: clockMs }; fx.push({ kind: 'dust', x: p.x, y: p.y - 60, t0: clockMs }); }
    if (e.type === 'serve') { sfx.serve(); visAnim[e.v] = { t0: clockMs }; tAnim[e.who] = { name: 'happy', t0: clockMs }; const n = NODES[sim.visitors[e.v].node]; fx.push({ kind: 'heart', x: n.x, y: n.y - 200, t0: clockMs }); }
    if (e.type === 'left') { sfx.left(); }
  }
  sim.events.length = 0;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(100, now - last); last = now; clockMs = now;
  if (bannerT && clockMs > bannerT) { showBanner(''); bannerT = 0; }
  if (screen === 'play' && sim && sim.status === 'running') {
    acc += dt;
    const per = 1000 / TPS; let n = 0;
    while (acc >= per && n < 6 && sim.status === 'running') {
      step(sim, pendingTap); pendingTap = -1; acc -= per; n++;
      handleEvents();
    }
    updateHud();
    guide = computeGuide();
    const gt = guide ? guide.text : '';
    if ((night.id <= 2 || gt) && gt !== bannerText && (guide || bannerText)) showBanner(gt, 0);
    $('btnEnd').classList.toggle('pulse', !!(guide && guide.btn === 'end'));
    if (sim.status !== 'running') { setTimeout(endLoop, sim.status === 'won' ? 1100 : 500); screen = 'ending'; }
  }
  render(now);
}

Promise.all(Object.entries(files).map(([k, f]) => load(k, f))).then(() => {
  resize(); menu(); last = performance.now(); requestAnimationFrame(frame);
  window.__echo = { get sim() { return sim; }, get screen() { return screen; }, tap: i => { pendingTap = i; }, startNight: id => { night = NIGHTS.find(n => n.id === id); logs = []; startLoop(); }, get logs() { return logs; }, setLogs: l => { logs = l; startLoop(); } };
}).catch(e => { document.body.textContent = 'Could not load art: ' + e.message; });
