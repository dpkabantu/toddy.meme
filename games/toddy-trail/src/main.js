// TODDY Trail test page: canvas, hold-and-steer, approved art and animations. No server yet.
// The rules live in core.js (pure and deterministic). Everything in this file is only drawing and input.
import { NIGHTS, NIGHT_IDS, SAMPLE_IDS, registerLevel, STEPS_PER_SEC, newState, step, score, cartCell, thiefCell, shutterClosed, DX, DY } from './core.js';
import { ANIMS, STILLS, BGS } from './art.js';
import { createMusic } from './music.js';
import { ENDLESS } from './endless-config.js';
const music = createMusic();
let musicGo = false;   // music starts only after the first tap (phones block sound before that)

const $ = (id) => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const SPEEDS = { Relaxed: 2.6, Normal: STEPS_PER_SEC, Quick: 5 };   // how fast Toddy walks (cells per second); the rules count steps, so scores stay fair
let speedName = 'Relaxed'; try { const v = localStorage.getItem('trailSpeed'); if (SPEEDS[v]) speedName = v; } catch (_) { /* storage optional */ }
let STEP_MS = 1000 / SPEEDS[speedName];
const IMGS = {}, LOADING = {};
const loadImg = (name) => LOADING[name] || (LOADING[name] = new Promise((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = 'assets/' + name + '.webp'; IMGS[name] = im; }));
const ready = (name) => { const im = IMGS[name]; return im && im.complete && im.naturalWidth ? im : null; };
const VISITOR_BASE = { milo: 'visitor_milo_v02', pip: 'visitor_pip_v01', velvet: 'visitor_velvet_v01', lumi: 'visitor_lumi_v01', biscuit: 'visitor_biscuit_v01', drizzle: 'visitor_drizzle_v01', pebble: 'visitor_pebble_v01', bao: 'visitor_bao_v01', nova: 'visitor_nova_v01', maple: 'visitor_maple_v01', cosmo: 'visitor_cosmo_v01' };
// which extra pictures exist per visitor (the newer visitors are still getting their set; only listed files are ever requested)
const CUST = { milo: ['impatient', 'receive', 'sigh'], pip: ['impatient', 'receive', 'sigh'], velvet: ['impatient', 'receive', 'sigh'], lumi: ['impatient', 'receive', 'sigh'], biscuit: ['impatient', 'receive', 'sigh'], drizzle: ['receive'], pebble: ['receive'], bao: ['receive'], nova: ['impatient', 'receive'], maple: ['impatient', 'receive', 'sigh'], cosmo: ['impatient', 'receive'], fizz: ['receive'], tilly: ['receive'] };
const DRINK_NAMES = ['moon', 'star', 'crescent', 'sun', 'heart'];
const animFile = (k) => 'trail_anim_' + k + '_v01', objFile = (k) => 'trail_obj_' + k + '_v01', custFile = (w, p) => 'trail_cust_' + w + '_' + p + '_v01';

// what each night puts on the floor (the obstacle picture and how tall it stands, in cells)
const ENDLESS_ID = 1000;
let endless = null;   // { n, recipe } while an endless run is on
const ART_OF = { 20: 7 };   // sample levels borrow a story night's background, music and obstacle pictures
const artOf = (id) => ART_OF[id] || id;
const nm = (id) => (id === ENDLESS_ID && endless ? 'Level ' + endless.n : (SAMPLE_IDS.includes(id) ? 'Level ' : 'Night ') + id);
const MUSIC_OF = { 101: 2, 102: 3, 103: 6, 104: 5, 105: 6, 1: 'menu' };   // endless floors borrow a story night's music
const obstacleOf = (id) => OBSTACLE[artOf(id)] || OBSTACLE[2];
const OBSTACLE = { 101: ['planter', 1.45], 102: ['suitcases', 1.75], 103: ['rope', 1.3], 104: ['snowman', 1.55], 105: ['telescope', 1.7], 2: ['table', 1.85], 3: ['crates', 1.45], 4: ['barrel', 1.2], 5: ['shelf', 1.35], 6: ['post', 1.3], 7: ['speaker', 1.6] };

let st = null, nightId = 0, turns = [], heldDir = null, lastSent = 4, running = false, waiting = false, last = 0, acc = 0;
let prevMov = false, prevDirV = -1, jiggleAt = -9999, confettiAt = -99999;   // picture-only: body squash, cup wobble, win confetti
let prevPts = [], curPts = [], flashes = [], fx = [], soundOn = true, actx = null, bannerTimer = 0, totalTime = 0;
let W = 0, H = 0, DPR = 1, cell = 30, ox = 0, oy = 0;
// drawing-only state (never read by the rules)
let servedAt = [], tod = null, lastMoveAt = -9999, sighUntil = [], endAt = 0, thiefPrev = null, thiefFlip = false, thiefSnatchAt = -9999, brewAt = [], shutterAt = {}, shutterWas = {};

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
const SND = Object.fromEntries(['serve', 'sigh', 'spill', 'brew', 'turn', 'win', 'bump', 'slide', 'snatch'].map((k) => [k, () => { if (soundOn && musicGo) music.sfx(k); }]));

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

