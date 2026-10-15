// TODDY: Moon Brew — screens, drawing, sound and saving.
import { DX, DY, MAX_BUMPS, generate, newGame, beanAt, frozen, unitOf, traceBean, canRoll, tap, stars, hint, useHint, dailyScore, streaks, fromFrozen } from './core.js';
import { TRAYS } from './trays.js';
import { NIGHTS, INTROS, TRAYS_PER_NIGHT, trayConfig, dailyConfig, dailyNumber, endlessConfig, ENDLESS_LINES } from './levels.js';

const BUILD = '1.0.0-rc8';
const ASSET = 'assets/';
const $ = (id) => document.getElementById(id);
const systemCalm = matchMedia('(prefers-reduced-motion: reduce)');
const PLAYTEST = false; // tools/build_playtest.mjs switches this on for the private playtest copy
// Same links as Night Shift (night-shift/src/game/scenes/AboutScene.js, ui/ShareCard.js).
const SHARE_URL = 'https://toddy.meme/games/moon-brew/';
const BUG_REPORT_URL = 'https://t.me/ToddyCoinCommunity'; // the TODDY community Telegram (from toddy.meme)
const PRIVACY_URL = 'https://toddy.meme/privacy.html';

// Outside links are real <a href target="_blank"> links, never window.open from script.
// Real links open in a new tab on the website AND from the claude.ai preview (the viewer opens them
// outside its sandbox), while script-opened pages inherit the sandbox and sites like x.com refuse to load.
function isFramed() { try { return window.top !== window.self; } catch (e) { return true; } }
function linkTo(el, url) { el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }

function calm() { return !!(save && save.calm) || systemCalm.matches; }

// ---------------- Saving ----------------
const SAVE_KEY = 'toddy.moonbrew.v1';
const save = Object.assign({ stars: {}, daily: {}, endlessBest: 0, postcards: [], intros: {}, sound: true, unlockAll: false, calm: false, bigText: false, stats: true }, readSave());
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch (e) { return {}; } }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked: play still works */ } }
const trayKey = (n, t) => `n${n + 1}-${t}`;

// ---------------- Anonymous play stats ----------------
// Off until the Phase B server exists: events are only sent when STATS_URL is set.
// Each event: what happened, a random install number (not a name), the build, and a few numbers.
const STATS_URL = ''; // later: '/api/events' on the Cloudflare Worker
const statsQueue = [];
function installId() {
  if (!save.anon) { save.anon = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); writeSave(); }
  return save.anon;
}
function track(e, d = {}) {
  if (!save.stats || navigator.doNotTrack === '1') return;
  statsQueue.push({ e, d, t: Date.now(), id: installId(), v: BUILD });
  if (statsQueue.length > 200) statsQueue.shift();
  if (statsQueue.length >= 20) flushStats();
}
function flushStats() {
  if (!STATS_URL || !statsQueue.length) return;
  try {
    const body = JSON.stringify(statsQueue.splice(0));
    if (!(navigator.sendBeacon && navigator.sendBeacon(STATS_URL, body))) fetch(STATS_URL, { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch (e) { /* stats never break the game */ }
}
addEventListener('pagehide', flushStats);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { flushStats(); hiddenAt = performance.now(); }
  else if (hiddenAt) {
    // Time spent outside the game does not count against the Daily speed score or the hint timer.
    const away = performance.now() - hiddenAt; hiddenAt = 0;
    if (typeof startedAt === 'number') startedAt += away;
    if (typeof lastMove === 'number') lastMove += away;
  }
});

// ---------------- Images ----------------
const images = {};
function img(name) {
  if (!images[name]) {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { if (current === 'play') { requestAnimationFrame(draw); drawToddy(); } };
    im.src = ASSET + name;
    images[name] = im;
  }
  return images[name];
}
const ready = (im) => im && im.complete && im.naturalWidth > 0;
const BEAN_IMG = ['bean_light_v01.webp', 'bean_medium_v01.webp', 'bean_dark_v01.webp'];
const ROAST_NAME = ['light', 'medium', 'dark'];
const VISITOR = { milo: ['visitor_milo_v02.webp', 'Milo the owl'], moth: ['visitor_moth_v01.webp', 'The sleepy moth'], star: ['visitor_star_v01.webp', 'The lost star'] };
// Reaction poses (approved 2026-10-15): "happy" after a cleared tray, "wow" for 3 stars.
const VISITOR_POSE = (v, pose) => `visitor_${v}_${pose}_v01.webp`;
[...BEAN_IMG, 'bean_sleepy_v01.webp', 'ice_v01.webp', 'sugar_v01.webp', 'milk_v01.webp'].forEach(img);

// ---------------- Toddy's expressions (Night Shift flipbooks) ----------------
const toddy = { clips: null, name: 'happy', t0: 0, playing: false, cv: null, ctx: null };
const CLIP_FPS = 24;
fetch(ASSET + 'toddy_clips.json').then(r => r.json()).then(meta => {
  toddy.clips = meta;
  if (current === 'play') warmToddy();
}).catch(() => { /* Toddy panel stays empty; the game still works */ });
// Toddy's animations are the biggest files, so they load only once a tray is open,
// and each reaction loads the first time it is needed (cheap phones start faster).
function warmToddy() {
  if (!toddy.clips) return;
  img(toddy.clips.happy.file); img(toddy.clips.wave.file);
  drawToddy();
}
function toddyPlay(name) {
  if (!toddy.clips || !toddy.clips[name]) return;
  if (!ready(img(toddy.clips[name].file))) { drawToddy(); return; } // starts loading; plays next time
  toddy.name = name; toddy.t0 = performance.now(); toddy.playing = true;
  requestAnimationFrame(drawToddy);
}
function drawToddy(now) {
  if (!toddy.ctx) return;
  const c = toddy.clips && toddy.clips[toddy.name];
  const ctx = toddy.ctx;
  ctx.clearRect(0, 0, toddy.cv.width, toddy.cv.height);
  if (!c) return;
  const im = img(c.file);
  if (!ready(im)) { if (toddy.playing) requestAnimationFrame(drawToddy); return; }
  let i = 0;
  if (toddy.playing) {
    i = Math.floor(((now || performance.now()) - toddy.t0) / 1000 * CLIP_FPS);
    if (calm()) i = Math.floor(c.frames * 0.45);
    if (i >= c.frames) { toddy.playing = false; i = 0; toddy.name = 'happy'; return drawToddy(); }
  }
  const cc = toddy.clips[toddy.name];
  const sx = (i % cc.cols) * cc.w, sy = Math.floor(i / cc.cols) * cc.h;
  const s = Math.min(toddy.cv.width / cc.w, toddy.cv.height / cc.h);
  const dw = cc.w * s, dh = cc.h * s;
  ctx.drawImage(img(cc.file), sx, sy, cc.w, cc.h, (toddy.cv.width - dw) / 2, toddy.cv.height - dh, dw, dh);
  if (toddy.playing && !calm()) requestAnimationFrame(drawToddy);
}

// ---------------- Sound (made in code, no audio files) ----------------
// iPhone (owner report 2026-10-13, same fix as Night Shift 1.3.74): Safari only unlocks web sound on a finished tap
// (touchend / pointerup / click, not touchstart / pointerdown), its sound can be "interrupted" after a call or app
// switch, and the ringer switch mutes web sound unless the page asks for the "playback" audio session.
let actx = null;
let sessionDone = false;
function iosPlaybackSession() {
  if (sessionDone) return;
  sessionDone = true;
  try {
    if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; } // Safari 16.4+
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios) return;
    // Older iPhones: playing 0.1 s of silence through an <audio> element has the same effect (blob: is allowed by the games CSP).
    const n = 2205, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 22050, true); v.setUint32(28, 44100, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    a.setAttribute('playsinline', ''); a.play().catch(() => { sessionDone = false; });
  } catch (e) { /* not supported */ }
}
function unlockTick() { // one silent sample: on iPhone this is what actually unlocks sound inside a tap
  try { const b = actx.createBuffer(1, 1, 22050), s = actx.createBufferSource(); s.buffer = b; s.connect(actx.destination); s.start(0); } catch (e) { /* nothing to unlock */ }
}
function wakeAudio() { // called on every real tap / key press; cheap after the first
  if (!save.sound) return;
  iosPlaybackSession();
  try {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      actx = new AC();
      unlockTick();
    }
    if (actx.state !== 'running') actx.resume().then(unlockTick).catch(() => {});
  } catch (e) { actx = null; }
}
for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown']) addEventListener(ev, wakeAudio, { passive: true, capture: true });
document.addEventListener('visibilitychange', () => {
  if (!actx) return;
  if (document.hidden) actx.suspend().catch(() => {});
  else if (save.sound) actx.resume().catch(() => {});
});
function audio() {
  if (!save.sound) return null;
  try {
    if (!actx) wakeAudio();
    if (actx && actx.state !== 'running') actx.resume().catch(() => {});
  } catch (e) { return null; }
  return actx;
}
function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = 0, delay = 0) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol = 0.1, delay = 0) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4; g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination); s.start(t);
}
const sfx = {
  roll: () => { noise(0.18, 1400, 0.08); noise(0.22, 600, 0.09, 0.16); },
  bump: () => { tone(150, 0.16, 'sine', 0.2, 80); noise(0.06, 300, 0.08); },
  wake: () => { tone(660, 0.09, 'triangle', 0.08); tone(990, 0.12, 'triangle', 0.08, 0, 0.08); },
  frozen: () => { tone(1800, 0.05, 'triangle', 0.05); tone(2400, 0.05, 'triangle', 0.04, 0, 0.05); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.1, 0, i * 0.11)),
  burnt: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, 0, i * 0.14)),
  tick: () => tone(880, 0.05, 'triangle', 0.05),
  grind: () => { noise(0.09, 2600, 0.05); noise(0.12, 900, 0.05, 0.03); },
  pour: () => { noise(0.7, 500, 0.05); tone(330, 0.5, 'sine', 0.03, 220, 0.1); },
  star: (i) => tone([784, 988, 1175][i] || 1175, 0.18, 'triangle', 0.07),
  lost: () => tone(220, 0.16, 'sine', 0.05, 180),
};
function setSound(on) {
  save.sound = on; writeSave();
  $('play-sound').classList.toggle('off', !on);
  if (on) { wakeAudio(); sfx.tick(); } // still inside the tap that switched sound on
  else if (actx) actx.suspend().catch(() => {});
}

