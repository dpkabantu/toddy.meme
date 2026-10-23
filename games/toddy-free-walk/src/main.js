// TODDY Free Walk (SAMPLE): Trail's Toddy, cups, visitors and objects on a plain floor where Toddy walks in ANY direction toward your touch.
// The rules live in free-core.js. This file is only drawing and input. Pictures and music are reused, read only, from ../toddy-trail.
import { LEVEL, FOOT, V, REACH, newState, step, score, linePoints, clampPoint } from './free-core.js';
import { ANIMS, STILLS } from '../../toddy-trail/src/art.js';
import { createMusic } from '../../toddy-trail/src/music.js';

const ASSETS = '../toddy-trail/assets/';
const music = createMusic();
let musicGo = false;   // sound starts only after the first touch (phones block it before that)
const $ = (id) => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const SPEEDS = { Relaxed: 2.6, Normal: 4, Quick: 5 };   // cells a second; the rules count ticks, so a score is the same at any speed
let speedName = 'Relaxed'; try { const v = localStorage.getItem('freeWalkSpeed'); if (SPEEDS[v]) speedName = v; } catch (_) { /* storage optional */ }
const tickMs = () => 1000 / (SPEEDS[speedName] / V);

// ---- pictures ----
const IMGS = {}, LOADING = {};
const loadImg = (name) => LOADING[name] || (LOADING[name] = new Promise((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = ASSETS + name + '.webp'; IMGS[name] = im; }));
const ready = (name) => { const im = IMGS[name]; return im && im.complete && im.naturalWidth ? im : null; };
const WHO = ['milo', 'pip', 'velvet'];
const VISITOR_BASE = { milo: 'visitor_milo_v02', pip: 'visitor_pip_v01', velvet: 'visitor_velvet_v01' };
const DRINK_NAMES = ['moon', 'star', 'crescent'];
const animFile = (k) => 'trail_anim_' + k + '_v01', objFile = (k) => 'trail_obj_' + k + '_v01', custFile = (w, p) => 'trail_cust_' + w + '_' + p + '_v01';
const HURDLE_H = { barrel: 1.2, crates: 1.45, table: 1.85 };   // how tall each hurdle picture stands, in cells (same as Trail)
const FILES = [
  ...['idle_down', 'walk_down', 'walk_up', 'walk_right', 'hand_right', 'hand_down', 'hand_up', 'bump', 'startled', 'win', 'fx_dust', 'fx_heart', 'brew_pour'].map(animFile),
  ...DRINK_NAMES.flatMap((d) => ['trail_anim_fx_splash_' + d + '_v01', 'trail_badge_' + d + '_v01', 'trail_cup_' + d + '_v01']),
  ...Object.values(VISITOR_BASE), ...WHO.flatMap((w) => ['impatient', 'receive', 'sigh'].map((p) => custFile(w, p))),
  ...WHO.flatMap((w) => ['idle', 'sip', 'hop'].map((p) => animFile('v_' + w + '_' + p))),
  ...[...new Set(LEVEL.hurdles.map((h) => h.kind))].map(objFile), objFile('station'), objFile('ring'),
];

// ---- state ----
let st = null, running = false, waiting = false, last = 0, acc = 0, totalTime = 0, soundOn = true, pending = null, down = false, padId = null;
let target = null;   // where Toddy is walking to, for the ring on the floor
let prevPts = [], curPts = [], flashes = [], fx = [], tod = null, lastMoveAt = -9999, endAt = 0, confettiAt = -99999;
let servedAt = [], sighUntil = [], brewAt = [], face = 'down';   // drawing-only state (never read by the rules)
let prevMov = false, prevFace = '', jiggleAt = -9999;
let W = 0, H = 0, DPR = 1, cell = 30, ox = 0, oy = 0;
const SND = Object.fromEntries(['serve', 'sigh', 'spill', 'brew', 'turn', 'win', 'bump'].map((k) => [k, () => { if (soundOn && musicGo) music.sfx(k); }]));

// ---- layout: floor positions are in cells; (x, y) is a footprint centre and feet are drawn FOOT lower ----
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const n = LEVEL, top = 64, pad = 8;
  cell = Math.floor(Math.min((W - pad * 2) / n.w, (H - top - pad * 2) / n.h));
  ox = Math.floor((W - cell * n.w) / 2); oy = top + Math.floor((H - top - cell * n.h) / 2);
}
window.addEventListener('resize', resize);
const px = (x) => ox + x * cell, pyFloor = (y) => oy + y * cell, pyFeet = (y) => oy + (y + FOOT) * cell;