// ---- small drawing helpers ----
function drawDrink(d, cx, cy, r) {   // the approved round badge picture; the drawn circle below is only a fallback while it loads
  const im = ready('trail_badge_' + DRINK_NAMES[d] + '_v01');
  if (im) { ctx.drawImage(im, cx - r * 1.12, cy - r * 1.12, r * 2.24, r * 2.24); return; }
  drawDrinkFallback(d, cx, cy, r);
}
function steam(cx, cy, h) {   // soft wisps rising from a hot cup
  for (let k = 0; k < 3; k++) {
    const p = (totalTime / 1700 + k / 3) % 1, x = cx + Math.sin(p * 7 + k * 2.1) * h * 0.14, y = cy - h * 0.42 - p * h * 0.95;
    ctx.globalAlpha = 0.42 * Math.sin(p * Math.PI); ctx.fillStyle = '#fff4e6'; ctx.beginPath(); ctx.arc(x, y, h * (0.07 + 0.1 * p), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// where the real cup is while a visitor sips (fraction of the visitor's height above the feet; seconds into the sip clip). Measured from the approved sip clips.
const VTRACK = {
  milo: [[0, 0.36], [0.5, 0.36], [0.75, 0.48], [1.0, 0.57], [2.5, 0.57], [2.85, 0.4], [3.0, 0.36]],
  pip: [[0, 0.34], [0.5, 0.36], [0.75, 0.44], [1.0, 0.47], [2.5, 0.48], [2.8, 0.38], [3.0, 0.34]],
  velvet: [[0, 0.34], [0.5, 0.36], [1.0, 0.42], [1.5, 0.46], [1.75, 0.5], [2.5, 0.5], [2.8, 0.4], [3.0, 0.36]],
  lumi: [[0, 0.34], [0.5, 0.38], [0.75, 0.46], [1.0, 0.5], [2.5, 0.52], [2.8, 0.4], [3.0, 0.35]],
  biscuit: [[0, 0.3], [0.5, 0.32], [0.8, 0.38], [1.1, 0.43], [2.5, 0.44], [2.85, 0.36], [3.1, 0.3]],
  drizzle: [[0, 0.33], [0.75, 0.35], [1.25, 0.44], [1.6, 0.5], [3.0, 0.5], [3.4, 0.4], [3.75, 0.34]],
  pebble: [[0, 0.33], [1, 0.33]],
  bao: [[0, 0.33], [1, 0.33]],
  maple: [[0, 0.32], [0.6, 0.34], [1.3, 0.44], [1.8, 0.48], [2.9, 0.48], [3.3, 0.38], [3.8, 0.32]],
  nova: [[0, 0.33], [1, 0.33]],
  cosmo: [[0, 0.33], [1, 0.33]],
  fizz: [[0, 0.33], [1, 0.33]],
  tilly: [[0, 0.33], [1, 0.33]],
};
const belly = (who) => (VTRACK[who] || VTRACK.milo)[0][1];
function sipFrac(who, t) {
  const k = VTRACK[who] || VTRACK.milo; if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const u = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]), e = u * u * (3 - 2 * u); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * e; }
  return k[k.length - 1][1];
}
function drawCup(d, cx, cy, h) {   // the approved cup picture, centred on (cx, cy)
  const im = ready('trail_cup_' + DRINK_NAMES[d] + '_v01');
  if (!im) { drawDrinkFallback(d, cx, cy, h * 0.4); return; }
  const w = (im.naturalWidth / im.naturalHeight) * h; ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
}
function drawDrinkFallback(d, cx, cy, r) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = ['#2F4E9F', '#9A2F55', '#2E7A52', '#C98A2B', '#7A4AA8'][d] || '#3E1C14'; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = '#FFF4D6'; ctx.stroke();
}
const cc = (x, y) => [ox + x * cell + cell / 2, oy + y * cell + cell / 2];
function drawImgBottom(im, cx, bottom, h) { if (!im) return; const w = (im.naturalWidth / im.naturalHeight) * h; ctx.drawImage(im, cx - w / 2, bottom - h, w, h); }
// a cut-out picture standing on a cell: centred on the cell, feet at the cell's bottom edge
function drawStill(key, cx, bottom, hCells, maxWCells) {
  const im = ready(objFile(key)), m = STILLS[key]; if (!im || !m) return;
  let h = hCells * cell, w = (m[0] / m[1]) * h; const mw = (maxWCells || 1.25) * cell; if (w > mw) { h *= mw / w; w = mw; }
  ctx.drawImage(im, cx - w / 2, bottom - h, w, h);
}
// one frame of an animation strip; the subject (feet line at a.feet) stands at (cx, bottom) and is subjH tall
function animIndex(key, t) { const a = ANIMS[key]; const f = Math.floor((t / 1000) * a.fps); return a.loop ? ((f % a.n) + a.n) % a.n : Math.max(0, Math.min(a.n - 1, f)); }
function drawStrip(file, key, i, cx, bottom, subjH, flip) {
  const im = ready(file), a = ANIMS[key]; if (!im) return;
  const k = subjH / a.subj, w = a.w * k, h = a.h * k;
  ctx.save(); if (flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
  ctx.drawImage(im, i * a.w, 0, a.w, a.h, cx - w / 2, bottom - a.feet * k, w, h); ctx.restore();
}
function drawCentered(file, key, i, cx, cy, size, alpha) {   // effects: the square strip frame centred on (cx, cy), `size` pixels wide
  const im = ready(file), a = ANIMS[key]; if (!im) return;
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(im, i * a.w, 0, a.w, a.h, cx - size / 2, cy - size / 2, size, size); ctx.globalAlpha = 1;
}

// ---- Toddy's animation (picture only) ----
const dirFlip = (d) => d === 3;
function setTod(key, dir, ms, tag) { tod = { key, flip: dirFlip(dir), t0: totalTime, until: totalTime + ms, tag }; }
function toddyPicture() {   // which strip and frame to show right now
  const moving = totalTime - lastMoveAt < STEP_MS * 1.6;
  if (tod && totalTime < tod.until) {
    if (tod.tag === 'cancelOnMove' && moving && totalTime - tod.t0 > 220) tod = null;
    else return { key: tod.key, i: animIndex(tod.key, totalTime - tod.t0), flip: tod.flip };
  }
  const d = st.dir;
  if (moving && st.holding && !st.bumped) { if (d === 2) return { key: 'walk_down', i: animIndex('walk_down', totalTime), flip: false }; if (d === 0) return { key: 'walk_up', i: animIndex('walk_up', totalTime), flip: false }; return { key: 'walk_right', i: animIndex('walk_right', totalTime), flip: d === 3 }; }
  if (d === 0 && st.t > 0) return { key: 'walk_up', i: 0, flip: false };
  return { key: 'idle_down', i: animIndex('idle_down', totalTime), flip: false };
}
// where the cup sits in Toddy's paws (feet at ty + cell/2): in front of his chest, a little toward the side he faces
function pawPos(tx, ty, key, flip) { const side = key === 'walk_right' || key.startsWith('hand_right') ? (flip ? -1 : 1) : 0; return [tx + side * cell * 0.3, ty + cell * 0.5 - cell * 0.62]; }
function faceVisitor(v) { const dx = v.bx - st.x, dy = v.by - st.y; return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0); }

// ---- the scene ----
function drawFloor(n) {
  const m = BGS[artOf(st.night)], im = m && ready('trail_bg_n' + artOf(st.night) + '_v01');
  if (im) {
    const sx = (cell * n.w) / m.fw, sy = (cell * n.h) / m.fh;
    ctx.drawImage(im, ox - m.fx * sx, oy - m.fy * sy, m.w * sx, m.h * sy);
  } else {   // stand-in floor until that night's picture is approved
    for (let y = 0; y < n.h; y++) for (let x = 0; x < n.w; x++) { ctx.fillStyle = (x + y) % 2 ? '#2e2258' : '#352a64'; ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell); }
    ctx.strokeStyle = 'rgba(201,154,59,.5)'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, cell * n.w, cell * n.h);
  }
}