// ---------------- Screens ----------------
const SCREENS = ['title', 'map', 'play', 'album', 'howto', 'stats', 'about'];
let current = 'title';
function show(name) {
  current = name;
  SCREENS.forEach(s => { $('screen-' + s).hidden = s !== name; });
  document.body.classList.toggle('playing', name === 'play');
  if (name === 'title') renderTitle();
  if (name === 'map') renderMap();
  if (name === 'album') renderAlbum();
  if (name === 'stats') renderStats();
  if (name === 'about') { $('about-version').textContent = `Moon Brew ${BUILD}`; $('about-msg').textContent = 'Found something broken or confusing? Tell us in the TODDY Telegram group.'; }
  if (name === 'play') { warmToddy(); placeAmbient(); resizeBoard(); requestAnimationFrame(() => { resizeBoard(); draw(); }); }
}

function nightCleared(n) { return !!save.stars[trayKey(n, TRAYS_PER_NIGHT)]; }
function unlocked() { return PLAYTEST && save.unlockAll; }
function nightOpen(n) { return unlocked() || n === 0 || nightCleared(n - 1); }
function trayOpen(n, t) { return unlocked() || (nightOpen(n) && (t === 1 || !!save.stars[trayKey(n, t - 1)])); }
function endlessOpen() { return unlocked() || nightCleared(0); }
function totalStars() { return Object.entries(save.stars).filter(([k]) => k.startsWith('n')).reduce((s, [, v]) => s + v, 0); }

function renderTitle() {
  const today = save.daily[dailyNumber()];
  const st = dailyStreak();
  $('daily-status').textContent = today ? `Today: ${today.score || 0} pts${st.current > 1 ? ` · 🔥 ${st.current}` : ''}` : (st.current ? `Keep your ${st.current}-day streak` : 'New tray today');
  $('btn-daily').classList.toggle('glow', !today); // gentle glow until today's Daily Brew is played
  $('endless-status').textContent = endlessOpen() ? (save.endlessBest ? `Best ${save.endlessBest}` : 'Open') : 'Finish Night 1 to open';
  $('btn-endless').classList.toggle('locked', !endlessOpen());
  $('build-label').textContent = PLAYTEST ? `Playtest build ${BUILD} · nothing here is public yet` : `Moon Brew ${BUILD}`;
}

// ---------------- Map ----------------
let mapNight = 0;
function renderMap() {
  const tabs = $('night-tabs');
  tabs.textContent = '';
  NIGHTS.forEach((night, n) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(n === mapNight));
    b.textContent = night.name;
    if (!nightOpen(n)) { b.disabled = true; b.title = `Finish ${NIGHTS[n - 1].name} to open`; }
    b.addEventListener('click', () => { mapNight = n; renderMap(); });
    tabs.appendChild(b);
  });
  const night = NIGHTS[mapNight];
  $('night-visitor').src = ASSET + VISITOR[night.visitor][0];
  $('night-visitor').alt = night.visitorName;
  $('night-name').textContent = `${night.name} · ${night.visitorName}`;
  $('night-title').textContent = night.title;
  let got = 0;
  for (let t = 1; t <= TRAYS_PER_NIGHT; t++) got += save.stars[trayKey(mapNight, t)] || 0;
  $('night-sub').textContent = `${got} of ${TRAYS_PER_NIGHT * 3} stars · tray 20 earns a postcard`;
  $('map-stars').textContent = `★ ${totalStars()}/180`;
  const grid = $('trays');
  grid.textContent = '';
  let nextMarked = false;
  for (let t = 1; t <= TRAYS_PER_NIGHT; t++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tray-btn' + (t === TRAYS_PER_NIGHT ? ' finale' : '');
    const s = save.stars[trayKey(mapNight, t)] || 0;
    const open = trayOpen(mapNight, t);
    if (!open) b.classList.add('locked');
    if (open && !s && !nextMarked) { b.classList.add('next'); nextMarked = true; }
    b.innerHTML = `<span>${t === TRAYS_PER_NIGHT ? '☾' : t}</span><small>${'★'.repeat(s)}</small>`;
    b.setAttribute('aria-label', `Tray ${t}${s ? `, ${s} stars` : ''}${open ? '' : ', locked'}`);
    b.addEventListener('click', () => { if (open) startTray(mapNight, t); else say2map(t); });
    grid.appendChild(b);
  }
  $('unlock-all').checked = !!save.unlockAll;
  $('unlock-all').closest('label').hidden = !PLAYTEST;
}
function say2map(t) { $('night-sub').textContent = `Tray ${t} opens after you clear tray ${t - 1}.`; }

// ---------------- My Brew dashboard ----------------
function dailyWaiting() { return !save.daily[dailyNumber()]; }
function dailyStreak() { return streaks(Object.keys(save.daily).map(Number), dailyNumber()); }
function renderStats() {
  const st = dailyStreak();
  const dailies = Object.values(save.daily);
  const bestDaily = dailies.reduce((m, d) => Math.max(m, d.score || 0), 0);
  const today = save.daily[dailyNumber()];
  const cleared = Object.keys(save.stars).length;
  const perfect = Object.values(save.stars).filter(v => v === 3).length;
  const nightRows = NIGHTS.map((night, n) => {
    let got = 0;
    for (let t = 1; t <= TRAYS_PER_NIGHT; t++) got += save.stars[trayKey(n, t)] || 0;
    return `<div class="nightbar"><span>${night.name}</span><span class="track"><i data-w="${Math.round(100 * got / 60)}"></i></span><span>★ ${got}</span></div>`;
  }).join('');
  // last 7 days, oldest first
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const num = dailyNumber(d);
    days.push(`<span class="d${save.daily[num] ? ' done' : ''}${i === 0 ? ' today' : ''}" title="${d.toISOString().slice(0, 10)}">${'SMTWTFS'[d.getUTCDay()]}</span>`);
  }
  $('stats').innerHTML = `
    <div class="tile hot"><span class="k">Daily streak</span><span class="v">${st.current} <small>day${st.current === 1 ? '' : 's'}</small></span><span class="sub">Best: ${st.best}</span></div>
    <div class="tile"><span class="k">Today</span><span class="v">${today ? today.score || 0 : '–'}<small>${today ? ' / 1000' : ''}</small></span><span class="sub">${today ? `${today.time}s · ${today.bumps} bump${today.bumps === 1 ? '' : 's'}` : 'Not brewed yet'}</span></div>
    <div class="tile wide"><span class="k">Last 7 Daily Brews</span><div class="week">${days.join('')}</div></div>
    <div class="tile"><span class="k">Best Daily</span><span class="v">${bestDaily || '–'}</span><span class="sub">${dailies.length} played</span></div>
    <div class="tile"><span class="k">Endless best</span><span class="v">${save.endlessBest || '–'}</span><span class="sub">points in one run</span></div>
    <div class="tile wide"><span class="k">Stars</span><span class="v">${totalStars()} <small>/ 180</small></span>${nightRows}</div>
    <div class="tile"><span class="k">Trays cleared</span><span class="v">${cleared} <small>/ 60</small></span><span class="sub">${perfect} Perfect Brews</span></div>
    <div class="tile"><span class="k">Postcards</span><span class="v">${save.postcards.length} <small>/ 3</small></span><span class="sub">tray 20 of each Night</span></div>`;
  $('stats').querySelectorAll('.track i').forEach(el => { el.style.width = el.dataset.w + '%'; });
}