// ---- small drawing helpers (same pictures and look as Trail) ----
function drawDrinkFallback(d, cx, cy, r) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = ['#2F4E9F', '#9A2F55', '#2E7A52'][d] || '#3E1C14'; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = '#FFF4D6'; ctx.stroke();
}
function drawDrink(d, cx, cy, r) {
  const im = ready('trail_badge_' + DRINK_NAMES[d] + '_v01');
  if (im) ctx.drawImage(im, cx - r * 1.12, cy - r * 1.12, r * 2.24, r * 2.24); else drawDrinkFallback(d, cx, cy, r);
}
function drawCup(d, cx, cy, h) {
  const im = ready('trail_cup_' + DRINK_NAMES[d] + '_v01');
  if (!im) { drawDrinkFallback(d, cx, cy, h * 0.4); return; }
  const w = (im.naturalWidth / im.naturalHeight) * h; ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
}
function steam(cx, cy, h) {
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
};
const belly = (who) => VTRACK[who][0][1];
function sipFrac(who, t) {
  const k = VTRACK[who]; if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const u = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]), e = u * u * (3 - 2 * u); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * e; }
  return k[k.length - 1][1];
}
function drawImgBottom(im, cx, bottom, h) { if (!im) return; const w = (im.naturalWidth / im.naturalHeight) * h; ctx.drawImage(im, cx - w / 2, bottom - h, w, h); }
function drawStill(key, cx, bottom, hCells, maxWCells) {   // a cut-out object standing with its feet at `bottom`
  const im = ready(objFile(key)), m = STILLS[key]; if (!im || !m) return;
  let h = hCells * cell, w = (m[0] / m[1]) * h; const mw = (maxWCells || 1.25) * cell; if (w > mw) { h *= mw / w; w = mw; }
  ctx.drawImage(im, cx - w / 2, bottom - h, w, h);
}
function animIndex(key, t) { const a = ANIMS[key]; const f = Math.floor((t / 1000) * a.fps); return a.loop ? ((f % a.n) + a.n) % a.n : Math.max(0, Math.min(a.n - 1, f)); }
function drawStrip(file, key, i, cx, bottom, subjH, flip) {   // one frame of an animation strip; the subject's feet stand at (cx, bottom)
  const im = ready(file), a = ANIMS[key]; if (!im) return;
  const k = subjH / a.subj, w = a.w * k, h = a.h * k;
  ctx.save(); if (flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
  ctx.drawImage(im, i * a.w, 0, a.w, a.h, cx - w / 2, bottom - a.feet * k, w, h); ctx.restore();
}
function drawCentered(file, key, i, cx, cy, size, alpha) {
  const im = ready(file), a = ANIMS[key]; if (!im) return;
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(im, i * a.w, 0, a.w, a.h, cx - size / 2, cy - size / 2, size, size); ctx.globalAlpha = 1;
}
const outlined = (text, x, y, size) => { ctx.fillStyle = '#fff4d6'; ctx.font = '700 ' + size + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#1a0a05'; ctx.lineWidth = 5; ctx.strokeText(text, x, y); ctx.fillText(text, x, y); };

// ---- Toddy's picture: which of Trail's strips fits the way he is heading (any angle: the strip follows the stronger axis) ----
function updateFace() {
  const ax = Math.abs(st.hx), ay = Math.abs(st.hy), horiz = face === 'left' || face === 'right';
  const useHoriz = horiz ? !(ay > ax * 1.3) : ax > ay * 1.3;   // switch axis only when the other one is clearly stronger (no flicker on diagonals)
  face = useHoriz ? (st.hx > 0 ? 'right' : 'left') : (st.hy > 0 ? 'down' : 'up');
}
const faceToward = (dx, dy) => (Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
function setTod(key, f, ms, tag) { tod = { key, flip: f === 'left', t0: totalTime, until: totalTime + ms, tag }; }
const isMoving = () => totalTime - lastMoveAt < tickMs() * 1.6;
function toddyPicture() {
  const moving = isMoving();
  if (tod && totalTime < tod.until) {
    if (tod.tag === 'cancelOnMove' && moving && totalTime - tod.t0 > 220) tod = null;
    else return { key: tod.key, i: animIndex(tod.key, totalTime - tod.t0), flip: tod.flip };
  }
  if (moving && !st.stop) {
    if (face === 'down') return { key: 'walk_down', i: animIndex('walk_down', totalTime), flip: false };
    if (face === 'up') return { key: 'walk_up', i: animIndex('walk_up', totalTime), flip: false };
    return { key: 'walk_right', i: animIndex('walk_right', totalTime), flip: face === 'left' };
  }
  if (face === 'up' && st.t > 0) return { key: 'walk_up', i: 0, flip: false };
  return { key: 'idle_down', i: animIndex('idle_down', totalTime), flip: false };
}
function pawPos(tx, feet, key, flip) { const side = key === 'walk_right' || key.startsWith('hand_right') ? (flip ? -1 : 1) : 0; return [tx + side * cell * 0.3, feet - cell * 0.62]; }

// ---- the scene ----
function drawFloor() {   // a plain floor: flat colour and a thin brass edge, nothing else
  ctx.fillStyle = '#2e2558'; ctx.fillRect(ox, oy, cell * LEVEL.w, cell * LEVEL.h);
  ctx.strokeStyle = 'rgba(201,154,59,.55)'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, cell * LEVEL.w, cell * LEVEL.h);
}
function draw(frac) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#14102e'; ctx.fillRect(0, 0, W, H);
  if (!st) return;
  const n = LEVEL, pulse = 0.5 + 0.5 * Math.sin(totalTime / 220);
  drawFloor();
  const frontWant = st.cups.length ? st.cups[0] : -1;
  let targetIdx = -1, bestD = 1e9;   // the ONE visitor to go to: the nearest of those who want the first cup
  n.visitors.forEach((v, i) => { if (!st.served[i] && v.want === frontWant) { const d = Math.hypot(v.x - st.x, v.y - st.y); if (d < bestD) { bestD = d; targetIdx = i; } } });
  n.visitors.forEach((v, i) => {   // the reach circle on the floor: a cup is handed over when Toddy steps inside it
    ctx.beginPath(); ctx.arc(px(v.x), pyFloor(v.y), REACH * cell, 0, Math.PI * 2);
    ctx.fillStyle = st.served[i] ? 'rgba(120,200,120,.16)' : 'rgba(253,175,30,.16)'; ctx.fill();
    if (!st.served[i] && i === targetIdx) { ctx.strokeStyle = 'rgba(255,244,214,' + (0.4 + 0.5 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
  });
  n.brew.forEach((b, i) => {
    const ring = ready(objFile('ring')), rm = STILLS.ring, cool = st.brewCool[i] > 0;
    if (ring && rm) { const w = cell * 1.0, h = (rm[1] / rm[0]) * w; ctx.globalAlpha = cool ? 0.45 : 1; ctx.drawImage(ring, px(b.x) - w / 2, pyFloor(b.y) + cell * 0.12 - h / 2, w, h); ctx.globalAlpha = 1; }
    else { ctx.beginPath(); ctx.arc(px(b.x), pyFloor(b.y), cell * 0.46, 0, Math.PI * 2); ctx.fillStyle = cool ? 'rgba(201,154,59,.15)' : 'rgba(201,154,59,.38)'; ctx.fill(); }
  });

  // everything that stands up is drawn back to front, so Toddy walks behind tall things and in front of the ones behind him
  const items = [];
  for (const h of n.hurdles) items.push({ y: h.y, f: () => {
    const bottom = pyFeet(h.y);
    if (ready(objFile(h.kind))) drawStill(h.kind, px(h.x), bottom, HURDLE_H[h.kind]);
    else { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(px(h.x) - cell * 0.4, bottom - cell * 0.8, cell * 0.8, cell * 0.8); }
  } });
  n.brew.forEach((b, i) => items.push({ y: b.y - 0.18, f: () => {
    const bottom = pyFloor(b.y) + cell * 0.62, playing = totalTime - (brewAt[i] || -9999) < 1500;
    if (playing && ready(animFile('brew_pour'))) drawStrip(animFile('brew_pour'), 'brew_pour', animIndex('brew_pour', totalTime - brewAt[i]), px(b.x), bottom, cell * 1.35 * (ANIMS.brew_pour.subj / 170), false);
    else drawStill('station', px(b.x), bottom, 1.35, 1.2);
  } }));
  const timeLeft = (st.limit - st.t) / st.limit;
  n.visitors.forEach((v, i) => items.push({ y: v.y + 0.01, f: () => {
    const bx = px(v.x), done = st.served[i], bottom = pyFeet(v.y) + cell * 0.04;
    const T = done ? totalTime - (servedAt[i] || -9999) : -1, since = T - 640;   // since: ms after the cup reached the visitor
    const iK = 'v_' + v.who + '_idle', sK = 'v_' + v.who + '_sip', hK = 'v_' + v.who + '_hop';
    const haveV = ready(animFile(iK)) && ready(animFile(sK)) && ready(animFile(hK)), subjH = cell * 1.75;
    const base = ready(VISITOR_BASE[v.who]);
    let im, cupY = null, cupH = cell * 0.6;   // cupY: where the held cup is drawn (null: no cup yet)
    ctx.beginPath(); ctx.ellipse(bx, bottom - cell * 0.04, cell * 0.34, cell * 0.09, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
    ctx.globalAlpha = !done && targetIdx >= 0 && i !== targetIdx ? 0.72 : 1;
    const hopMs = haveV ? (ANIMS[hK].n / ANIMS[hK].fps) * 1000 : 0, sipMs = haveV ? (ANIMS[sK].n / ANIMS[sK].fps) * 1000 : 0;
    const idle = () => drawStrip(animFile(iK), iK, animIndex(iK, totalTime + i * 1370), bx, bottom, subjH);
    if (!done) {
      if (totalTime < (sighUntil[i] || 0)) im = ready(custFile(v.who, 'sigh')) || base;
      else if (timeLeft < 0.35) im = ready(custFile(v.who, 'impatient')) || base;
      else if (haveV) idle(); else im = base;
    } else if (!haveV) { im = since >= 0 ? (ready(custFile(v.who, 'receive')) || base) : base; if (since >= 0) cupY = bottom - cell * 0.62; }
    else if (since < 0) idle();
    else if (since < hopMs) {   // a little hop of joy, the cup rides in the paws
      const fi = animIndex(hK, since), lf = (ANIMS[hK].lift && ANIMS[hK].lift[fi]) || 0;
      drawStrip(animFile(hK), hK, fi, bx, bottom, subjH); cupY = bottom - subjH * (belly(v.who) + lf);
    } else if (since < hopMs + sipMs) {   // the sip: the real cup goes up to the mouth and back
      const ts = since - hopMs; drawStrip(animFile(sK), sK, animIndex(sK, ts), bx, bottom, subjH);
      const fr = sipFrac(v.who, ts / 1000); cupY = bottom - subjH * fr; cupH = cell * (0.6 - 0.1 * Math.max(0, (fr - belly(v.who)) / 0.18));
    } else { idle(); cupY = bottom - subjH * belly(v.who); }
    if (im) drawImgBottom(im, bx, bottom, subjH);
    ctx.globalAlpha = 1;
    if (cupY !== null) { const dx = haveV ? 0 : Math.sign(st.x - v.x) * 0.1; drawCup(v.want, bx + dx * cell, cupY, cupH); steam(bx + dx * cell, cupY, cupH); }
    if (since > 0 && since < 900) {   // little sparkles of delight
      for (let q = 0; q < 5; q++) { const a = q * 1.26 + 0.4, p = since / 900, rr = cell * (0.45 + 0.5 * p), sx = bx + Math.cos(a) * rr, sy = bottom - cell * 1.0 + Math.sin(a) * rr * 0.8, sz = cell * 0.09 * (1 - p);
        ctx.fillStyle = 'rgba(255,232,150,' + (1 - p) + ')'; ctx.beginPath(); ctx.moveTo(sx, sy - sz * 2); ctx.lineTo(sx + sz * 0.5, sy - sz * 0.5); ctx.lineTo(sx + sz * 2, sy); ctx.lineTo(sx + sz * 0.5, sy + sz * 0.5); ctx.lineTo(sx, sy + sz * 2); ctx.lineTo(sx - sz * 0.5, sy + sz * 0.5); ctx.lineTo(sx - sz * 2, sy); ctx.lineTo(sx - sz * 0.5, sy - sz * 0.5); ctx.closePath(); ctx.fill(); }
    }
  } }));
  // Toddy and his line of cups (smoothly between ticks)
  const L = (a, b) => a + (b - a) * frac;
  const P = curPts.map((p, i) => { const q = prevPts[i] || p; return { x: L(q.x, p.x), y: L(q.y, p.y) }; });
  for (let k = st.cups.length - 1; k >= 1; k--) if (P[k]) items.push({ y: P[k].y - 0.2, f: () => drawCup(st.cups[k], px(P[k].x), pyFeet(P[k].y) - cell * 0.45, cell * 0.95) });
  const tx = px(P[0].x), feet = pyFeet(P[0].y);
  items.push({ y: P[0].y + 0.02, f: () => {
    ctx.beginPath(); ctx.ellipse(tx, feet - cell * 0.04, cell * 0.34, cell * 0.1, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
    const tp = toddyPicture(), mv = isMoving();
    if (mv !== prevMov || face !== prevFace) { jiggleAt = totalTime; prevMov = mv; prevFace = face; }
    const jt = Math.max(0, totalTime - jiggleAt) / 1000, jd = Math.exp(-jt * 7), kk = jd * Math.sin(jt * 28);
    ctx.save(); ctx.translate(tx, feet); ctx.scale(1 + 0.04 * kk, 1 - 0.05 * kk); ctx.translate(-tx, -feet);
    drawStrip(animFile(tp.key), tp.key, tp.i, tx, feet, cell * 1.75, tp.flip); ctx.restore();
    const handing = fx.some((f) => f.kind === 'cup' && totalTime - f.t0 < 650);   // while a cup is being handed over, that cup is drawn by the effect
    if (st.cups.length && !handing && !st.over && !(tp.key === 'walk_up' || tp.key === 'bump' || tp.key === 'startled')) {
      const [hx, hy] = pawPos(tx, feet, tp.key, tp.flip), pv = hy + cell * 0.3;
      ctx.save(); ctx.translate(hx, pv); ctx.rotate(0.2 * jd * Math.sin(jt * 22) * (mv ? 0.6 : 1)); ctx.translate(-hx, -pv); drawCup(st.cups[0], hx, hy, cell * 0.62); ctx.restore(); steam(hx, hy, cell * 0.62);
      ctx.beginPath(); ctx.arc(hx, hy, cell * 0.42, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(253,175,30,' + (0.55 + 0.4 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke();
    }
  } });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();

  // speech bubbles: what each waiting visitor wants
  n.visitors.forEach((v, i) => {
    if (st.served[i]) return;
    const bx = px(v.x), by2 = pyFeet(v.y) - cell * 1.8;
    ctx.globalAlpha = targetIdx >= 0 && i !== targetIdx ? 0.55 : 1;
    ctx.fillStyle = 'rgba(20,16,46,.9)'; ctx.beginPath(); ctx.arc(bx, by2, cell * 0.48, 0, Math.PI * 2); ctx.fill();
    if (i === targetIdx) { ctx.strokeStyle = 'rgba(255,244,214,' + (0.5 + 0.5 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
    drawDrink(v.want, bx, by2, cell * 0.46); ctx.globalAlpha = 1;
  });
  // guide: a moving dashed line from Toddy to the visitor who wants his first cup
  if (st.cups.length && !st.over && targetIdx >= 0) {
    const v = n.visitors[targetIdx], gx = px(v.x), gy = pyFloor(v.y), sx = tx, sy = pyFloor(P[0].y), ang = Math.atan2(gy - sy, gx - sx), len = Math.hypot(gx - sx, gy - sy);
    if (len > REACH * cell + 6) {
      const ex = gx - Math.cos(ang) * REACH * cell, ey = gy - Math.sin(ang) * REACH * cell;
      ctx.save(); ctx.setLineDash([9, 9]); ctx.lineDashOffset = -totalTime / 40; ctx.strokeStyle = 'rgba(255,230,160,.8)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(255,230,160,.95)'; ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * 10, ey + Math.sin(ang) * 10); ctx.lineTo(ex + Math.cos(ang + 2.4) * 10, ey + Math.sin(ang + 2.4) * 10); ctx.lineTo(ex + Math.cos(ang - 2.4) * 10, ey + Math.sin(ang - 2.4) * 10); ctx.closePath(); ctx.fill();
    }
  }
  // effects: the served cup flying over, splashes, dust, hearts
  fx = fx.filter((f) => totalTime - f.t0 < f.ms);
  for (const f of fx) {
    const age = totalTime - f.t0;
    if (age < 0) continue;
    if (f.kind === 'cup') {
      const up = f.vy < f.y && Math.abs(f.vy - f.y) > Math.abs(f.vx - f.x);   // visitor above Toddy: he reaches up with both arms
      const hold = up ? 480 : 260, fly = Math.max(0, Math.min(1, (age - hold) / 380)), ease = fly * fly * (3 - 2 * fly), sdx = up ? 0 : Math.sign(f.vx - f.x);
      const sx0 = px(f.x) + sdx * cell * 0.3, sy0 = pyFeet(f.y) - cell * 0.62 - (up ? cell * 0.95 * Math.min(1, age / 420) : 0);
      const ex = px(f.vx) + Math.sign(f.x - f.vx) * cell * 0.1, ey = pyFeet(f.vy) + cell * 0.04 - cell * 0.62;
      drawCup(f.drink, sx0 + (ex - sx0) * ease, sy0 + (ey - sy0) * ease - Math.sin(ease * Math.PI) * cell * 0.35, cell * (0.62 - 0.02 * ease)); continue;
    }
    const i = Math.min(ANIMS[f.key].n - 1, Math.floor((age / 1000) * ANIMS[f.key].fps)), fade = age > f.ms - 260 ? Math.max(0, (f.ms - age) / 260) : 1;
    drawCentered(f.file, f.key, i, px(f.x) + (f.dx || 0) * cell, pyFeet(f.y) - cell * 0.5 + (f.dy || 0) * cell - (f.rise ? (age / f.ms) * cell * 0.5 : 0), cell * f.size, fade);
  }
  // "Give this" chip: the cup in Toddy's paws is the one that gets served next
  { const cw = 132, ch = 44, cx0 = ox, cy0 = Math.max(70, oy - ch - 10);
    ctx.fillStyle = 'rgba(20,16,46,.9)'; ctx.fillRect(cx0, cy0, cw, ch); ctx.strokeStyle = '#C99A3B'; ctx.lineWidth = 2; ctx.strokeRect(cx0, cy0, cw, ch);
    ctx.fillStyle = '#FDE3BD'; ctx.font = '600 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(frontWant >= 0 ? 'Give this' : 'No cups left', cx0 + 10, cy0 + 28);
    if (frontWant >= 0) drawDrink(frontWant, cx0 + cw - 26, cy0 + ch / 2, 16); }
  const hintY = Math.min(oy + cell * n.h + 34, H - 14);   // under the floor, or just above the bottom edge on a short window
  if (waiting) {
    const a = 0.5 + 0.5 * Math.sin(totalTime / 260);
    ctx.beginPath(); ctx.arc(tx, feet - cell * 0.5, cell * (0.75 + 0.12 * a), 0, Math.PI * 2); ctx.strokeStyle = 'rgba(253,175,30,' + (0.5 + 0.4 * a) + ')'; ctx.lineWidth = 3; ctx.stroke();
    outlined('Touch where Toddy should go', W / 2, hintY, 22);
  } else if (st.stop && !st.over && st.tx === null) outlined('Tap to move on', W / 2, hintY, 22);
  if (target && st.tx !== null && !st.over) {   // a soft pulsing ring where Toddy is heading
    const a = 0.5 + 0.5 * Math.sin(totalTime / 200);
    ctx.beginPath(); ctx.ellipse(px(target.x), pyFeet(target.y) + cell * 0.02, cell * (0.3 + 0.05 * a), cell * (0.16 + 0.03 * a), 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(253,175,30,' + (0.55 + 0.35 * a) + ')'; ctx.lineWidth = 3; ctx.stroke();
  }
  if (totalTime - confettiAt < 3800) {   // win confetti
    const cols = ['#FDAF1E', '#E04F7B', '#4FB3A0', '#6C8CFF', '#FFF4D6', '#B07CFF'], wrap = (v, m) => ((v % m) + m) % m, FW = cell * n.w, FH = cell * n.h;
    for (let k = 0; k < 70; k++) {
      const age = totalTime - confettiAt - (k % 14) * 90; if (age < 0) continue;
      const x = ox + wrap(k * 0.618 * FW * 3, FW) + Math.sin(age / 400 + k) * cell * 0.4, y = oy - cell * 0.4 + age * (FH / 2600) * (0.75 + (k % 5) * 0.12);
      ctx.save(); ctx.translate(x, y); ctx.rotate(age / 220 + k); ctx.globalAlpha = Math.min(1, (3800 - age) / 500); ctx.fillStyle = cols[k % 6]; ctx.fillRect(-cell * 0.06, -cell * 0.03 * (1 + Math.sin(age / 90 + k)), cell * 0.12, cell * 0.06); ctx.restore();
    }
  }
  // little floating notes
  flashes = flashes.filter((f) => totalTime - f.t0 < 900);
  for (const f of flashes) {
    const a = 1 - (totalTime - f.t0) / 900, fx1 = px(f.x), fy1 = pyFeet(f.y) - cell * 0.9 - (1 - a) * cell * 0.8;
    ctx.globalAlpha = a; ctx.font = '700 ' + Math.round(cell * 0.5) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#1a0a05'; ctx.lineWidth = 4; ctx.strokeText(f.text, fx1, fy1); ctx.fillStyle = f.color; ctx.fillText(f.text, fx1, fy1);
    if (f.drink !== undefined) drawDrink(f.drink, fx1 + cell * 0.5, fy1 - cell * 0.15, cell * 0.28);
    ctx.globalAlpha = 1;
  }
}

// ---- game flow ----
function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
function updateHud() {
  const c = st.served.filter(Boolean).length;
  $('served').textContent = 'Served ' + c + ' / ' + LEVEL.visitors.length;
  const f = (st.limit - st.t) / st.limit; music.setLevel(st.won || st.over ? 0 : f < 0.25 ? 2 : f < 0.5 ? 1 : 0);
  $('lanternFill').style.transform = 'scaleX(' + Math.max(0, f).toFixed(3) + ')';
}
function startRound() {
  running = false;
  const o = $('overlay'); o.textContent = ''; o.hidden = false; o.append(mk('div', 'card', 'Getting the floor ready…'));
  Promise.all(FILES.map(loadImg)).then(() => {
    st = newState(); pending = null; down = false; target = null; flashes = []; fx = []; acc = 0; last = 0; tod = null; lastMoveAt = -9999; endAt = 0; confettiAt = -99999; jiggleAt = -9999; face = 'up';
    sighUntil = LEVEL.visitors.map(() => 0); servedAt = LEVEL.visitors.map(() => 0); brewAt = [];
    prevPts = curPts = linePoints(st);
    o.hidden = true; o.textContent = '';
    music.play('menu'); resize(); updateHud(); running = true; waiting = true;   // Toddy waits for the first touch
  });
}
function showMenu() {
  if (musicGo) music.play('menu');
  const o = $('overlay'); o.textContent = ''; o.hidden = false; running = false;
  const card = mk('div', 'card');
  card.append(mk('h1', '', 'TODDY Free Walk'), mk('p', '', 'Sample · plain floor'), mk('p', '', '1 · Touch where Toddy should go'), mk('p', '', '2 · Bring each visitor their drink'), mk('p', '', '3 · Hurdles spill a cup'));
  const play = mk('button', 'btn', 'Play'); play.addEventListener('click', () => { unlockSound(); startRound(); });
  const spd = mk('button', 'btn alt', 'Walking speed: ' + speedName);
  spd.addEventListener('click', () => { const names = Object.keys(SPEEDS); speedName = names[(names.indexOf(speedName) + 1) % names.length]; try { localStorage.setItem('freeWalkSpeed', speedName); } catch (_) { /* optional */ } spd.textContent = 'Walking speed: ' + speedName; });
  card.append(play, spd); o.append(card);
}
function showResult() {
  const r = score(st), o = $('overlay'); o.textContent = ''; o.hidden = false; running = false;
  music.stinger(st.won);
  const card = mk('div', 'card');
  card.append(mk('h1', '', st.won ? 'All served!' : 'Lanterns out'), mk('div', 'big', String(r.score)), mk('p', '', 'Served ' + r.served + ' of ' + r.of + ' · ' + r.seconds + ' s · spilled ' + st.spills));
  const again = mk('button', 'btn', 'Play again'); again.addEventListener('click', startRound);
  const menu = mk('button', 'btn alt', 'Menu'); menu.addEventListener('click', showMenu);
  card.append(again, menu); o.append(card);
}
function unlockSound() { musicGo = true; music.resume(); }

function onEvents() {
  const n = LEVEL;
  for (const e of st.events) {
    if (e.type === 'serve') {
      SND.serve(); const v = n.visitors[e.visitor], f = faceToward(v.x - st.x, v.y - st.y); servedAt[e.visitor] = totalTime;
      flashes.push({ x: v.x, y: v.y, t0: totalTime, text: '', color: '#ff8fa3', drink: v.want });
      fx.push({ kind: 'cup', drink: v.want, x: st.x, y: st.y, vx: v.x, vy: v.y, t0: totalTime, ms: 800 });
      fx.push({ file: animFile('fx_heart'), key: 'fx_heart', x: v.x, y: v.y, dy: -1.05, size: 0.9, t0: totalTime + 640, ms: 1400, rise: true });
      face = f; if (f === 'down') setTod('hand_down', f, 1100, 'cancelOnMove'); else if (f === 'up') setTod('hand_up', f, 1300, 'cancelOnMove'); else setTod('hand_right', f, 1100, 'cancelOnMove');
    } else if (e.type === 'sigh') {
      SND.sigh(); const v = n.visitors[e.visitor]; sighUntil[e.visitor] = totalTime + 1300;
      flashes.push({ x: v.x, y: v.y, t0: totalTime, text: 'other drink', color: '#ff8f7a' });
    } else if (e.type === 'spill' || e.type === 'bump') {
      if (e.type === 'spill') SND.spill(); SND.bump();
      fx.push({ file: animFile('fx_dust'), key: 'fx_dust', x: st.x + st.hx * 0.55, y: st.y + st.hy * 0.55, size: 1.3, t0: totalTime, ms: 800 });
      if (e.type === 'spill') fx.push({ file: 'trail_anim_fx_splash_' + DRINK_NAMES[e.drink] + '_v01', key: 'fx_splash', x: st.x, y: st.y, dy: 0.25, size: 1.45, t0: totalTime, ms: 2000 });
      flashes.push({ x: st.x, y: st.y, t0: totalTime, text: e.type === 'spill' ? 'bumped! cup lost' : 'bump!', color: '#ff8f7a' });
      setTod('bump', face, 1600, 'cancelOnMove');
    } else if (e.type === 'brew') {
      SND.brew(); flashes.push({ x: st.x, y: st.y, t0: totalTime, text: '+1', color: '#fff4d6' }); brewAt[e.station] = totalTime;
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now; const dt = Math.min(now - last, 200); last = now; totalTime += dt;
  if (st && running) {
    const TMS = tickMs();
    if (!waiting && !st.over) acc += dt;
    let guard = 0;
    while (acc >= TMS && !st.over && guard++ < 8) {
      acc -= TMS; prevPts = curPts;
      const was = { x: st.x, y: st.y }, cmd = pending; pending = null;
      step(st, cmd);
      if (st.x !== was.x || st.y !== was.y) { lastMoveAt = totalTime; updateFace(); }
      curPts = linePoints(st);
      onEvents(); updateHud();
    }
    if (guard >= 8) acc = 0;
    if (st.over && !endAt) {
      endAt = totalTime; updateHud();
      if (st.won) { SND.win(); confettiAt = totalTime; tod = { key: 'win', flip: false, t0: totalTime, until: totalTime + 4000 }; fx.push({ file: animFile('fx_heart'), key: 'fx_heart', x: st.x, y: st.y, dy: -1.3, size: 1.1, t0: totalTime, ms: 1500, rise: true }); }
      else tod = { key: 'startled', flip: false, t0: totalTime, until: totalTime + 4000 };
    }
    if (st.over && endAt && totalTime - endAt > 2100) { draw(1); showResult(); return; }
  }
  draw(st && running ? Math.min(acc / tickMs(), 1) : 1);
}

// ---- input: touch (or click) a spot and Toddy walks there in a straight line; hold and drag and he follows your finger ----
function toFloor(e) {   // the touched point as Toddy's footprint centre (his feet land on the finger), kept inside the floor
  const r = cv.getBoundingClientRect();
  return clampPoint((e.clientX - r.left - ox) / cell, (e.clientY - r.top - oy) / cell - FOOT);
}
function aim(e, fresh) {
  const p = toFloor(e); pending = { x: p.x, y: p.y, fresh: fresh || !!(pending && pending.fresh) }; target = p;   // a fresh touch stays fresh even if a drag arrives before the next tick
  if (fresh) { waiting = false; SND.turn(); acc = Math.max(acc, tickMs() * 0.9); }   // answer a fresh touch at once
}
cv.addEventListener('pointerdown', (e) => { if (down) return; down = true; padId = e.pointerId; unlockSound(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* optional */ } if (running && st && !st.over) aim(e, true); });
cv.addEventListener('pointermove', (e) => { if (!down || e.pointerId !== padId || !running || !st || st.over) return; aim(e, false); });   // lifting the finger does NOT stop him: he walks on to the spot
const up = (e) => { if (e && e.pointerId !== padId) return; down = false; padId = null; };
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
$('btnSound').addEventListener('click', () => { soundOn = !soundOn; music.setEnabled(soundOn); $('btnSound').setAttribute('aria-pressed', String(soundOn)); $('btnSound').style.opacity = soundOn ? '1' : '.55'; unlockSound(); });

resize(); requestAnimationFrame(frame);
{ const o = $('overlay'); o.textContent = ''; o.append(mk('div', 'card', 'Loading TODDY Free Walk…')); }
Promise.all(FILES.map(loadImg)).then(() => { resize(); showMenu(); });
