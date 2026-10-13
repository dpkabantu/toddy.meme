// TODDY: Moon Brew — screens, drawing, sound and saving.
import { DX, DY, MAX_BUMPS, generate, newGame, beanAt, frozen, unitOf, traceBean, canRoll, tap, stars, hint, useHint, dailyScore, streaks, fromFrozen } from './core.js';
import { TRAYS } from './trays.js';
import { NIGHTS, INTROS, TRAYS_PER_NIGHT, trayConfig, dailyConfig, dailyNumber, endlessConfig, ENDLESS_LINES } from './levels.js';

const BUILD = '1.0.0-rc7';
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
  if (name === 'play') { warmToddy(); resizeBoard(); requestAnimationFrame(() => { resizeBoard(); draw(); }); }
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
    d.innerHTML = `<img src="${ASSET}postcard_n${n + 1}_v01.webp" alt="${have ? night.title + ' postcard' : 'Locked postcard'}"><figcaption class="cap"><b>${night.title}</b><span>${have ? night.name : 'Finish ' + night.name}</span></figcaption>`;
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
    line = save.daily[mode.num] ? `Practice run. Your official score today is ${save.daily[mode.num].score}.` : 'Today\u2019s Daily Brew. Everyone gets this same tray. Your first clear counts.';
    $('where').textContent = 'Daily Brew';
  } else {
    vis = ['milo', 'moth', 'star'][mode.k % 3]; line = ENDLESS_LINES[mode.k % ENDLESS_LINES.length];
    $('where').textContent = `Endless · Tray ${mode.k + 1} · ${mode.score} pts`;
  }
  $('vis-img').src = ASSET + VISITOR[vis][0];
  $('vis-img').alt = VISITOR[vis][1];
  $('vis-name').textContent = VISITOR[vis][1];
  $('vis-line').textContent = line;
  say(`${level.beans.length} beans on the tray tonight.`);
  hud();
  show('play');
  toddyPlay('wave');
  track('tray_start', modeInfo());
  const tipKey = mode.kind === 'story' ? trayKey(mode.n, mode.t) : null;
  if (tipKey && INTROS[tipKey] && !save.intros[tipKey]) showTip(tipKey);
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
  if (level.ticket.length) {
    const p = document.createElement('span');
    p.className = 'perfect ' + (g.perfect ? 'ok' : 'lost');
    p.textContent = g.perfect ? (g.removedRoasts.length >= level.ticket.length ? 'Perfect! Clear the rest' : '') : 'Wrong order: no 3rd star';
    t.appendChild(p);
  }
  [...$('cracks').children].forEach((c, i) => c.classList.toggle('used', i < g.bumps));
  const left = g.beans.filter(b => !b.gone).length;
  $('count').textContent = `${g.rolled} ground · ${left} left`;
  $('meter').style.width = (100 * g.rolled / level.beans.length) + '%';
}
function say(s) { $('say').textContent = s; }

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
      const p = along(a.pts, t * t * (3 - 2 * t) * 0.35 + t * 0.65);
      drawBean(b, p.x, p.y, p.ang, t > 0.8 ? (1 - t) / 0.2 : 1, 1);
    } else if (a.kind === 'bump') {
      const k = Math.sin(Math.min(1, t) * Math.PI) * cell * 0.28;
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
  for (const b of [hintBean, cursor]) {
    if (!b || b.gone) continue;
    ctx.save(); ctx.strokeStyle = b === hintBean ? '#fce25d' : '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(cxp(b.x), cyp(b.y), cell * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  anims = anims.filter(a => now - a.t0 < a.dur);
  if (anims.length) requestAnimationFrame(draw);
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
  if (ev.type === 'wake') { anims.push({ bean: b, kind: 'wake', t0: now, dur: calm() ? 1 : 320 }); sfx.wake(); say('The bean yawns and takes off its nightcap.'); }
  else if (ev.type === 'frozen') { anims.push({ bean: b, kind: 'shake', t0: now, dur: calm() ? 1 : 360 }); sfx.frozen(); const left = b.ice - g.rolled; say(`Still frozen. Grind ${left} more bean${left === 1 ? '' : 's'} to melt it.`); }
  else if (ev.type === 'bump') {
    for (const u of ev.unit) anims.push({ bean: u, kind: 'bump', t0: now, dur: calm() ? 1 : 360, block: u === ev.bean ? ev.block : null });
    sfx.bump();
    if (navigator.vibrate) { try { navigator.vibrate(50); } catch (e) { /* not allowed */ } }
    if (g.status === 'burnt') { say('Burnt! Three bumps cracked the brew.'); toddyPlay('worried'); }
    else { say(ev.loop ? 'That path circles back on itself. Bump!' : `Bump! Something is in the way. ${MAX_BUMPS - g.bumps} left.`); toddyPlay('surprised'); }
  } else if (ev.type === 'roll') {
    ev.unit.forEach((u, i) => {
      const pts = rollPoints(u, ev.traces[i]);
      anims.push({ bean: u, kind: 'roll', t0: now, dur: calm() ? 1 : 180 + pts.total / cell * 55, pts });
    });
    sfx.roll();
    const idx = g.removedRoasts.length - ev.unit.length;
    if (ev.unit.length === 2) say('Sugar pair! Both beans roll together.');
    else if (idx < level.ticket.length) { if (g.perfect) { if (idx === level.ticket.length - 1) { say('Perfect order! Now clear the rest of the tray in any order. Avoid bumps for all 3 stars.'); toddyPlay('happy'); } else say(`Right colour: ${ROAST_NAME[ev.unit[0].roast]}. Next one is glowing on the ticket.`); } else say('Wrong colour for the ticket, so no Perfect star this time. Keep clearing, or Restart to try again.'); }
    else say(['Into the grinder.', 'Crunch.', 'The grinder hums.', 'Nice roll.'][g.rolled % 4]);
  }
  hud();
  requestAnimationFrame(draw);
  if (g.status !== 'playing') {
    record();
    const done = g;
    clearTimeout(finishTimer);
    finishTimer = setTimeout(() => { if (g === done) finish(); }, calm() ? 60 : 650);
  }
}

// ---------------- Results ----------------
function card(html) {
  $('overlay-card').innerHTML = html;
  $('overlay').hidden = false;
  const first = $('overlay-card').querySelector('.btn.primary') || $('overlay-card').querySelector('button');
  if (first) first.focus();
}
function bind(id, fn) { const el = $(id); if (el) el.addEventListener('click', fn); }
function starRow(s) { return `<div class="stars" aria-label="${s} of 3 stars">${'★'.repeat(s)}<span class="off">${'★'.repeat(3 - s)}</span></div>`; }

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
  if (!again) { if (g.status === 'won') { sfx.win(); toddyPlay('happy'); } else sfx.burnt(); }

  if (mode.kind === 'endless') {
    if (g.status !== 'won') return endRun();
    card(`<h3>Tray ${mode.k + 1} cleared</h3>${starRow(s)}<p>+${result.gained} points · total <b>${mode.score}</b></p>
      <div class="btns"><button class="btn ghost" id="o-stop" type="button">Stop here</button><button class="btn primary" id="o-next" type="button">Next tray</button></div>`);
    bind('o-next', () => { mode.k++; startEndless(true); });
    bind('o-stop', () => endRun());
    return;
  }

  if (g.status === 'burnt') {
    card(`<h3>Burnt brew</h3><p>Three bumps cracked the batch. Check where each tip points before you tap.</p>
      <div class="btns"><button class="btn ghost" id="o-back" type="button">${mode.kind === 'daily' ? 'Title' : 'Trays'}</button><button class="btn primary" id="o-retry" type="button">Try again</button></div>`);
    bind('o-retry', () => (mode.kind === 'daily' ? startDaily() : startTray(mode.n, mode.t)));
    bind('o-back', () => show(mode.kind === 'daily' ? 'title' : 'map'));
    return;
  }

  const msg = s === 3 ? 'Perfect Brew. Toddy gives his signature wink.'
    : !g.perfect ? 'Brewed, but the ticket order slipped. Follow the roasts in order for the third star.'
      : `Brewed with ${g.bumps} bump${g.bumps === 1 ? '' : 's'}. A clean run earns the second star.`;

  if (mode.kind === 'daily') {
    const sc = result.score, st = dailyStreak();
    const best = save.daily[mode.num].score;
    card(`<h3>Daily Brew done</h3>${starRow(s)}
      <div class="breakdown">
        <div><span>Tray cleared</span><span>${sc.clear}</span></div>
        <div><span>No bumps</span><span>${sc.clean}</span></div>
        <div><span>Perfect ticket</span><span>${sc.perfect}</span></div>
        <div><span>Speed (${sc.secs}s)</span><span>${sc.speed}</span></div>
        ${sc.hints ? `<div><span>Hints (${sc.hints})</span><span>−${sc.hintCost}</span></div>` : ''}
        <div class="total"><span>Score</span><span>${sc.total} / 1000</span></div>
      </div>
      <p class="stat">${result.official ? 'Saved as today\u2019s official score.' : `Practice run. Today\u2019s official score stays ${best}.`} Streak: ${st.current} day${st.current === 1 ? '' : 's'} · a new tray arrives tomorrow</p>
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
  const showResult = () => {
    card(`<h3>${finale ? 'Night complete' : 'Moon Brew ready'}</h3>${starRow(s)}<p>${msg}</p>
      ${result.firstClear && mode.n === 0 && finale ? '<p class="stat">Endless Brew is now open on the title screen.</p>' : ''}
      <div class="btns"><button class="btn ghost" id="o-retry" type="button">Brew again</button><button class="btn primary" id="o-next" type="button">${nextLabel}</button></div>
      ${dailyWaiting() ? '<div class="btns"><button class="btn daily-nudge" id="o-daily" type="button">Today\u2019s Daily Brew \u2192</button></div>' : ''}`);
    bind('o-retry', () => startTray(mode.n, mode.t));
    if (dailyWaiting()) bind('o-daily', () => { track('daily_nudge', { from: 'result' }); startDaily(); });
    bind('o-next', () => {
      if (!finale) startTray(mode.n, mode.t + 1);
      else if (mode.n < NIGHTS.length - 1) { mapNight = mode.n + 1; startTray(mode.n + 1, 1); }
      else show('map');
    });
  };
  // once ever: after the first clear of tray 2, introduce the Daily Brew (and its shareable score)
  if (result.firstClear && mode.n === 0 && mode.t === 2 && !save.intros.daily && dailyWaiting()) {
    save.intros.daily = 1; writeSave();
    track('tip', { tip: 'daily' });
    card(`<p class="eyebrow">New</p><img class="tip-img" src="${ASSET}cup_v01.webp" alt=""><h3>Daily Brew</h3>
      <p>There\u2019s a new Daily Brew every day: the same puzzle for everyone. Finish it and share your score with friends.</p>
      <div class="btns"><button class="btn ghost" id="o-later" type="button">Later</button><button class="btn primary" id="o-try" type="button">Try it now</button></div>`);
    bind('o-try', () => { track('daily_nudge', { from: 'tip' }); startDaily(); });
    bind('o-later', showResult);
    return;
  }
  if (result.newCard) {
    card(`<h3>A postcard for you</h3><img class="postcard" src="${ASSET}postcard_n${mode.n + 1}_v01.webp" alt="${night.title} postcard">
      <p><b>${night.title}</b> is now in your postcard album.</p>
      <div class="btns"><button class="btn primary" id="o-cont" type="button">Continue</button></div>`);
    bind('o-cont', showResult);
  } else showResult();
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

function showTip(k) {
  const tip = INTROS[k];
  const pic = { 'n1-1': 'bean_medium_v01.webp', 'n1-3': 'cup_v01.webp', 'n1-6': 'bean_dark_v01.webp', 'n1-8': 'bean_sleepy_v01.webp', 'n2-1': 'ice_v01.webp', 'n2-10': 'sugar_v01.webp', 'n3-1': 'milk_v01.webp' }[k];
  card(`<p class="eyebrow">New</p><img class="tip-img" src="${ASSET}${pic}" alt=""><h3>${tip.title}</h3><p>${tip.text}</p>
    <div class="btns"><button class="btn primary" id="o-ok" type="button">Got it</button></div>`);
  track('tip', { tip: k });
  bind('o-ok', () => { save.intros[k] = 1; writeSave(); $('overlay').hidden = true; cv.focus({ preventScroll: true }); });
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
  const cost = mode.kind === 'daily' ? ' (−50 Daily points)' : '';
  say(hintBean ? (hintBean.awake ? `Toddy thinks the circled bean can go${cost}.` : `Wake the circled bean first${cost}.`) : 'No bean can move. Restart the tray.');
  draw();
});

// Automatic help when a player is stuck: a gentle nudge after 60 s, a stronger hint after 2 min.
// In the Daily Brew the stronger step only offers the Hint button, so scores stay fair.
let lastMove = 0, nudged = 0;
function resetIdle() { lastMove = performance.now(); nudged = 0; }
setInterval(() => {
  if (current !== 'play' || !g || g.status !== 'playing' || !$('overlay').hidden) { lastMove += 1000; return; } // paused: don't count the time
  const idle = (performance.now() - lastMove) / 1000;
  if (idle >= 60 && nudged < 1) {
    nudged = 1; toddyPlay('thinking');
    say('Stuck? Look for a bean whose tip points to a clear path off the tray.');
  } else if (idle >= 120 && nudged < 2) {
    nudged = 2;
    if (mode.kind === 'daily') say('Still stuck? Tap Hint to see a bean that can go (−50 Daily points).');
    else { hintBean = hint(g); toddyPlay('thinking'); say('Toddy circles a bean that can go.'); draw(); track('hint', { ...modeInfo(), auto: true }); }
  }
}, 1000);
$('unlock-all').addEventListener('change', (e) => { save.unlockAll = e.target.checked; writeSave(); renderMap(); });
addEventListener('resize', () => { if (current === 'play') { resizeBoard(); draw(); } });
if (window.ResizeObserver) new ResizeObserver(() => { if (current === 'play') { resizeBoard(); draw(); } }).observe($('board-wrap'));

// Images named in the page are set here (keeps the build simple and file paths relative)
document.querySelectorAll('img[data-src]').forEach(el => { el.src = el.dataset.src; });
// full address: a relative one would be read from the stylesheet's folder after the build
document.documentElement.style.setProperty('--counter-bg', `url("${new URL(ASSET + 'counter_background_v01.webp', document.baseURI).href}")`);

// Toddy panel
toddy.cv = $('toddy'); toddy.ctx = toddy.cv.getContext('2d');

setSound(save.sound);
applySettings();
show('title');
track('open', { returning: Object.keys(save.stars).length > 0 || Object.keys(save.daily).length > 0 });

// Hooks for the automatic browser tests (tools/smoke.py). Not used by players.
window.__moonbrew = {
  get g() { return g; }, get level() { return level; }, get mode() { return mode; }, save,
  startTray, startDaily, startEndless, show, audioState: () => actx ? actx.state : "none",
  canRoll(id) { return canRoll(g, g.beans[id]); },
  get stats() { return statsQueue.slice(); },
  beanPoint(id) { const b = g.beans[id]; const r = cv.getBoundingClientRect(); return { x: r.left + cxp(b.x) * r.width / S, y: r.top + cyp(b.y) * r.height / S }; },
};