// ---------------- Album ----------------
function renderAlbum() {
  const a = $('album');
  a.textContent = '';
  NIGHTS.forEach((night, n) => {
    const have = save.postcards.includes(night.id);
    const d = document.createElement('figure');
    d.className = 'pc' + (have ? '' : ' locked');
    d.style.margin = '0';
    const marked = have && (save.marks || []).includes(night.id);
    d.innerHTML = `<img src="${ASSET}postcard_n${n + 1}_v01.webp" alt="${have ? night.title + ' postcard' : 'Locked postcard'}">${marked ? `<img class="pc-mark" src="${ASSET}mark_v01.svg" alt="A small crown mark">` : ''}<figcaption class="cap"><b>${night.title}</b><span>${have ? night.name : 'Finish ' + night.name}</span></figcaption>`;
    a.appendChild(d);
  });
}

// ---------------- Play state ----------------
let mode = null;     // { kind: 'story', n, t } | { kind: 'daily', num } | { kind: 'endless', seed, k, score }
let level = null, g = null;
let anims = [];
let hintBean = null, cursor = null;
let startedAt = 0;
let finishTimer = 0;

function startTray(n, t) { mode = { kind: 'story', n, t }; const f = TRAYS[trayKey(n, t)]; load(f ? null : trayConfig(n, t), f ? fromFrozen(f) : null); }
function startDaily() { const cfg = dailyConfig(); mode = { kind: 'daily', num: cfg.daily, visitor: cfg.visitor }; load(cfg); }
function startEndless(cont) {
  if (!cont) mode = { kind: 'endless', seed: (Date.now() % 1e9) >>> 0, k: 0, score: 0 };
  load(endlessConfig(mode.seed, mode.k));
}

function load(cfg, ready) {
  clearTimeout(finishTimer);
  level = ready || generate(cfg);
  g = newGame(level);
  anims = []; hintBean = null; cursor = null;
  startedAt = performance.now();
  resetIdle();
  $('overlay').hidden = true;
  let vis = 'milo', line = '';
  if (mode.kind === 'story') {
    const night = NIGHTS[mode.n];
    vis = night.visitor; line = night.lines[mode.t - 1];
    $('where').textContent = `${night.name} · ${mode.t === TRAYS_PER_NIGHT ? 'Finale' : 'Tray ' + mode.t}`;
  } else if (mode.kind === 'daily') {
    vis = mode.visitor;
    line = save.daily[mode.num] ? `Practice run. Today\u2019s score: ${save.daily[mode.num].score}.` : 'Today\u2019s puzzle. Same for everyone.';
    $('where').textContent = 'Daily Brew';
  } else {
    vis = ['milo', 'moth', 'star'][mode.k % 3]; line = ENDLESS_LINES[mode.k % ENDLESS_LINES.length];
    $('where').textContent = `Endless · Tray ${mode.k + 1} · ${mode.score} pts`;
  }
  mode.vis = vis;
  coachPerfect = true;
  $('vis-img').src = ASSET + VISITOR[vis][0];
  $('vis-img').alt = VISITOR[vis][1];
  $('vis-img').classList.remove('pop');
  $('vis-name').textContent = VISITOR[vis][1];
  $('vis-line').textContent = line;
  // one line at a time: the visitor's line shows first, then makes room for Toddy's short lines
  const bubble = $('vis-line').closest('.bubble');
  bubble.classList.remove('faded'); clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.add('faded'), 4500);
  [VISITOR_POSE(vis, 'happy'), VISITOR_POSE(vis, 'wow'), 'cup_v01.webp'].forEach(img); // ready for the serve
  say('');
  // first-time coaching: ring the bean that matters, one short line
  coach = null;
  const tipKey = mode.kind === 'story' ? trayKey(mode.n, mode.t) : null;
  if (tipKey && INTROS[tipKey] && !save.intros[tipKey]) startCoach(tipKey);
  // a small mystery: one bean in each Night's finale carries a crown mark
  markBean = mode.kind === 'story' && mode.t === TRAYS_PER_NIGHT ? g.beans[level.solution[level.solution.length - 1][0]] : null;
  cup.steam = false; cupTo(0, true);
  hud();
  show('play');
  toddyPlay('wave');
  track('tray_start', modeInfo());
}

// ---------------- First-time coaching ----------------
let coach = null, markBean = null, bubbleTimer = 0;
function startCoach(k) {
  const c = INTROS[k];
  let target = null;
  if (c.on === 'first') target = g.beans[level.solution[0][0]];
  else if (c.on === 'sleepy') target = g.beans.find(b => !b.awake);
  else if (c.on === 'ice') target = g.beans.find(b => b.ice > 0);
  else if (c.on === 'pair') target = g.beans.find(b => b.pair >= 0);
  else if (c.on === 'milk') {
    for (const ids of level.solution) { // the first bean whose path crosses milk
      const b = g.beans[ids[0]]; const tr = traceBean(g, b, [b]);
      if (tr && tr.cells && tr.cells.some(cl => level.swirls.includes(cl.x + ',' + cl.y))) { target = b; break; }
    }
    target = target || g.beans[level.solution[0][0]];
  }
  coach = { key: k, target, line: c.line, t0: performance.now() };
  say(c.line);
  track('tip', { tip: k });
}
function endCoach() {
  if (!coach) return;
  save.intros[coach.key] = 1; writeSave();
  coach = null;
}

function hud() {
  const t = $('ticket');
  t.textContent = '';
  t.classList.toggle('none', !level.ticket.length);
  const lab = document.createElement('span'); lab.className = 'label';
  lab.textContent = level.ticket.length ? 'Grind first' : 'No order ticket';
  t.appendChild(lab);
  level.ticket.forEach((r, i) => {
    const c = document.createElement('span'); c.className = 'chip';
    if (i < g.removedRoasts.length) c.classList.add(g.removedRoasts[i] === r ? 'done' : 'miss');
    else if (g.perfect && i === g.removedRoasts.length && g.status === 'playing') c.classList.add('next');
    const im = document.createElement('img'); im.src = ASSET + BEAN_IMG[r]; im.alt = ROAST_NAME[r];
    c.appendChild(im); t.appendChild(c);
  });
  t.classList.toggle('lost', !g.perfect);
  [...$('cracks').children].forEach((c, i) => c.classList.toggle('used', i < g.bumps));
  const left = g.beans.filter(b => !b.gone).length;
  $('count').textContent = `${g.rolled} ground, ${left} left`;
  // the three stars, live: lit = still yours, grey = lost, glowing = earned
  const won = g.status === 'won';
  $('goal-clear').className = 'goal' + (won ? ' won' : '');
  $('goal-clean').className = 'goal' + (g.bumps ? ' lost' : won ? ' won' : ' keep');
  $('goal-order').className = 'goal' + (!g.perfect ? ' lost' : won ? ' won' : ' keep');
  cupTo(g.rolled / level.beans.length);
}
function say(s) { $('say').textContent = s; }