const wrap = (v, m) => ((v % m) + m) % m;
function ambient(n) {   // floating dust in the lamplight, a soft warm flicker, and rain on Night 4 (pictures only)
  const W = cell * n.w, H = cell * n.h;
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, W, H); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(ox + W / 2, oy, 0, ox + W / 2, oy, W * 1.1); const fl = 0.05 + 0.02 * Math.sin(totalTime / 700) + 0.012 * Math.sin(totalTime / 130);
  g.addColorStop(0, 'rgba(255,190,100,' + fl + ')'); g.addColorStop(1, 'rgba(255,190,100,0)'); ctx.fillStyle = g; ctx.fillRect(ox, oy, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const rain = st.night === 4;
  for (let k = 0; k < (rain ? 8 : 22); k++) {
    const px = ox + wrap((k * 0.618) * W + Math.sin(totalTime / 2600 + k) * cell * 0.3 + totalTime * 0.012 * (1 + (k % 3) * 0.4), W), py = oy + wrap((k * 0.7548) * H - totalTime * 0.01 * (1 + (k % 4) * 0.3), H);
    ctx.fillStyle = 'rgba(255,232,180,' + (0.22 + 0.18 * Math.sin(totalTime / 900 + k * 1.7)) + ')'; ctx.beginPath(); ctx.arc(px, py, cell * (0.018 + 0.012 * (k % 3)), 0, Math.PI * 2); ctx.fill();
  }
  if (rain) {
    ctx.strokeStyle = 'rgba(190,215,255,.32)'; ctx.lineWidth = Math.max(1, cell * 0.02); ctx.beginPath();
    for (let k = 0; k < 70; k++) { const px = ox + wrap(k * 0.381966 * W * 3 + totalTime * 0.05, W + cell) - cell * 0.5, py = oy + wrap(k * 0.7071 * H * 5 + totalTime * 0.7 * (0.8 + (k % 5) * 0.1), H + cell) - cell * 0.5; ctx.moveTo(px, py); ctx.lineTo(px - cell * 0.08, py + cell * 0.38); }
    ctx.stroke();
    ctx.lineWidth = Math.max(1, cell * 0.018);
    for (let k = 0; k < 9; k++) { const ph = wrap(totalTime / 900 + k * 0.37, 1), px = ox + wrap(k * 0.618 * W * 7, W), py = oy + wrap(k * 0.4142 * H * 11, H); ctx.strokeStyle = 'rgba(200,225,255,' + 0.3 * (1 - ph) + ')'; ctx.beginPath(); ctx.ellipse(px, py, cell * 0.32 * ph, cell * 0.12 * ph, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
  if (totalTime - confettiAt < 3800) {   // win confetti
    const cols = ['#FDAF1E', '#E04F7B', '#4FB3A0', '#6C8CFF', '#FFF4D6', '#B07CFF'];
    for (let k = 0; k < 70; k++) {
      const age = totalTime - confettiAt - (k % 14) * 90; if (age < 0) continue;
      const x = ox + wrap(k * 0.618 * W * 3, W) + Math.sin(age / 400 + k) * cell * 0.4, y = oy - cell * 0.4 + age * (H / 2600) * (0.75 + (k % 5) * 0.12);
      ctx.save(); ctx.translate(x, y); ctx.rotate(age / 220 + k); ctx.globalAlpha = Math.min(1, (3800 - age) / 500); ctx.fillStyle = cols[k % 6]; ctx.fillRect(-cell * 0.06, -cell * 0.03 * (1 + Math.sin(age / 90 + k)), cell * 0.12, cell * 0.06); ctx.restore();
    }
  }
}
function draw(frac) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#14102e'; ctx.fillRect(0, 0, W, H);
  if (!st) return;
  const n = NIGHTS[st.night], pulse = 0.5 + 0.5 * Math.sin(totalTime / 220);
  drawFloor(n);
  // visitor spots (the square in front of each visitor) and brew rings are drawn on the floor
  const frontWant = st.cups.length ? st.cups[0] : -1;
  let targetIdx = -1, bestD = 1e9;   // the ONE visitor to go to: nearest of those who want the first cup
  n.visitors.forEach((v, i) => { if (!st.served[i] && v.want === frontWant) { const d = Math.abs(v.sx - st.x) + Math.abs(v.sy - st.y); if (d < bestD) { bestD = d; targetIdx = i; } } });
  n.visitors.forEach((v, i) => {
    const done = st.served[i];
    ctx.fillStyle = done ? 'rgba(120,200,120,.22)' : 'rgba(253,175,30,.2)'; ctx.fillRect(ox + v.sx * cell + 2, oy + v.sy * cell + 2, cell - 4, cell - 4);
    if (!done && i === targetIdx) { ctx.strokeStyle = 'rgba(255,244,214,' + (0.4 + 0.5 * pulse) + ')'; ctx.lineWidth = 3; ctx.strokeRect(ox + v.sx * cell + 1, oy + v.sy * cell + 1, cell - 2, cell - 2); }
  });
  n.brew.forEach((b, i) => {
    const [cx, cy] = cc(b.x, b.y), cool = st.brewCool[i] > 0, ring = ready(objFile('ring')), rm = STILLS.ring;
    if (ring && rm) { const w = cell * 1.0, h = (rm[1] / rm[0]) * w; ctx.globalAlpha = cool ? 0.45 : 1; ctx.drawImage(ring, cx - w / 2, cy + cell * 0.12 - h / 2, w, h); ctx.globalAlpha = 1; }
    else { ctx.beginPath(); ctx.arc(cx, cy, cell * 0.46, 0, Math.PI * 2); ctx.fillStyle = cool ? 'rgba(201,154,59,.15)' : 'rgba(201,154,59,.38)'; ctx.fill(); }
  });
  // puddles lie on the floor and ripple in the rain
  for (const [x, y] of n.puddles || []) {
    const [cx, cy] = cc(x, y);
    if (ready(animFile('puddle_ripple'))) { const size = cell * 1.12; drawCentered(animFile('puddle_ripple'), 'puddle_ripple', animIndex('puddle_ripple', totalTime + x * 311 + y * 97), cx, cy + cell * 0.12, size); }
    else { ctx.beginPath(); ctx.ellipse(cx, cy + cell * 0.1, cell * 0.42, cell * 0.24, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(110,180,230,.55)'; ctx.fill(); }
  }

  // everything that stands up is drawn back to front, so Toddy walks behind tall things and in front of the ones behind him
  const items = [];
  const bottomOf = (y) => oy + (y + 1) * cell - cell * 0.04;
  const ob = obstacleOf(st.night);
  for (const [x, y] of n.tables) items.push({ y, f: () => {
    if (ob && ready(objFile(ob[0]))) drawStill(ob[0], cc(x, y)[0], bottomOf(y), ob[1] * (n.tables.length > 12 ? 0.74 : 1));
    else { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4); ctx.fillStyle = '#a86a3c'; ctx.fillRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell * 0.4); }
  } });
  n.brew.forEach((b, i) => items.push({ y: b.y - 0.18, f: () => {
    const [cx] = cc(b.x, b.y), bottom = oy + b.y * cell + cell * 0.62, playing = totalTime - (brewAt[i] || -9999) < 1500;
    if (playing && ready(animFile('brew_pour'))) drawStrip(animFile('brew_pour'), 'brew_pour', animIndex('brew_pour', totalTime - brewAt[i]), cx, bottom, cell * 1.35 * (ANIMS.brew_pour.subj / 170), false);
    else drawStill('station', cx, bottom, 1.35, 1.2);
    drawDrink(b.drink, cx + cell * 0.46, bottom - cell * 1.2, cell * 0.2);
  } }));
  for (let k = 0; k < (n.shutters || []).length; k++) {
    const sh = n.shutters[k], closed = shutterClosed(n, st.t, sh.x, sh.y), key = sh.x + ',' + sh.y;
    if (shutterWas[key] !== closed) { shutterWas[key] = closed; shutterAt[key] = totalTime; }
    items.push({ y: sh.y, f: () => {
      const [cx] = cc(sh.x, sh.y), bottom = bottomOf(sh.y), p = Math.min(1, (totalTime - (shutterAt[key] || -9999)) / 350);
      // the shutter slides: closing covers the open picture from the top, opening reveals it
      const open = ready(objFile('shutter_open')), shut = ready(objFile('shutter_closed')), mm = STILLS.shutter_closed; if (!open || !shut || !mm) return;
      let h = 1.3 * cell, w = (mm[0] / mm[1]) * h; if (w > cell * 1.1) { h *= (cell * 1.1) / w; w = cell * 1.1; }
      ctx.drawImage(open, cx - w / 2, bottom - h, w, h);
      const cover = closed ? p : 1 - p;   // 0..1 how much of the closed picture is shown
      if (cover > 0) { const ch = h * cover; ctx.drawImage(shut, 0, 0, shut.naturalWidth, shut.naturalHeight * cover, cx - w / 2, bottom - h, w, ch); }
    } });
  }
  const cart = cartCell(st);
  if (cart) items.push({ y: cart[1], f: () => { const [cx] = cc(cart[0], cart[1]); drawStill('cart', cx, bottomOf(cart[1]), 1.0, 1.75); } });
  const thief = thiefCell(st);
  if (thief) {
    if (thiefPrev && (thiefPrev[0] !== thief[0])) thiefFlip = thief[0] < thiefPrev[0];
    thiefPrev = thief;
    items.push({ y: thief[1] + 0.01, f: () => {
      const [cx] = cc(thief[0], thief[1]), bottom = bottomOf(thief[1]), snatching = totalTime - thiefSnatchAt < 900;
      ctx.beginPath(); ctx.ellipse(cx, bottom - cell * 0.03, cell * 0.3, cell * 0.08, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
      if (snatching) drawStrip(animFile('thief_snatch'), 'thief_snatch', animIndex('thief_snatch', totalTime - thiefSnatchAt), cx, bottom, cell * 1.2, thiefFlip);
      else drawStrip(animFile('thief_sneak'), 'thief_sneak', animIndex('thief_sneak', totalTime), cx, bottom, cell * 1.2, thiefFlip);
      if (st.thiefCool === 0 && !snatching) { ctx.strokeStyle = 'rgba(255,120,100,' + (0.35 + 0.35 * pulse) + ')'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(cx, bottom - cell * 0.4, cell * 1.0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    } });
  }
  const timeLeft = (st.limit - st.t) / st.limit;
  n.visitors.forEach((v, i) => items.push({ y: v.by + 0.01, f: () => {
    const [bx] = cc(v.bx, v.by), done = st.served[i], bottom = bottomOf(v.by) + cell * 0.04;
    const T = done ? totalTime - (servedAt[i] || -9999) : -1, since = T - 640;   // since: ms after the cup reached the visitor
    const iK = 'v_' + v.who + '_idle', sK = 'v_' + v.who + '_sip', hK = 'v_' + v.who + '_hop';
    const haveI = ready(animFile(iK)), haveV = haveI && ready(animFile(hK)), haveS = haveV && ready(animFile(sK)), subjH = cell * 1.75;
    const lift = !haveV && since > 0 && since < 520 ? Math.sin((since / 520) * Math.PI) * cell * 0.17 : 0;
    ctx.save(); ctx.translate(0, -lift);
    const base = ready(VISITOR_BASE[v.who]);
    let im, cupY = null, cupH = cell * 0.6;   // cupY: where the held cup is drawn (null: no cup yet)
    ctx.globalAlpha = !done && targetIdx >= 0 && i !== targetIdx ? 0.72 : 1;
    const hopMs = haveV ? (ANIMS[hK].n / ANIMS[hK].fps) * 1000 : 0, sipMs = haveS ? (ANIMS[sK].n / ANIMS[sK].fps) * 1000 : 0;
    if (!done) {
      const pic = totalTime < (sighUntil[i] || 0) ? ready(custFile(v.who, 'sigh')) : timeLeft < 0.35 ? ready(custFile(v.who, 'impatient')) : null;
      if (pic) im = pic;
      else if (haveI) { drawStrip(animFile(iK), iK, animIndex(iK, totalTime + i * 1370), bx, bottom, subjH); }
      else im = base;
    } else if (!haveV) {   // no sip/hop clips yet: idle until the cup arrives, then the receiving picture with a small lift
      if (haveI && since < 0) drawStrip(animFile(iK), iK, animIndex(iK, totalTime + i * 1370), bx, bottom, subjH);
      else im = since >= 0 ? (ready(custFile(v.who, 'receive')) || base) : base; if (since >= 0) cupY = bottom - cell * 0.62;
    } else if (since < 0) drawStrip(animFile(iK), iK, animIndex(iK, totalTime + i * 1370), bx, bottom, subjH);
    else if (since < hopMs) {   // a little hop of joy, the cup rides in the paws
      const fi = animIndex(hK, since), lf = (ANIMS[hK].lift && ANIMS[hK].lift[fi]) || 0;
      drawStrip(animFile(hK), hK, fi, bx, bottom, subjH); cupY = bottom - subjH * (belly(v.who) + lf);
    } else if (since < hopMs + sipMs) {   // the sip: the real cup goes up to the mouth and back
      const ts = since - hopMs; drawStrip(animFile(sK), sK, animIndex(sK, ts), bx, bottom, subjH);
      const fr = sipFrac(v.who, ts / 1000); cupY = bottom - subjH * fr; cupH = cell * (0.6 - 0.1 * Math.max(0, (fr - belly(v.who)) / 0.18));
    } else { drawStrip(animFile(iK), iK, animIndex(iK, totalTime + i * 1370), bx, bottom, subjH); cupY = bottom - subjH * belly(v.who); }
    if (im) drawImgBottom(im, bx, bottom, subjH);
    ctx.globalAlpha = 1;
    if (cupY !== null) { const dx = haveV ? 0 : Math.sign(st.x - v.bx) * 0.1; drawCup(v.want, bx + dx * cell, cupY, cupH); steam(bx + dx * cell, cupY, cupH); }
    if (since > 0 && since < 900) {   // little sparkles of delight
      for (let q = 0; q < 5; q++) { const a = q * 1.26 + 0.4, p = since / 900, rr = cell * (0.45 + 0.5 * p), px = bx + Math.cos(a) * rr, py = bottom - cell * 1.0 + Math.sin(a) * rr * 0.8, sz = cell * 0.09 * (1 - p);
        ctx.fillStyle = 'rgba(255,232,150,' + (1 - p) + ')'; ctx.beginPath(); ctx.moveTo(px, py - sz * 2); ctx.lineTo(px + sz * 0.5, py - sz * 0.5); ctx.lineTo(px + sz * 2, py); ctx.lineTo(px + sz * 0.5, py + sz * 0.5); ctx.lineTo(px, py + sz * 2); ctx.lineTo(px - sz * 0.5, py + sz * 0.5); ctx.lineTo(px - sz * 2, py); ctx.lineTo(px - sz * 0.5, py - sz * 0.5); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  } }));
  // Toddy and his line (smoothly between steps)
  const L = (a, b) => a + (b - a) * frac;
  const P = curPts.map((p, i) => { const q = prevPts[i] || p; return { x: L(q.x, p.x), y: L(q.y, p.y) }; });
  for (let k = st.cups.length - 1; k >= 1; k--) items.push({ y: P[k].y - 0.2, f: () => { const [cx, cy] = cc(P[k].x, P[k].y); drawCup(st.cups[k], cx, cy + cell * 0.05, cell * 0.95); } });
  const [tx, ty] = cc(P[0].x, P[0].y);
  items.push({ y: P[0].y + 0.02, f: () => {
    ctx.beginPath(); ctx.ellipse(tx, ty + cell * 0.46, cell * 0.34, cell * 0.1, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
    const tp = toddyPicture();
    const mv = totalTime - lastMoveAt < STEP_MS * 1.6; if (mv !== prevMov || st.dir !== prevDirV) { jiggleAt = totalTime; prevMov = mv; prevDirV = st.dir; }
    const jt = Math.max(0, totalTime - jiggleAt) / 1000, jd = Math.exp(-jt * 7), kk = jd * Math.sin(jt * 28), feet = ty + cell * 0.5;
    ctx.save(); ctx.translate(tx, feet); ctx.scale(1 + 0.04 * kk, 1 - 0.05 * kk); ctx.translate(-tx, -feet);
    drawStrip(animFile(tp.key), tp.key, tp.i, tx, feet, cell * 1.75, tp.flip); ctx.restore();
    const handing = fx.some((f) => f.kind === 'cup' && totalTime - f.t0 < 650);   // while a cup is being handed over, that cup is drawn by the effect
    if (st.cups.length && !handing && !st.over && !(tp.key === 'walk_up' || (tp.key === 'bump' || tp.key === 'slip' || tp.key === 'startled'))) { const [hx, hy] = pawPos(tx, ty, tp.key, tp.flip); const pv = hy + cell * 0.3; ctx.save(); ctx.translate(hx, pv); ctx.rotate(0.2 * jd * Math.sin(jt * 22) * (mv ? 0.6 : 1)); ctx.translate(-hx, -pv); drawCup(st.cups[0], hx, hy, cell * 0.62); ctx.restore(); steam(hx, hy, cell * 0.62); ctx.beginPath(); ctx.arc(hx, hy, cell * 0.42, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(253,175,30,' + (0.55 + 0.4 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
  } });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();

  ambient(n);
  // speech bubbles: what each waiting visitor wants
  n.visitors.forEach((v, i) => {
    if (st.served[i]) return;
    const [bx, by] = cc(v.bx, v.by), by2 = by - cell * 1.3;
    ctx.globalAlpha = targetIdx >= 0 && i !== targetIdx ? 0.55 : 1;
    ctx.fillStyle = 'rgba(20,16,46,.9)'; ctx.beginPath(); ctx.arc(bx, by2, cell * 0.48, 0, Math.PI * 2); ctx.fill();
    if (i === targetIdx) { ctx.strokeStyle = 'rgba(255,244,214,' + (0.5 + 0.5 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
    drawDrink(v.want, bx, by2, cell * 0.46); ctx.globalAlpha = 1;
  });
  // guide: a moving dashed line from Toddy to the visitor who wants his first cup
  if (st.cups.length && !st.over) {
    n.visitors.forEach((v, i) => {
      if (i !== targetIdx) return;
      const [gx, gy] = cc(v.sx, v.sy), ang = Math.atan2(gy - ty, gx - tx);
      ctx.save(); ctx.setLineDash([9, 9]); ctx.lineDashOffset = -totalTime / 40; ctx.strokeStyle = 'rgba(255,230,160,.8)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(gx - Math.cos(ang) * cell * 0.45, gy - Math.sin(ang) * cell * 0.45); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(255,230,160,.95)'; ctx.beginPath(); const ax = gx - Math.cos(ang) * cell * 0.3, ay = gy - Math.sin(ang) * cell * 0.3; ctx.moveTo(ax + Math.cos(ang) * 10, ay + Math.sin(ang) * 10); ctx.lineTo(ax + Math.cos(ang + 2.4) * 10, ay + Math.sin(ang + 2.4) * 10); ctx.lineTo(ax + Math.cos(ang - 2.4) * 10, ay + Math.sin(ang - 2.4) * 10); ctx.closePath(); ctx.fill();
    });
  }
  // effects: splashes, dust, hearts
  fx = fx.filter((f) => totalTime - f.t0 < f.ms);
  for (const f of fx) {
    const age = totalTime - f.t0;
    if (age < 0) continue;
    if (f.kind === 'cup') {   // the served cup: held in Toddy's paws for a moment, then carried over to the customer
      const up = f.ty < f.y && Math.abs(f.ty - f.y) > Math.abs(f.tx - f.x);   // visitor above Toddy: he reaches up with both arms
      const hold = up ? 480 : 260, fly = Math.max(0, Math.min(1, (age - hold) / 380)), ease = fly * fly * (3 - 2 * fly);
      const [ax, ay] = cc(f.x, f.y), sdx = up ? 0 : Math.sign(f.tx - f.x);
      const sx0 = ax + sdx * cell * 0.3, sy0 = ay + cell * 0.5 - cell * 0.62 - (up ? cell * 0.95 * Math.min(1, age / 420) : 0);
      const ex = ox + (f.tx + 0.5) * cell + Math.sign(f.x - f.tx) * cell * 0.1, ey = oy + (f.ty + 1) * cell + cell * 0.04 - cell * 0.62;
      const x = sx0 + (ex - sx0) * ease, y = sy0 + (ey - sy0) * ease - Math.sin(ease * Math.PI) * cell * 0.35;
      ctx.globalAlpha = 1;
      drawCup(f.drink, x, y, cell * (0.62 - 0.02 * ease)); ctx.globalAlpha = 1; continue;
    }
    const [fx0, fy0] = cc(f.x, f.y), key = f.key, file = f.file;
    const i = Math.min(ANIMS[key].n - 1, Math.floor((age / 1000) * ANIMS[key].fps));
    const fade = age > f.ms - 260 ? Math.max(0, (f.ms - age) / 260) : 1;
    drawCentered(file, key, i, fx0 + (f.dx || 0) * cell, fy0 + (f.dy || 0) * cell - (f.rise ? (age / f.ms) * cell * 0.5 : 0), cell * f.size, fade);
  }
  // "Next cup" chip: the cup right behind Toddy is the one that gets served; the visitor wanting it glows
  { const fc = st.cups.length ? st.cups[0] : -1, cw = 132, ch = 44, cx0 = ox, cy0 = Math.max(70, oy - ch - 10);
    ctx.fillStyle = 'rgba(20,16,46,.9)'; ctx.fillRect(cx0, cy0, cw, ch); ctx.strokeStyle = '#C99A3B'; ctx.lineWidth = 2; ctx.strokeRect(cx0, cy0, cw, ch);
    ctx.fillStyle = '#FDE3BD'; ctx.font = '600 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(fc >= 0 ? 'Give this' : 'No cups left', cx0 + 10, cy0 + 28);
    if (fc >= 0) drawDrink(fc, cx0 + cw - 26, cy0 + ch / 2, 16); }
  if (waiting) {
    const a = 0.5 + 0.5 * Math.sin(totalTime / 260);
    ctx.beginPath(); ctx.arc(tx, ty, cell * (0.75 + 0.12 * a), 0, Math.PI * 2); ctx.strokeStyle = 'rgba(253,175,30,' + (0.5 + 0.4 * a) + ')'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff4d6'; ctx.font = '700 22px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#1a0a05'; ctx.lineWidth = 5; const hint = controlMode === 'tap' ? 'Tap where Toddy should go' : 'Touch and drag to walk'; ctx.strokeText(hint, W / 2, oy + cell * n.h + 34); ctx.fillText(hint, W / 2, oy + cell * n.h + 34);
    const dy = -8 * a; if (controlMode !== 'tap') ctx.fillText('↑', tx, ty - cell * 0.95 + dy);
  }
  if (!waiting && st.bumped && !st.over && !target) { ctx.fillStyle = '#fff4d6'; ctx.font = '700 22px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#1a0a05'; ctx.lineWidth = 5; const msg = controlMode === 'tap' ? 'Tap to move on' : 'Drag to move on'; ctx.strokeText(msg, W / 2, oy + cell * n.h + 34); ctx.fillText(msg, W / 2, oy + cell * n.h + 34); }
  if (target && !st.over) {   // a soft pulsing ring where Toddy is heading
    const [gx, gy] = cc(target.x, target.y), a = 0.5 + 0.5 * Math.sin(totalTime / 200);
    ctx.beginPath(); ctx.ellipse(gx, gy + cell * 0.18, cell * (0.3 + 0.05 * a), cell * (0.16 + 0.03 * a), 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(253,175,30,' + (0.55 + 0.35 * a) + ')'; ctx.lineWidth = 3; ctx.stroke();
  }
  // little floating notes
  flashes = flashes.filter((f) => totalTime - f.t0 < 900);
  for (const f of flashes) { const a = 1 - (totalTime - f.t0) / 900, [fx1, fy1] = cc(f.x, f.y); ctx.globalAlpha = a; ctx.font = '700 ' + Math.round(cell * 0.5) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#1a0a05'; ctx.lineWidth = 4; ctx.strokeText(f.text, fx1, fy1 - cell * 0.9 - (1 - a) * cell * 0.8); ctx.fillStyle = f.color; ctx.fillText(f.text, fx1, fy1 - cell * 0.9 - (1 - a) * cell * 0.8); if (f.drink !== undefined) drawDrink(f.drink, fx1 + cell * 0.5, fy1 - cell * 1.05 - (1 - a) * cell * 0.8, cell * 0.28); ctx.globalAlpha = 1; }
}

// ---- game flow ----
function banner(text, ms) { const b = $('banner'); b.textContent = text; b.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), ms || 2500); }
const COMMON = [...['idle_down', 'walk_down', 'walk_up', 'walk_right', 'hand_right', 'hand_down', 'hand_up', 'bump', 'startled', 'win', 'fx_dust', 'fx_heart'].map(animFile), ...DRINK_NAMES.map((d) => 'trail_anim_fx_splash_' + d + '_v01'),
  ...Object.values(VISITOR_BASE), ...Object.entries(CUST).flatMap(([w, ps]) => ps.map((p) => custFile(w, p))), ...DRINK_NAMES.flatMap((n) => ['trail_badge_' + n + '_v01', 'trail_cup_' + n + '_v01'])];
function nightFiles(id) {
  const n = NIGHTS[id], f = ['trail_bg_n' + artOf(id) + '_v01'];
  if (n.tables.length) f.push(objFile(obstacleOf(id)[0]));
  if (n.brew.length) f.push(objFile('station'), objFile('ring'), animFile('brew_pour'));
  if (n.cart) f.push(objFile('cart'));
  if (n.thief) f.push(animFile('thief_sneak'), animFile('thief_snatch'));
  if (n.puddles && n.puddles.length) f.push(animFile('puddle_ripple'), animFile('slip'));
  if (n.shutters && n.shutters.length) f.push(objFile('shutter_open'), objFile('shutter_closed'));
  for (const w of new Set(n.visitors.map((v) => v.who))) for (const k of ['idle', 'sip', 'hop']) if (ANIMS['v_' + w + '_' + k]) f.push(animFile('v_' + w + '_' + k));
  return f;
}
async function startNight(id) {
  nightId = id; running = false;
  const o = $('overlay'); o.textContent = ''; o.hidden = false; o.append(mk('div', 'card', 'Getting ' + nm(id) + ' ready…'));
  await Promise.all(nightFiles(id).map(loadImg));
  st = newState(id); turns = []; heldDir = null; target = null; lastSent = 4; flashes = []; fx = []; acc = 0; last = 0; tod = null; lastMoveAt = -9999; endAt = 0; confettiAt = -99999; jiggleAt = -9999;
  sighUntil = NIGHTS[id].visitors.map(() => 0); servedAt = NIGHTS[id].visitors.map(() => 0); brewAt = []; shutterAt = {}; shutterWas = {}; thiefPrev = null; thiefSnatchAt = -9999;
  prevPts = curPts = pts(st);
  o.hidden = true; o.textContent = '';
  music.play(MUSIC_OF[artOf(id)] || artOf(id)); resize(); updateHud(); running = true; waiting = true;   // Toddy waits for the first swipe
}
async function startEndless(n) {
  const o = $('overlay'); o.textContent = ''; o.hidden = false; o.append(mk('div', 'card', 'Building level ' + n + '…'));
  let lvl;
  try { const E = await import('./endless.js'); lvl = E.makeLevel(n, await E.loadPool(), ENDLESS); }
  catch (e) { o.textContent = ''; o.append(mk('div', 'card', 'Endless mode could not load. Please try again.')); setTimeout(showMenu, 1800); return; }
  endless = { n, recipe: lvl.recipe }; registerLevel(ENDLESS_ID, lvl.def); ART_OF[ENDLESS_ID] = lvl.theme;
  await startNight(ENDLESS_ID);
}
function updateHud() {
  const n = NIGHTS[st.night], c = st.served.filter(Boolean).length;
  $('served').textContent = (st.night === ENDLESS_ID && endless ? 'Lv ' + endless.n + ' · ' : '') + 'Served ' + c + ' / ' + n.visitors.length;
  { const f = (st.limit - st.t) / st.limit; music.setLevel(st.won || st.over ? 0 : f < 0.25 ? 2 : f < 0.5 ? 1 : 0); }
  $('lanternFill').style.transform = 'scaleX(' + Math.max(0, (st.limit - st.t) / st.limit).toFixed(3) + ')';
}
function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
const NO_INTRO_VIDEO = new Set([20]);   // nights whose intro clip is hidden until redone
function showIntro(id) {   // a short picture-story card before each night
  const o = $('overlay'); o.textContent = ''; o.hidden = false; running = false;
  const card = mk('div', 'card'), v = document.createElement('video');
  const noVideo = NO_INTRO_VIDEO.has(id);
  if (!noVideo) v.src = 'assets/trail_intro_n' + id + '_v01.mp4'; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.className = 'intro';
  const tell = { 20: 'A hard sample: two shutters, a rolling cart, puddles, a thief on patrol and nine visitors. Only 45 seconds. Not part of the story nights.', 1: 'Light the lamp, open the café, and bring everyone their drink.', 2: 'A breezy terrace: tables and parasols are in the way. Brew a new cup at the golden ring.', 3: 'Market night: mind the rolling tea cart.', 4: 'Rain! Puddles are slippery and make Toddy slide one extra step.', 5: 'Quiet library: shutters open and close, so wait for the green light.', 6: 'Moon bridge: Nox the night thief snatches a cup if you pass too close.', 7: 'Street party: everything at once!' };
  const go = mk('button', 'btn', 'Start ' + nm(id)); go.addEventListener('click', () => { unlockSound(); startNight(id); });
  const back = mk('button', 'btn alt', 'Back'); back.addEventListener('click', showMenu);
  if (!noVideo) card.append(v); card.append(mk('h1', '', nm(id) + ' · ' + NIGHTS[id].name), mk('p', '', tell[id] || ''), go, back); o.append(card);
  if (!noVideo) { const pl = v.play(); if (pl && pl.catch) pl.catch(() => {}); }
}
function showMenu() {
  endless = null; menuMusic();
  const o = $('overlay'); o.textContent = ''; o.hidden = false; running = false;
  const card = mk('div', 'card'); card.append(mk('h1', '', 'TODDY Trail'), mk('p', '', controlMode === 'tap' ? '1 · Tap where Toddy should go' : '1 · Touch and drag to walk'), mk('p', '', '2 · Walk into the visitor who wants your next cup'), mk('p', '', '3 · Serve everyone before the lanterns go out'));
  const spd = mk('button', 'btn alt', 'Walking speed: ' + speedName);
  spd.addEventListener('click', () => { const names = Object.keys(SPEEDS); speedName = names[(names.indexOf(speedName) + 1) % names.length]; STEP_MS = 1000 / SPEEDS[speedName]; try { localStorage.setItem('trailSpeed', speedName); } catch (_) { /* optional */ } spd.textContent = 'Walking speed: ' + speedName; });
  const ctl = mk('button', 'btn alt', 'Controls: ' + (controlMode === 'tap' ? 'Tap to go' : 'Drag to steer'));
  ctl.addEventListener('click', () => { controlMode = controlMode === 'tap' ? 'steer' : 'tap'; try { localStorage.setItem('trailControl', controlMode); } catch (_) { /* optional */ } ctl.textContent = 'Controls: ' + (controlMode === 'tap' ? 'Tap to go' : 'Drag to steer'); card.firstChild.nextSibling.textContent = controlMode === 'tap' ? '1 · Tap where Toddy should go' : '1 · Touch and drag to walk'; });
  const play = mk('button', 'btn', 'Play · Night 1'); play.addEventListener('click', () => { unlockSound(); showIntro(1); }); card.append(play, spd, ctl);
  const more = mk('button', 'btn alt', 'Choose another night'), list = mk('div', ''); list.hidden = true;
  more.addEventListener('click', () => { list.hidden = !list.hidden; });
  for (const id of NIGHT_IDS) { const b = mk('button', 'btn alt', 'Night ' + id + ' · ' + NIGHTS[id].name); b.addEventListener('click', () => { unlockSound(); showIntro(id); }); list.append(b); }
  for (const id of SAMPLE_IDS) { const b = mk('button', 'btn alt', 'Sample · Level ' + id + ' · ' + NIGHTS[id].name); b.addEventListener('click', () => { unlockSound(); showIntro(id); }); list.append(b); }
  { const b = mk('button', 'btn alt', 'Endless mode · preview'); b.addEventListener('click', () => { unlockSound(); endless = null; startEndless(ENDLESS.startLevel); }); list.append(b); }
  card.append(more, list); o.append(card);
}
function showResult() {
  const r = score(st), o = $('overlay'); o.textContent = ''; o.hidden = false; running = false;
  music.stinger(st.won);
  const card = mk('div', 'card');
  card.append(mk('h1', '', st.won ? 'All served!' : 'Lanterns out'), mk('div', 'big', String(r.score)), mk('p', '', 'Served ' + r.served + ' of ' + r.of + ' · ' + r.seconds + ' s · spilled ' + (st.spills + st.snatched)));
  if (nightId === ENDLESS_ID && endless) {   // endless mode: the rules come from endless-config.js
    const n = endless.n, pass = !!ENDLESS.passed(st, n);
    card.firstChild.textContent = pass ? 'Level ' + n + ' cleared!' : 'Lanterns out';
    if (pass) { const nx = mk('button', 'btn', 'Level ' + (n + 1)); nx.addEventListener('click', () => startEndless(n + 1)); card.append(nx); }
    else if (ENDLESS.onFail === 'retry') { const rt = mk('button', 'btn', 'Try again · new layout'); rt.addEventListener('click', () => startEndless(n)); card.append(rt); }
    const back = mk('button', 'btn alt', 'Back to menu'); back.addEventListener('click', showMenu);
    card.append(back); o.append(card); return;
  }
  const nextId = NIGHT_IDS.includes(nightId) ? NIGHT_IDS[NIGHT_IDS.indexOf(nightId) + 1] : undefined;
  if (st.won && nextId) { const nx = mk('button', 'btn', 'Night ' + nextId + ' · ' + NIGHTS[nextId].name); nx.addEventListener('click', () => showIntro(nextId)); card.append(nx); }
  const again = mk('button', 'btn' + (st.won && nextId ? ' alt' : ''), 'Play again'); again.addEventListener('click', () => startNight(nightId));
  const other = mk('button', 'btn alt', 'Pick a night'); other.addEventListener('click', showMenu);
  card.append(again, other); o.append(card);
}
function unlockSound() { musicGo = true; music.resume(); if (soundOn && actx && actx.state === 'suspended') actx.resume(); }
function menuMusic() { if (musicGo) music.play('menu'); }

function onEvents(before) {
  const n = NIGHTS[st.night];
  for (const e of st.events) {
    if (e.type === 'serve') {
      SND.serve(); const v = n.visitors[e.visitor], d = faceVisitor(v); servedAt[e.visitor] = totalTime;
      flashes.push({ x: v.sx, y: v.sy, t0: totalTime, text: '', color: '#ff8fa3', drink: v.want });
      fx.push({ kind: 'cup', drink: v.want, x: st.x, y: st.y, tx: v.bx, ty: v.by, t0: totalTime, ms: 800 });
      fx.push({ file: animFile('fx_heart'), key: 'fx_heart', x: v.bx, y: v.by, dy: -1.55, size: 0.9, t0: totalTime + 640, ms: 1400, rise: true });
      if (d === 1 || d === 3) setTod('hand_right', d, 1100, 'cancelOnMove'); else if (d === 2) setTod('hand_down', d, 1100, 'cancelOnMove'); else setTod('hand_up', d, 1300, 'cancelOnMove');
    } else if (e.type === 'sigh') {
      SND.sigh(); const v = n.visitors[e.visitor]; sighUntil[e.visitor] = totalTime + 1300;
      flashes.push({ x: v.sx, y: v.sy, t0: totalTime, text: 'other drink', color: '#ff8f7a' });
    } else if (e.type === 'spill' || e.type === 'bump') {
      if (e.type === 'spill') SND.spill(); SND.bump(); const wx = st.x + DX[st.dir] * 0.55, wy = st.y + DY[st.dir] * 0.55;
      fx.push({ file: animFile('fx_dust'), key: 'fx_dust', x: wx, y: wy, size: 1.3, t0: totalTime, ms: 800 });
      if (e.type === 'spill' && before !== undefined) fx.push({ file: 'trail_anim_fx_splash_' + DRINK_NAMES[before] + '_v01', key: 'fx_splash', x: st.x, y: st.y, dy: 0.25, size: 1.45, t0: totalTime, ms: 2000 });
      flashes.push({ x: st.x, y: st.y, t0: totalTime, text: e.type === 'spill' ? 'bumped! cup lost' : 'bump!', color: '#ff8f7a' });
      setTod('bump', st.dir, 1600, 'cancelOnMove');
    } else if (e.type === 'slide') {
      SND.slide(); setTod('slip', st.dir, 800);
    } else if (e.type === 'snatch') {
      SND.snatch(); SND.spill(); thiefSnatchAt = totalTime; flashes.push({ x: st.x, y: st.y, t0: totalTime, text: 'snatched!', color: '#ff8f7a' });
      if (before !== undefined) fx.push({ file: 'trail_anim_fx_splash_' + DRINK_NAMES[before] + '_v01', key: 'fx_splash', x: st.x, y: st.y, dy: 0.25, size: 1.2, t0: totalTime, ms: 1600 });
      setTod('startled', st.dir, 1300, 'cancelOnMove');
    } else if (e.type === 'brew') {
      SND.brew(); flashes.push({ x: st.x, y: st.y, t0: totalTime, text: '+1', color: '#fff4d6' });
      const bi = n.brew.findIndex((b) => b.x === st.x && b.y === st.y); if (bi >= 0) brewAt[bi] = totalTime;
    }
  }
}

function stick() {   // the thumb pad: a ring where the finger went down and a knob under the finger
  const r0 = cv.getBoundingClientRect(), ax = sx - r0.left, ay = sy - r0.top; let kx = fingerX - r0.left - ax, ky = fingerY - r0.top - ay; const d = Math.hypot(kx, ky) || 1, m = Math.min(d, 34); kx = ax + (kx / d) * m; ky = ay + (ky / d) * m;
  ctx.save(); ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.strokeStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(ax, ay, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.45; ctx.fillStyle = '#fdaf1e'; ctx.beginPath(); ctx.arc(kx, ky, 20, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now; const dt = Math.min(now - last, 200); last = now; totalTime += dt;
  if (st && running) {
    if (!waiting && !st.over) acc += dt;
    while (acc >= STEP_MS && !st.over) {
      acc -= STEP_MS;
      prevPts = curPts;
      const was = { x: st.x, y: st.y }, lastCup = st.cups.length ? st.cups[st.cups.length - 1] : undefined;
      let want;
      if (heldDir !== null) { want = heldDir; target = null; pendingTurn = null; }   // arrow keys (and steer mode): finger down = steer that way
      else if (controlMode === 'tap') { const d = planDir(); want = d < 0 ? 4 : d; pendingTurn = null; if (st.bumped && !st.soft) lastSent = -1; }
      else { want = pendingTurn !== null ? pendingTurn : 4; pendingTurn = null; }   // finger up = stand still
      if (want !== lastSent) { lastSent = want; turns.push([st.t, want]); step(st, want); } else step(st, null);
      if (st.x !== was.x || st.y !== was.y) lastMoveAt = totalTime;
      if (controlMode === 'tap' && st.bumped) target = null;   // hit something: stop; touch again to go on
      curPts = pts(st);
      onEvents(lastCup);
      updateHud();
    }
    if (st.over && !endAt) {
      endAt = totalTime; updateHud();
      if (st.won) { SND.win(); confettiAt = totalTime; tod = { key: 'win', flip: false, t0: totalTime, until: totalTime + 4000 }; fx.push({ file: animFile('fx_heart'), key: 'fx_heart', x: st.x, y: st.y, dy: -1.8, size: 1.1, t0: totalTime, ms: 1500, rise: true }); }
      else tod = { key: 'startled', flip: false, t0: totalTime, until: totalTime + 4000 };
    }
    if (st.over && endAt && totalTime - endAt > 2100) { draw(1); showResult(); return; }
  }
  draw(Math.min(acc / STEP_MS, 1));
}

// ---- tap to go: touch a spot and Toddy walks there by himself, around obstacles ----
let controlMode = (() => { try { return localStorage.getItem('trailControl') === 'steer' ? 'steer' : 'tap'; } catch (_) { return 'tap'; } })();
let target = null;   // the cell Toddy is walking to
// Tap to go in ANY direction: Toddy walks the straight line from where he stands to the touched cell. The grid only allows up/down/left/right steps,
// so a diagonal is a staircase that hugs the line (across, up, across, up ...), never "all across, then all up". The normal game rules apply the whole way:
// a table, wall, cart or visitor in the way is a bump (he stops, touch again to go on), a puddle still slides him.
function planDir() {
  if (!target || !st) return -1;
  const dx = target.x - st.x, dy = target.y - st.y;
  if (dx === 0 && dy === 0) { target = null; return -1; }
  if (++target.steps > (Math.abs(target.x - target.sx) + Math.abs(target.y - target.sy)) * 2 + 4) { target = null; return -1; }   // slides pushed him around too long: give up
  const cand = [];
  if (dx !== 0) cand.push({ d: dx > 0 ? 1 : 3, x: st.x + Math.sign(dx), y: st.y });
  if (dy !== 0) cand.push({ d: dy > 0 ? 2 : 0, x: st.x, y: st.y + Math.sign(dy) });
  if (cand.length === 1) return cand[0].d;
  const lx = target.x - target.sx, ly = target.y - target.sy;   // the ideal line: pick the step that stays closest to it
  const off = (c) => Math.abs(lx * (c.y - target.sy) - ly * (c.x - target.sx));
  const horizFirst = Math.abs(dx) >= Math.abs(dy);   // on a tie, step along the longer side first
  cand.sort((p, q) => off(p) - off(q) || ((p.d % 2 === 1) === horizFirst ? -1 : 1));
  return cand[0].d;
}
function setTarget(clientX, clientY) {
  const r = cv.getBoundingClientRect(), n = NIGHTS[st.night];
  let x = Math.floor((clientX - r.left - ox) / cell), y = Math.floor((clientY - r.top - oy) / cell);
  x = Math.max(0, Math.min(n.w - 1, x)); y = Math.max(0, Math.min(n.h - 1, y));
  if (x === st.x && y === st.y) return;
  if (!target || target.x !== x || target.y !== y) { target = { x, y, sx: st.x, sy: st.y, steps: 0 }; waiting = false; acc = Math.max(acc, STEP_MS * (totalTime - lastMoveAt < STEP_MS * 1.6 ? 0.6 : 1)); SND.turn(); }
}

// ---- input: touch-and-drag steering, arrow keys ----
let sx = 0, sy = 0, down = false;
let pendingTurn = null, padId = null, fingerX = 0, fingerY = 0;   // pendingTurn: a quick tap between two steps is still remembered until the next step
const turnFromDelta = (dx, dy, prev) => {   // dominant axis wins, but the current axis is kept until the other one is clearly stronger (no flicker near the diagonal)
  const ax = Math.abs(dx), ay = Math.abs(dy), horiz = prev === 1 || prev === 3;
  const useX = prev === null || prev === undefined ? ax > ay : horiz ? !(ay > ax * 1.35) : ax > ay * 1.35;
  return useX ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
};
const setHeld = (d) => { if (d !== heldDir) { heldDir = d; if (d !== null) { pendingTurn = d; acc = Math.max(acc, STEP_MS * (totalTime - lastMoveAt < STEP_MS * 1.6 ? 0.6 : 1));   /* answer the touch at once: standing still steps now, walking turns within ~40% of a step */ waiting = false; SND.turn(); } } };
cv.addEventListener('pointerdown', (e) => { if (down) return; padId = e.pointerId; down = true; sx = fingerX = e.clientX; sy = fingerY = e.clientY; unlockSound(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} if (controlMode === 'tap' && running && st && !st.over) setTarget(e.clientX, e.clientY); });
// Hold and steer: put a finger down and drag; Toddy walks the way you drag and stops when you lift. The anchor follows the finger so changing direction is quick.
cv.addEventListener('pointermove', (e) => {
  if (!down || !running || e.pointerId !== padId) return;
  fingerX = e.clientX; fingerY = e.clientY;
  if (controlMode === 'tap') { if (!st.over) setTarget(e.clientX, e.clientY); return; }   // keep the target under the finger while it moves
  const dx = e.clientX - sx, dy = e.clientY - sy, d = Math.hypot(dx, dy);
  if (d >= 9) setHeld(turnFromDelta(dx, dy, heldDir));
  if (d > 34) { sx = e.clientX - (dx / d) * 34; sy = e.clientY - (dy / d) * 34; }
});
const up = (e) => { if (e && e.pointerId !== padId) return; down = false; padId = null; if (controlMode !== 'tap') setHeld(null); };   // tap mode: lifting the finger does NOT stop Toddy, he keeps walking to the spot
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('contextmenu', (e) => e.preventDefault());
// full screen on and off (Android Chrome and desktop; iPhone Safari does not allow it, so the button hides itself there)
const fsEl = document.documentElement, fsOn = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsCan = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
function fsRefresh() { const b = $('btnFull'); b.textContent = fsOn() ? '✕' : '⛶'; b.setAttribute('aria-label', fsOn() ? 'Exit full screen' : 'Full screen'); b.setAttribute('aria-pressed', String(!!fsOn())); setTimeout(resize, 120); }
$('btnFull').hidden = !fsCan;
$('btnFull').addEventListener('click', async () => {
  unlockSound();
  try {
    if (fsOn()) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); try { screen.orientation.unlock(); } catch (_) { /* optional */ } }
    else { await (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl); try { await screen.orientation.lock('portrait'); } catch (_) { /* optional */ } }
  } catch (_) { /* the browser said no */ }
  fsRefresh();
});
document.addEventListener('fullscreenchange', fsRefresh); document.addEventListener('webkitfullscreenchange', fsRefresh);
window.addEventListener('keydown', (e) => { const m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 }[e.key]; if (m !== undefined && running) { e.preventDefault(); setHeld(m); } });
window.addEventListener('keyup', (e) => { const m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 }[e.key]; if (m !== undefined && m === heldDir) setHeld(null); });
$('btnSound').addEventListener('click', () => { soundOn = !soundOn; music.setEnabled(soundOn); $('btnSound').setAttribute('aria-pressed', String(soundOn)); $('btnSound').style.opacity = soundOn ? '1' : '.55'; unlockSound(); beep(660, 0.08); });

resize(); requestAnimationFrame(frame);
{ const o = $('overlay'); o.textContent = ''; o.append(mk('div', 'card', 'Loading TODDY Trail…')); }
Promise.all(COMMON.map(loadImg)).then(() => { resize(); showMenu(); });