// ---------------- The cup: every ground bean fills it ----------------
const cupCv = $('cup'), cupCtx = cupCv.getContext('2d');
const cup = { level: 0, from: 0, to: 0, t0: 0, drip: 0, steam: false };
function cupTo(v, instant) {
  if (instant || calm()) { cup.level = cup.from = cup.to = v; drawCup(); return; }
  if (v > cup.to) cup.drip = performance.now();
  cup.from = cup.level; cup.to = v; cup.t0 = performance.now();
  requestAnimationFrame(drawCup);
}
function drawCup(now) {
  now = now || performance.now();
  const c = cupCtx, W = cupCv.width, H = cupCv.height;
  const k = Math.min(1, (now - cup.t0) / 450);
  cup.level = cup.from + (cup.to - cup.from) * (1 - Math.pow(1 - k, 3));
  c.clearRect(0, 0, W, H);
  // mug body (colours from the approved Moon Brew cup: cream #FEF1D8, gold #FCB036, coffee #702806)
  const x0 = 14, x1 = 70, top = 22, bot = 80;
  c.lineWidth = 4; c.strokeStyle = '#341809';
  c.beginPath(); c.arc(66, 50, 13, -Math.PI / 2, Math.PI / 2); c.stroke(); // handle outline
  c.lineWidth = 2.5; c.strokeStyle = "#FCB036"; c.beginPath(); c.arc(66, 50, 13, -Math.PI / 2, Math.PI / 2); c.stroke();
  c.beginPath(); c.moveTo(x0, top); c.lineTo(x1, top); c.lineTo(x1 - 4, bot - 6); c.quadraticCurveTo(x1 - 6, bot, x1 - 14, bot);
  c.lineTo(x0 + 14, bot); c.quadraticCurveTo(x0 + 6, bot, x0 + 4, bot - 6); c.closePath();
  c.fillStyle = '#FEF1D8'; c.fill();
  // coffee inside, clipped to the mug
  c.save(); c.clip();
  const lv = bot - (bot - top - 4) * cup.level;
  c.fillStyle = '#702806'; c.fillRect(0, lv, W, H);
  c.fillStyle = '#9a4a1c'; c.fillRect(0, lv, W, 3); // crema line
  if (cup.level > 0.99) { // full: the crescent latte art appears
    c.fillStyle = '#FBD6A4'; c.beginPath(); c.arc(42, lv + 9, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#702806'; c.beginPath(); c.arc(46, lv + 7, 7, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  c.lineWidth = 3; c.strokeStyle = '#341809'; c.stroke();
  c.fillStyle = '#FCB036'; c.fillRect(x0 - 1, top - 3, x1 - x0 + 2, 5); // gold rim
  // a drop falls in when a bean is ground
  const dt = now - cup.drip;
  if (dt < 380 && !calm()) { const y = 2 + dt / 380 * (lv - 4); c.fillStyle = '#702806'; c.beginPath(); c.ellipse(42, y, 3, 4.5, 0, 0, Math.PI * 2); c.fill(); }
  // steam once the brew is ready
  if (cup.steam) {
    c.strokeStyle = 'rgba(255,248,238,.8)'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const ph = calm() ? 0 : now / 400 + i * 2;
      c.beginPath(); c.moveTo(34 + i * 16, top - 4);
      c.bezierCurveTo(28 + i * 16 + Math.sin(ph) * 5, top - 10, 40 + i * 16 - Math.sin(ph) * 5, top - 14, 34 + i * 16, top - 20); c.stroke();
    }
  }
  if (k < 1 || dt < 380 || (cup.steam && !calm() && current === 'play')) requestAnimationFrame(drawCup);
}

// ---------------- Board geometry & drawing ----------------
const cv = $('board');
const ctx = cv.getContext('2d');
let S = 300, cell = 30, ox = 0, oy = 0;
function resizeBoard() {
  if (!level) return;
  const wrap = $('board-wrap').getBoundingClientRect();
  const size = Math.max(160, Math.floor(Math.min(wrap.width, wrap.height)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  S = size;
  cv.style.width = size + 'px'; cv.style.height = size + 'px';
  cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.max(level.w, level.h);
  cell = (size - 20) / n;
  ox = (size - cell * level.w) / 2; oy = (size - cell * level.h) / 2;
}
const cxp = x => ox + (x + 0.5) * cell;
const cyp = y => oy + (y + 0.5) * cell;
const ANG = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function draw(now) {
  if (current !== 'play' || !level) return;
  now = now || performance.now();
  ctx.clearRect(0, 0, S, S);
  // tray: soft shadow, then cream tiles
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = cell * 0.5; ctx.shadowOffsetY = cell * 0.12;
  ctx.fillStyle = '#d8bb92';
  for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) if (level.mask[y][x]) { rr(ox + x * cell - 2, oy + y * cell - 2, cell + 4, cell + 4, cell * 0.22); ctx.fill(); }
  ctx.restore();
  for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) {
    if (!level.mask[y][x]) continue;
    ctx.fillStyle = '#ead6b5';
    rr(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4, cell * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(120,80,40,.10)';
    rr(ox + x * cell + 2, oy + y * cell + cell * 0.55, cell - 4, cell * 0.43, cell * 0.18); ctx.fill();
  }
  // milk swirls
  const milk = img('milk_v01.webp');
  for (const k of level.swirls) {
    const [x, y] = k.split(',').map(Number);
    if (ready(milk)) drawFit(milk, cxp(x), cyp(y), cell * 0.92, 0, 1);
    ctx.save(); ctx.translate(cxp(x) + cell * 0.3, cyp(y) - cell * 0.3); // little turn arrow
    ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, cell * 0.1, Math.PI, Math.PI * 2.2); ctx.stroke(); ctx.restore();
  }
  // beans (static first, moving on top)
  const moving = new Map(anims.map(a => [a.bean, a]));
  const drawn = [];
  for (const b of g.beans) {
    const a = moving.get(b);
    if (b.gone && !a) continue;
    drawn.push([b, a]);
  }
  // sugar links under the beans
  for (const [b, a] of drawn) {
    if (b.pair > b.id || b.pair < 0) continue;
    const p = g.beans[b.pair];
    if (a || moving.get(p)) continue;
    if (p.gone) continue;
    // a sugary bridge joins the two beans
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cxp(b.x), cyp(b.y)); ctx.lineTo(cxp(p.x), cyp(p.y));
    ctx.strokeStyle = 'rgba(214,150,40,.8)'; ctx.lineWidth = cell * 0.3 + 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,247,234,.95)'; ctx.lineWidth = cell * 0.3; ctx.stroke();
    ctx.restore();
  }
  for (const [b, a] of drawn) if (!a) drawBean(b, cxp(b.x), cyp(b.y), ANG[b.dir], 1, 1);
  for (const [b, a] of drawn) {
    if (!a) continue;
    const t = Math.min(1, (now - a.t0) / a.dur);
    if (a.kind === 'roll') {
      const PRE = 0.14; // a tiny wind-up before it rolls
      if (t < PRE) {
        const k = Math.sin(t / PRE * Math.PI) * cell * 0.1, d = a.pts[0].d;
        drawBean(b, a.pts[0].x - DX[d] * k, a.pts[0].y - DY[d] * k, ANG[d], 1, 1 + Math.sin(t / PRE * Math.PI) * 0.06);
      } else {
        const u = (t - PRE) / (1 - PRE);
        const p = along(a.pts, u * u * (3 - 2 * u) * 0.35 + u * 0.65);
        drawBean(b, p.x, p.y, p.ang, u > 0.8 ? (1 - u) / 0.2 : 1, 1);
      }
    } else if (a.kind === 'bump') {
      // knock forward, bounce back past the start, settle
      const k = (t < 0.5 ? Math.sin(t / 0.5 * Math.PI) * 0.28 : -Math.sin((t - 0.5) / 0.5 * Math.PI) * 0.07 * (1 - t)) * cell;
      drawBean(b, cxp(b.x) + DX[b.dir] * k, cyp(b.y) + DY[b.dir] * k, ANG[b.dir], 1, 1);
    } else if (a.kind === 'shake') {
      drawBean(b, cxp(b.x) + Math.sin(t * Math.PI * 6) * cell * 0.06 * (1 - t), cyp(b.y), ANG[b.dir], 1, 1);
    } else if (a.kind === 'wake') {
      drawBean(b, cxp(b.x), cyp(b.y), ANG[b.dir], 1, 1 + Math.sin(t * Math.PI) * 0.18);
    }
  }
  // sugar cubes on top of the links
  const sugar = img('sugar_v01.webp');
  for (const [b, a] of drawn) {
    if (b.pair > b.id || b.pair < 0 || a) continue;
    const p = g.beans[b.pair]; if (p.gone || moving.get(p)) continue;
    if (ready(sugar)) drawFit(sugar, (cxp(b.x) + cxp(p.x)) / 2, (cyp(b.y) + cyp(p.y)) / 2, cell * 0.44, 0, 1);
  }
  // blocked flash
  for (const a of anims) if (a.kind === 'bump' && a.block) {
    const t = (now - a.t0) / a.dur;
    if (t < 1) { ctx.fillStyle = `rgba(255,120,100,${0.45 * (1 - t)})`; rr(ox + a.block.x * cell + 2, oy + a.block.y * cell + 2, cell - 4, cell - 4, cell * 0.2); ctx.fill(); }
  }
  // first-time coaching: a breathing gold ring on the bean that matters, and where it will roll
  let again = false;
  if (coach && coach.target && !coach.target.gone) {
    const b = coach.target, ph = calm() ? 0.5 : (Math.sin((now - coach.t0) / 260) + 1) / 2;
    if (canRoll(g, b) && (coach.key === 'n1-1' || coach.key === 'n3-1')) {
      const tr = traceBean(g, b, unitOf(g, b));
      if (tr && tr.cells) {
        const pts = rollPoints(b, tr);
        ctx.save(); ctx.setLineDash([cell * 0.12, cell * 0.14]); ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(252,226,93,${0.45 + 0.4 * ph})`; ctx.lineWidth = Math.max(2, cell * 0.07);
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.restore();
      }
    }
    ctx.save(); ctx.strokeStyle = '#fce25d'; ctx.lineWidth = 3 + ph * 2; ctx.globalAlpha = 0.6 + 0.4 * ph;
    ctx.beginPath(); ctx.arc(cxp(b.x), cyp(b.y), cell * (0.5 + 0.06 * ph), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    again = !calm();
  }
  for (const b of [hintBean, cursor]) {
    if (!b || b.gone) continue;
    ctx.save(); ctx.strokeStyle = b === hintBean ? '#fce25d' : '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(cxp(b.x), cyp(b.y), cell * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  anims = anims.filter(a => now - a.t0 < a.dur);
  if (anims.length || again) requestAnimationFrame(draw);
}

function drawFit(im, x, y, size, ang, alpha) {
  const s = size / Math.max(im.naturalWidth, im.naturalHeight);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(ang);
  ctx.drawImage(im, -im.naturalWidth * s / 2, -im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
  ctx.restore();
}

function drawBean(b, x, y, ang, alpha, scale) {
  const sleepy = !b.awake;
  const im = img(sleepy ? 'bean_sleepy_v01.webp' : BEAN_IMG[b.roast]);
  const len = cell * 0.84 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y); ctx.rotate(ang);
  if (ready(im)) {
    // the sleepy art includes the nightcap, so it is drawn a little wider and shifted back
    const w = sleepy ? len * 1.1 : len;
    const h = w * im.naturalHeight / im.naturalWidth;
    ctx.drawImage(im, -w / 2 - (sleepy ? len * 0.05 : 0), -h / 2, w, h);
  } else {
    ctx.fillStyle = ['#edc08a', '#b0602a', '#24100a'][b.roast];
    ctx.beginPath(); ctx.ellipse(0, 0, len / 2, len * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // direction mark just past the tip
  const tip = len / 2 + cell * 0.02;
  ctx.beginPath(); ctx.moveTo(tip, -cell * 0.09); ctx.lineTo(tip + cell * 0.09, 0); ctx.lineTo(tip, cell * 0.09);
  ctx.strokeStyle = '#3e1c14'; ctx.lineWidth = Math.max(3, cell * 0.08); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = '#fdaf1e'; ctx.lineWidth = Math.max(1.6, cell * 0.04); ctx.stroke();
  ctx.restore();
  if (b === markBean) { const m = img('mark_v01.svg'); if (ready(m)) drawFit(m, x, y, cell * 0.36, 0, alpha); }
  if (b.ice > 0 && frozen(g, b) && !b.gone) {
    const ice = img('ice_v01.webp');
    if (ready(ice)) drawFit(ice, x, y, cell * 0.9, 0, 0.55 * alpha);
    const left = b.ice - g.rolled;
    ctx.save();
    ctx.fillStyle = '#0b2a3a'; ctx.beginPath(); ctx.arc(x + cell * 0.3, y - cell * 0.3, cell * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `900 ${Math.round(cell * 0.22)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(left), x + cell * 0.3, y - cell * 0.29);
    ctx.restore();
  }
}

// points of a rolling bean: from its cell, through each milk turn, off the tray
function rollPoints(b, tr) {
  const pts = [{ x: cxp(b.x), y: cyp(b.y), d: b.dir }];
  let d = b.dir;
  for (const c of tr.cells) if (c.d !== d) { pts.push({ x: cxp(c.x), y: cyp(c.y), d: c.d }); d = c.d; }
  const e = tr.exit;
  pts.push({ x: cxp(e.x) + DX[e.d] * cell * 0.8, y: cyp(e.y) + DY[e.d] * cell * 0.8, d: e.d });
  let total = 0;
  for (let i = 1; i < pts.length; i++) { pts[i].len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); total += pts[i].len; }
  pts.total = total;
  return pts;
}
function along(pts, t) {
  let dist = t * pts.total;
  for (let i = 1; i < pts.length; i++) {
    if (dist <= pts[i].len || i === pts.length - 1) {
      const f = pts[i].len ? Math.min(1, dist / pts[i].len) : 1;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f, ang: ANG[pts[i].d] };
    }
    dist -= pts[i].len;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, ang: ANG[last.d] };
}

// ---------------- Input ----------------
function beanFromPoint(clientX, clientY) {
  const r = cv.getBoundingClientRect();
  const x = Math.floor(((clientX - r.left) * (S / r.width) - ox) / cell);
  const y = Math.floor(((clientY - r.top) * (S / r.height) - oy) / cell);
  return beanAt(g, x, y);
}
cv.addEventListener('pointerdown', (e) => {
  if (!g || g.status !== 'playing' || !$('overlay').hidden) return;
  const b = beanFromPoint(e.clientX, e.clientY);
  if (b) act(b);
});
cv.addEventListener('keydown', (e) => {
  if (!g || g.status !== 'playing') return;
  const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (m) {
    const c = cursor || { x: 0, y: 0 };
    const nx = Math.max(0, Math.min(level.w - 1, c.x + m[0])), ny = Math.max(0, Math.min(level.h - 1, c.y + m[1]));
    cursor = beanAt(g, nx, ny) || { x: nx, y: ny, gone: false };
    draw(); e.preventDefault();
  } else if ((e.key === 'Enter' || e.key === ' ') && cursor) {
    const b = beanAt(g, cursor.x, cursor.y); if (b) act(b); e.preventDefault();
  }
});

function act(b) {
  const now = performance.now();
  const ev = tap(g, b, now - startedAt);
  if (ev.type === 'none') return;
  resetIdle();
  hintBean = null;
  // Lines stay short (8 words or fewer): the board, the cup and the stars do the explaining.
  const wasPerfect = coachPerfect;
  if (ev.type === 'wake') {
    anims.push({ bean: b, kind: 'wake', t0: now, dur: calm() ? 1 : 320 }); sfx.wake(); say('Awake! Now it can roll.');
    if (coach && coach.target === b) endCoach();
  } else if (ev.type === 'frozen') {
    anims.push({ bean: b, kind: 'shake', t0: now, dur: calm() ? 1 : 360 }); sfx.frozen();
    const left = b.ice - g.rolled; say(`Frozen. Grind ${left} more to melt it.`);
  } else if (ev.type === 'bump') {
    for (const u of ev.unit) anims.push({ bean: u, kind: 'bump', t0: now, dur: calm() ? 1 : 420, block: u === ev.bean ? ev.block : null });
    sfx.bump();
    if (navigator.vibrate) { try { navigator.vibrate(50); } catch (e) { /* not allowed */ } }
    pulse($('cracks'));
    if (g.status === 'burnt') { say('Burnt! Three bumps.'); toddyPlay('worried'); }
    else if (!save.intros.bump) { save.intros.bump = 1; writeSave(); say('Blocked! Three bumps burns the brew.'); toddyPlay('surprised'); }
    else { say(ev.loop ? 'It goes round in circles. Bump!' : `Bump! ${MAX_BUMPS - g.bumps} left.`); toddyPlay('surprised'); }
  } else if (ev.type === 'roll') {
    ev.unit.forEach((u, i) => {
      const pts = rollPoints(u, ev.traces[i]);
      anims.push({ bean: u, kind: 'roll', t0: now, dur: calm() ? 1 : 240 + pts.total / cell * 55, pts });
    });
    sfx.roll();
    if (!calm()) { const longest = Math.max(...anims.filter(a => a.kind === 'roll' && a.t0 === now).map(a => a.dur)); setTimeout(sfx.grind, longest * 0.9); }
    else sfx.grind();
    hop();
    if (coach) endCoach();
    const idx = g.removedRoasts.length - ev.unit.length;
    if (markBean && ev.unit.includes(markBean)) { say('Wait… a crown mark?'); toddyPlay('surprised'); markSeen(); }
    else if (ev.unit.length === 2) say('Sugar pair! Two at once.');
    else if (idx < level.ticket.length) {
      if (g.perfect) {
        if (idx === level.ticket.length - 1) { say('Perfect order! Now clear the rest.'); toddyPlay('happy'); }
        else say('Right colour!');
      } else if (wasPerfect) { say('Wrong colour. Third star lost.'); toddyPlay('surprised'); pulse($('goal-order')); }
    } else if (g.status === 'playing') {
      const left = g.beans.filter(x => !x.gone).length;
      say(left === 1 ? 'One more bean!' : left <= 3 ? 'Almost there.' : ['Into the grinder.', 'Crunch.', 'Nice roll.', 'The cup fills up.'][g.rolled % 4]);
    }
  }
  coachPerfect = g.perfect;
  hud();
  requestAnimationFrame(draw);
  if (g.status !== 'playing') {
    record();
    const done = g;
    clearTimeout(finishTimer);
    if (g.status === 'won') { cup.steam = true; say(''); requestAnimationFrame(drawCup); }
    finishTimer = setTimeout(() => { if (g === done) finish(); }, calm() ? 60 : 900);
  }
}

// little signs of life
let coachPerfect = true;
function hop() { if (calm()) return; const t = $('toddy'); t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop'); }
function pulse(el) { if (!el || calm()) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
function markSeen() { if (!save.marks) save.marks = []; const id = NIGHTS[mode.n].id; if (!save.marks.includes(id)) { save.marks.push(id); writeSave(); } }

// ---------------- Results ----------------
function card(html) {
  $('overlay-card').innerHTML = html;
  $('overlay').hidden = false;
  const first = $('overlay-card').querySelector('.btn.primary') || $('overlay-card').querySelector('button');
  if (first) first.focus();
}
function bind(id, fn) { const el = $(id); if (el) el.addEventListener('click', fn); }
function starRow(s) { return `<div class="stars" aria-label="${s} of 3 stars">${'★'.repeat(s)}<span class="off">${'★'.repeat(3 - s)}</span></div>`; }

// The payoff: the full cup slides to the visitor, who reacts; then each star lands with what earned it.
const SHORT_NAME = { milo: 'Milo', moth: 'The moth', star: 'The star' };
function serveHtml(small) {
  const v = mode.vis || 'milo', s3 = stars(g) === 3;
  const pose = VISITOR_POSE(v, s3 ? 'wow' : 'happy');
  const parts = [
    ['Cleared', true],
    [g.bumps ? (g.bumps === 1 ? '1 bump' : `${g.bumps} bumps`) : 'No bumps', g.bumps === 0],
    [level.ticket.length ? (g.perfect ? 'In order' : 'Order slipped') : 'Bonus', g.perfect],
  ];
  return `<div class="serve${small ? ' small' : ''}"><img class="serve-cup" src="${ASSET}cup_v01.webp" alt=""><img class="serve-vis" src="${ASSET}${pose}" alt="${VISITOR[v][1]} enjoys the coffee"></div>
    <div class="goals-big" aria-label="${stars(g)} of 3 stars">${parts.map(([t, ok], i) => `<span class="gbig d${i + 1}${ok ? '' : ' lost'}"><b>&#9733;</b><small>${t}</small></span>`).join('')}</div>`;
}
function serveSounds() {
  if (calm()) return;
  sfx.pour();
  [g.status === 'won', g.bumps === 0, g.perfect].forEach((ok, i) => setTimeout(() => (ok ? sfx.star(i) : sfx.lost()), 750 + i * 280));
}
function serveVisitor() { // the visitor up top reacts too
  const v = mode.vis || 'milo';
  const el = $('vis-img'); el.src = ASSET + VISITOR_POSE(v, stars(g) === 3 ? 'wow' : 'happy'); el.classList.add('pop');
  $('vis-line').closest('.bubble').classList.add('faded');
}

// Saves the result the moment a tray ends, so leaving early never loses progress.
let result = null;
function modeInfo() {
  return mode.kind === 'story' ? { mode: 'story', night: mode.n + 1, tray: mode.t } : mode.kind === 'daily' ? { mode: 'daily', day: mode.num } : { mode: 'endless', tray: mode.k + 1 };
}
function record() {
  const hintsUsed = g.log.filter(e => e[1] === 'h').length;
  track('tray_end', { ...modeInfo(), result: g.status, stars: stars(g), secs: Math.round((performance.now() - startedAt) / 1000), bumps: g.bumps, hints: hintsUsed, beans: level.beans.length });
  result = { s: stars(g), secs: Math.round((performance.now() - startedAt) / 1000) };
  if (mode.kind === 'endless') {
    if (g.status === 'won') {
      result.gained = level.beans.length * 10 + (g.bumps === 0 ? 50 : 0) + (g.perfect && level.ticket.length ? 50 : 0);
      mode.score += result.gained;
    }
    if (mode.score > (save.endlessBest || 0)) { save.endlessBest = mode.score; result.best = true; writeSave(); }
    return;
  }
  if (g.status !== 'won') return;
  if (mode.kind === 'daily') {
    const sc = dailyScore(g);
    result.score = sc;
    // Fair play: the first cleared run of the day is the official score (what the leaderboard
    // will use). Later runs are practice and never change it.
    const prev = save.daily[mode.num];
    result.official = !prev;
    if (!prev) save.daily[mode.num] = { stars: result.s, time: sc.secs, bumps: g.bumps, score: sc.total, log: g.log.slice(0, 2000) };
  } else {
    const k = trayKey(mode.n, mode.t);
    result.firstClear = !save.stars[k];
    if (!save.stars[k] || result.s > save.stars[k]) save.stars[k] = result.s;
    const night = NIGHTS[mode.n];
    result.newCard = mode.t === TRAYS_PER_NIGHT && !save.postcards.includes(night.id);
    if (result.newCard) save.postcards.push(night.id);
  }
  writeSave();
}

function finish(again) {
  const { s, secs } = result;
  if (!again) {
    if (g.status === 'won') { sfx.win(); toddyPlay('happy'); serveVisitor(); serveSounds(); if (navigator.vibrate) { try { navigator.vibrate([20, 40, 20]); } catch (e) { /* not allowed */ } } }
    else sfx.burnt();
  }

  if (mode.kind === 'endless') {
    if (g.status !== 'won') return endRun();
    card(`${serveHtml(true)}<h3>Tray ${mode.k + 1} served</h3><p>+${result.gained} points · total <b>${mode.score}</b></p>
      <div class="btns"><button class="btn ghost" id="o-stop" type="button">Stop here</button><button class="btn primary" id="o-next" type="button">Next tray</button></div>`);
    bind('o-next', () => { mode.k++; startEndless(true); });
    bind('o-stop', () => endRun());
    return;
  }

  if (g.status === 'burnt') {
    card(`<h3>Burnt brew</h3><p>Three bumps. Check each tip before you tap.</p>
      <div class="btns"><button class="btn ghost" id="o-back" type="button">${mode.kind === 'daily' ? 'Title' : 'Trays'}</button><button class="btn primary" id="o-retry" type="button">Try again</button></div>`);
    bind('o-retry', () => (mode.kind === 'daily' ? startDaily() : startTray(mode.n, mode.t)));
    bind('o-back', () => show(mode.kind === 'daily' ? 'title' : 'map'));
    return;
  }

  const head = s === 3 ? 'Perfect Brew!' : `${SHORT_NAME[mode.vis] || 'Milo'} is happy`;

  if (mode.kind === 'daily') {
    const sc = result.score, st = dailyStreak();
    const best = save.daily[mode.num].score;
    card(`${serveHtml(true)}<h3>Daily Brew done</h3>
      <div class="breakdown">
        <div><span>Tray cleared</span><span>${sc.clear}</span></div>
        <div><span>No bumps</span><span>${sc.clean}</span></div>
        <div><span>Perfect ticket</span><span>${sc.perfect}</span></div>
        <div><span>Speed (${sc.secs}s)</span><span>${sc.speed}</span></div>
        ${sc.hints ? `<div><span>Hints (${sc.hints})</span><span>−${sc.hintCost}</span></div>` : ''}
        <div class="total"><span>Score</span><span>${sc.total} / 1000</span></div>
      </div>
      <p class="stat">${result.official ? 'Today\u2019s score is saved.' : `Practice. Today\u2019s score stays ${best}.`} Streak: ${st.current} day${st.current === 1 ? '' : 's'}</p>
      <div class="btns"><button class="btn primary" id="o-share" type="button">Share</button></div>
      <div class="btns"><button class="btn ghost" id="o-retry" type="button">Practice again</button><button class="btn ghost" id="o-home" type="button">Done</button></div>`);
    bind('o-retry', startDaily); bind('o-home', () => show('title'));
    const shareData = { kind: 'daily', num: mode.num, score: save.daily[mode.num].score, stars: save.daily[mode.num].stars, secs: save.daily[mode.num].time, bumps: save.daily[mode.num].bumps, streak: st.current, visitor: mode.visitor };
    bind('o-share', () => openShare(shareData, () => finish(true)));
    return;
  }

  const night = NIGHTS[mode.n];
  const finale = mode.t === TRAYS_PER_NIGHT;
  const nextLabel = finale ? (mode.n < NIGHTS.length - 1 ? NIGHTS[mode.n + 1].name : 'Trays') : 'Next tray';
  const goNext = () => {
    if (!finale) startTray(mode.n, mode.t + 1);
    else if (mode.n < NIGHTS.length - 1) { mapNight = mode.n + 1; startTray(mode.n + 1, 1); }
    else show('map');
  };
  // once ever, after the first clear of tray 2: introduce the Daily Brew (and its shareable score)
  const dailyTip = result.firstClear && mode.n === 0 && mode.t === 2 && !save.intros.daily && dailyWaiting();
  const showDailyTip = () => {
    save.intros.daily = 1; writeSave();
    track('tip', { tip: 'daily' });
    card(`<p class="eyebrow">New</p><img class="tip-img" src="${ASSET}cup_v01.webp" alt=""><h3>Daily Brew</h3>
      <p>A new puzzle every day, same for everyone. Share your score!</p>
      <div class="btns"><button class="btn ghost" id="o-later" type="button">Later</button><button class="btn primary" id="o-try" type="button">Try it now</button></div>`);
    bind('o-try', () => { track('daily_nudge', { from: 'tip' }); startDaily(); });
    bind('o-later', goNext);
  };
  const showPostcard = () => {
    const marked = (save.marks || []).includes(night.id);
    card(`<h3>A postcard for you</h3><div class="pc-wrap"><img class="postcard" src="${ASSET}postcard_n${mode.n + 1}_v01.webp" alt="${night.title} postcard">${marked ? `<img class="pc-mark" src="${ASSET}mark_v01.svg" alt="A small crown mark">` : ''}</div>
      <p><b>${night.title}</b>${marked ? ' · that crown mark again…' : ''}</p>
      <div class="btns"><button class="btn primary" id="o-cont" type="button">${nextLabel}</button></div>`);
    bind('o-cont', goNext);
  };
  // the serve comes first: it is the payoff
  card(`${serveHtml(false)}<h3>${finale ? 'Night complete!' : head}</h3>
    ${result.firstClear && mode.n === 0 && finale ? '<p class="stat">Endless Brew is now open.</p>' : ''}
    <div class="btns"><button class="btn ghost" id="o-retry" type="button">Brew again</button><button class="btn primary" id="o-next" type="button">${result.newCard ? 'Continue' : nextLabel}</button></div>
    ${dailyWaiting() ? '<div class="btns"><button class="btn daily-nudge" id="o-daily" type="button">Today\u2019s Daily Brew \u2192</button></div>' : ''}`);
  bind('o-retry', () => startTray(mode.n, mode.t));
  if (dailyWaiting()) bind('o-daily', () => { track('daily_nudge', { from: 'result' }); startDaily(); });
  bind('o-next', () => (result.newCard ? showPostcard() : dailyTip ? showDailyTip() : goNext()));
}

function endRun() {
  const cleared = mode.k + (g.status === 'won' ? 1 : 0);
  card(`<h3>${g.status === 'burnt' ? 'Burnt! Run over' : 'Run complete'}</h3><p>You cleared ${cleared} tray${cleared === 1 ? '' : 's'} for <b>${mode.score}</b> points.</p>
    <p class="stat">${result && result.best ? 'New best!' : `Best: ${save.endlessBest}`}</p>
    <div class="btns"><button class="btn primary" id="o-share" type="button">Share</button></div>
    <div class="btns"><button class="btn ghost" id="o-home" type="button">Title</button><button class="btn ghost" id="o-again" type="button">New run</button></div>`);
  bind('o-home', () => show('title')); bind('o-again', () => startEndless(false));
  if (!mode.reported) { mode.reported = true; track('endless_end', { score: mode.score, trays: cleared }); }
  const shareData = { kind: 'endless', score: mode.score, trays: cleared, best: save.endlessBest, visitor: 'moth' };
  bind('o-share', () => openShare(shareData, () => endRun()));
}

// ---------------- Settings ----------------
function applySettings() {
  document.documentElement.classList.toggle('big-text', !!save.bigText);
  document.documentElement.classList.toggle('calm', !!save.calm);
  $('play-sound').classList.toggle('off', !save.sound);
}
function openSettings() {
  const row = (id, label, sub, on) => `<label class="setting"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}></label>`;
  modal(`<h3>Settings</h3>
    <div class="settings">
      ${row('set-sound', 'Sound', 'Bean rolls, bumps and chimes', save.sound)}
      ${row('set-calm', 'Calmer motion', 'Fewer animations', save.calm)}
      ${row('set-big', 'Bigger text', 'Larger words in the game', save.bigText)}
      ${row('set-stats', 'Share anonymous play stats', 'Helps us see which trays are too hard. No name, no account.', save.stats)}
    </div>
    <div class="btns"><button class="btn primary" id="set-done" type="button">Done</button></div>`);
  $('set-sound').addEventListener('change', e => setSound(e.target.checked));
  $('set-calm').addEventListener('change', e => { save.calm = e.target.checked; writeSave(); applySettings(); });
  $('set-big').addEventListener('change', e => { save.bigText = e.target.checked; writeSave(); applySettings(); });
  $('set-stats').addEventListener('change', e => { save.stats = e.target.checked; writeSave(); });
  bind('set-done', closeModal);
}
function modal(html) { $('modal-card').innerHTML = html; $('modal').hidden = false; const b = $('modal-card').querySelector('button'); if (b) b.focus(); }
function closeModal() { $('modal').hidden = true; }

// ---------------- Share card ----------------
// A spoiler-free picture: no tray layout, only the result. Drawn on a canvas, saved as PNG.
const LAUNCH_DAY = 20261012; // Daily Brew #1
function dailyLabel(num) {
  const idx = (n) => Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100) / 864e5;
  return Math.max(1, Math.round(idx(num) - idx(LAUNCH_DAY)) + 1);
}
function shareText(d) {
  if (d.kind === 'daily') return `TODDY Moon Brew · Daily #${dailyLabel(d.num)}\n${'★'.repeat(d.stars)}${'☆'.repeat(3 - d.stars)} ${d.score}/1000 · ${d.secs}s${d.streak > 1 ? ` · ${d.streak}-day streak` : ''}\nCan you beat it?`;
  return `TODDY Moon Brew · Endless Brew\n${d.score} points · ${d.trays} tray${d.trays === 1 ? '' : 's'} cleared\nCan you beat it?`;
}
function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
async function drawShare(d) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#17112a'; x.fillRect(0, 0, W, H);
  const pc = { milo: 1, moth: 2, star: 3 }[d.visitor] || 1;
  const art = await loadImg(ASSET + `postcard_n${pc}_v01.webp`);
  if (art) { const h = W * art.naturalHeight / art.naturalWidth; x.drawImage(art, 0, 0, W, h); }
  const grad = x.createLinearGradient(0, 380, 0, 760);
  grad.addColorStop(0, 'rgba(23,17,42,0)'); grad.addColorStop(1, 'rgba(23,17,42,1)');
  x.fillStyle = grad; x.fillRect(0, 380, W, 400);
  x.fillStyle = '#17112a'; x.fillRect(0, 760, W, H - 760);
  const font = (w, s) => `${w} ${s}px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif`;
  x.textAlign = 'center';
  x.fillStyle = '#fdaf1e'; x.font = font(800, 34); x.fillText('T O D D Y', W / 2, 700);
  x.fillStyle = '#fde3bd'; x.font = font(900, 110); x.fillText('Moon Brew', W / 2, 810);
  x.fillStyle = '#c3b2d8'; x.font = font(700, 40);
  x.fillText(d.kind === 'daily' ? `Daily Brew #${dailyLabel(d.num)}` : 'Endless Brew', W / 2, 880);
  if (d.kind === 'daily') {
    x.font = font(900, 92); x.fillStyle = '#fdaf1e';
    x.fillText('★'.repeat(d.stars) + '☆'.repeat(3 - d.stars), W / 2, 1000);
    // score and "/1000" centred together
    x.font = font(900, 150); const sw = x.measureText(String(d.score)).width;
    x.font = font(800, 50); const tw = x.measureText(' /1000').width;
    const left = (W - sw - tw) / 2;
    x.textAlign = 'left';
    x.fillStyle = '#fde3bd'; x.font = font(900, 150); x.fillText(String(d.score), left, 1150);
    x.fillStyle = '#c3b2d8'; x.font = font(800, 50); x.fillText(' /1000', left + sw, 1150);
    x.textAlign = 'center'; x.font = font(700, 40);
    x.fillText(`${d.secs}s · ${d.bumps} bump${d.bumps === 1 ? '' : 's'}${d.streak > 1 ? ` · ${d.streak}-day streak` : ''}`, W / 2, 1215);
  } else {
    x.fillStyle = '#fde3bd'; x.font = font(900, 150); x.fillText(String(d.score), W / 2, 1080);
    x.fillStyle = '#c3b2d8'; x.font = font(800, 46); x.fillText(`points · ${d.trays} tray${d.trays === 1 ? '' : 's'} cleared`, W / 2, 1150);
  }
  x.fillStyle = '#fdaf1e'; x.font = font(800, 38); x.fillText('Can you beat it?  toddy.meme/games/moon-brew', W / 2, 1300);
  return c;
}
let shareBlobUrl = null;
async function openShare(d, back) {
  card('<h3>Share your brew</h3><p class="stat">Making your card…</p>');
  const c = await drawShare(d);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  if (shareBlobUrl) URL.revokeObjectURL(shareBlobUrl);
  shareBlobUrl = URL.createObjectURL(blob);
  const text = shareText(d);
  const enc = encodeURIComponent;
  const file = new File([blob], 'toddy-moon-brew.png', { type: 'image/png' });
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const nativeShare = touch && navigator.canShare && navigator.canShare({ files: [file] });
  card(`<h3>Share your brew</h3>
    <img class="postcard share-img" src="${shareBlobUrl}" alt="Your Moon Brew result card">
    ${nativeShare ? '<div class="btns"><button class="btn primary" id="s-native" type="button">Share…</button></div>' : ''}
    <div class="btns"><a class="btn ${nativeShare ? '' : 'primary'}" id="s-x">Post on X</a><a class="btn" id="s-tg">Telegram</a></div>
    <div class="btns"><button class="btn ghost" id="s-copy" type="button">Copy link</button><button class="btn ghost" id="s-save" type="button">Save image</button></div>
    <p class="stat" id="s-msg">No spoilers on the card: only your score, stars and time.</p>
    <div class="btns"><button class="btn ghost" id="s-back" type="button">Back</button></div>`);
  const msg = (t) => { $('s-msg').textContent = t; };
  bind('s-back', back);
  track('share_open', { kind: d.kind });
  ['s-native', 's-x', 's-tg', 's-copy', 's-save'].forEach(id => { const el = $(id); if (el) el.addEventListener('click', () => track('share', { kind: d.kind, via: id.slice(2) })); });
  bind('s-native', () => navigator.share({ files: [file], text: `${text} ${SHARE_URL}` })
    .then(() => msg('Shared. Thank you!'))
    .catch(e => { if (!e || e.name !== 'AbortError') msg('This screen can\u2019t open the share sheet. Use Post on X or Telegram.'); }));
  linkTo($('s-x'), `https://x.com/intent/post?text=${enc(text)}&url=${enc(SHARE_URL)}`);
  linkTo($('s-tg'), `https://t.me/share/url?url=${enc(SHARE_URL)}&text=${enc(text)}`);
  bind('s-copy', async () => {
    try { await navigator.clipboard.writeText(`${text} ${SHARE_URL}`); msg('Copied. Paste it anywhere.'); }
    catch (e) { msg('Copying is blocked here. Long-press to copy: ' + SHARE_URL); }
  });
  bind('s-save', () => {
    if (isFramed()) { msg('This preview can\u2019t save files. Long-press (or right-click) the picture above and choose Save image.'); return; }
    const a = document.createElement('a'); a.href = shareBlobUrl; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); msg('Saved as toddy-moon-brew.png');
  });
}

// ---------------- Buttons ----------------
bind('btn-play', () => {
  sfx.tick();
  if (!Object.keys(save.stars).length) { startTray(0, 1); return; } // first time: straight into tray 1
  mapNight = [2, 1, 0].find(n => nightOpen(n)) ?? 0; show('map');
});
bind('btn-daily', () => { sfx.tick(); startDaily(); });
bind('btn-endless', () => { if (endlessOpen()) startEndless(false); else $('endless-status').textContent = 'Finish Night 1 (tray 20) to open'; });
bind('btn-album', () => show('album'));
bind('btn-stats', () => show('stats'));
bind('stats-back', () => show('title'));
bind('btn-howto', () => show('howto'));
bind('btn-settings', openSettings);
bind('btn-about', () => show('about'));
bind('about-back', () => show('title'));
linkTo($('about-bug'), BUG_REPORT_URL);
linkTo($('about-privacy'), PRIVACY_URL);
$('about-bug').addEventListener('click', () => track('report_bug'));
bind('play-sound', () => setSound(!save.sound));
bind('map-back', () => show('title'));
bind('album-back', () => show('title'));
bind('howto-back', () => show('title'));
bind('play-back', () => { clearTimeout(finishTimer); show(mode && mode.kind === 'story' ? 'map' : 'title'); });
bind('btn-restart', () => { if (mode.kind === 'endless') { if (g.status === 'playing') load(endlessConfig(mode.seed, mode.k)); } else if (mode.kind === 'daily') startDaily(); else startTray(mode.n, mode.t); });
bind('btn-hint', () => {
  if (!g || g.status !== 'playing') return;
  hintBean = useHint(g, performance.now() - startedAt);
  track('hint', { ...modeInfo(), auto: false });
  toddyPlay('thinking');
  const cost = mode.kind === 'daily' ? ' (−50)' : '';
  say(hintBean ? (hintBean.awake ? `Try the circled bean${cost}.` : `Wake the circled bean${cost}.`) : 'Stuck. Tap Restart.');
  draw();
});

// Automatic help when a player is stuck: a gentle nudge after 60 s, a stronger hint after 2 min.
// In the Daily Brew the stronger step only offers the Hint button, so scores stay fair.
let lastMove = 0, nudged = 0;
function resetIdle() { lastMove = performance.now(); nudged = 0; }
setInterval(() => {
  if (current !== 'play' || !g || g.status !== 'playing' || !$('overlay').hidden) { lastMove += 1000; return; } // paused: don't count the time
  const idle = (performance.now() - lastMove) / 1000;
  // owner rule: nobody stuck for more than 20-30 s
  if (idle >= 25 && nudged < 1) {
    nudged = 1; toddyPlay('thinking');
    say('Find a bean with a clear path.');
  } else if (idle >= 50 && nudged < 2) {
    nudged = 2;
    if (mode.kind === 'daily') say('Still stuck? Tap Hint (−50).');
    else { hintBean = hint(g); toddyPlay('thinking'); say('Toddy circled one for you.'); draw(); track('hint', { ...modeInfo(), auto: true }); }
  }
}, 1000);
$('unlock-all').addEventListener('change', (e) => { save.unlockAll = e.target.checked; writeSave(); renderMap(); });
addEventListener('resize', () => { if (current === 'play') { placeAmbient(); resizeBoard(); draw(); } });

// The café is alive: the lamp breathes and the cup in the background steams. The two layers sit over
// those spots of the background picture (shown "cover", centred), so they are placed from the screen size.
function placeAmbient() {
  const W = innerWidth, H = innerHeight, D = Math.max(W, H), x0 = (W - D) / 2, y0 = (H - D) / 2;
  const put = (el, fx, fy) => { el.style.left = Math.round(x0 + fx * D) + 'px'; el.style.top = Math.round(y0 + fy * D) + 'px'; el.style.setProperty('--s', (D / 700).toFixed(3)); };
  put($('amb-lamp'), 0.10, 0.095); // the lantern, top left of the picture
  put($('amb-steam'), 0.875, 0.085); // the Moon Brew cup, top right
  // upright phones crop the picture's corners: keep the lamp's warmth at the screen's edge, hide steam with no cup
  const lamp = $('amb-lamp'); lamp.style.left = Math.max(0, parseFloat(lamp.style.left)) + 'px';
  const st = $('amb-steam'); st.hidden = parseFloat(st.style.left) > W - 10;
}
if (window.ResizeObserver) new ResizeObserver(() => { if (current === 'play') { resizeBoard(); draw(); } }).observe($('board-wrap'));

// Images named in the page are set here (keeps the build simple and file paths relative)
document.querySelectorAll('img[data-src]').forEach(el => { el.src = el.dataset.src; });
// full address: a relative one would be read from the stylesheet's folder after the build
document.documentElement.style.setProperty('--counter-bg', `url("${new URL(ASSET + 'counter_background_v01.webp', document.baseURI).href}")`);

// Toddy panel
toddy.cv = $('toddy'); toddy.ctx = toddy.cv.getContext('2d');
toddy.cv.addEventListener('animationend', (e) => { if (e.animationName === 'hop') toddy.cv.classList.remove('hop'); });

setSound(save.sound);
applySettings();
show('title');
track('open', { returning: Object.keys(save.stars).length > 0 || Object.keys(save.daily).length > 0 });

// Hooks for the automatic browser tests (tools/smoke.py). Not used by players.
window.__moonbrew = {
  get g() { return g; }, get level() { return level; }, get mode() { return mode; }, get coach() { return coach && coach.key; }, save,
  startTray, startDaily, startEndless, show, audioState: () => actx ? actx.state : "none",
  canRoll(id) { return canRoll(g, g.beans[id]); },
  get stats() { return statsQueue.slice(); },
  beanPoint(id) { const b = g.beans[id]; const r = cv.getBoundingClientRect(); return { x: r.left + cxp(b.x) * r.width / S, y: r.top + cyp(b.y) * r.height / S }; },
};
