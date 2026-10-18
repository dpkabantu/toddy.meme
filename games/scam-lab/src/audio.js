// Tiny code-made sound effects (no audio files to download).
let ctx = null;
let on = true;
let musicOn = true;
let sfxBus = null; let musicBus = null;
let timer = null; let nextT = 0; let step = 0;

export function soundOn() { return on; }
export function setSound(v, music = musicOn) {
  on = v; musicOn = music;
  if (on && musicOn) { if (ctx) startMusic(); } else stopMusic(); // no audio before the first tap
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    // Sound effects go straight out; music goes through its own quiet, soft bus.
    sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination);
    const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 1100;
    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    musicBus.connect(soft).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Night-café music: a slow, warm pad and a few sparse music-box notes.
// Kept low (about 10 dB under the taps) and below 1.1 kHz so taps and pings stay clear.
const MUSIC_VOL = 0.05;
const CHORDS = [ // Am9, Fmaj7, Cmaj7, Em7 (each lasts 8 s)
  [110, 220, 262, 330, 392], [87.3, 220, 262, 330, 349], [65.4, 196, 262, 330, 392], [82.4, 196, 247, 330, 392],
];
const BELLS = [220, 262, 294, 330, 392, 440, 523]; // A minor pentatonic
const CHORD_S = 8;

function pad(freq, t, dur) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = freq; o.detune.value = (Math.random() - 0.5) * 8;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16, t + 2.5);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 1.6);
}
function bell(freq, t) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 2.5);
}
function schedule() {
  if (!ctx || !on || !musicOn) return;
  while (nextT < ctx.currentTime + 2) {
    const t = Math.max(nextT, ctx.currentTime + 0.05);
    const chord = CHORDS[step % CHORDS.length];
    chord.forEach((f) => pad(f, t, CHORD_S));
    for (let i = 0; i < 3; i++) if (Math.random() < 0.75) bell(BELLS[Math.floor(Math.random() * BELLS.length)], t + 1 + i * 2.3 + Math.random() * 0.6);
    nextT = t + CHORD_S; step++;
  }
}
function startMusic() {
  const a = ac(); if (!a || !musicBus) return;
  musicBus.gain.cancelScheduledValues(a.currentTime);
  musicBus.gain.setTargetAtTime(MUSIC_VOL, a.currentTime, 1.5);
  if (!timer) { nextT = a.currentTime; timer = setInterval(schedule, 500); schedule(); }
}
function stopMusic() {
  if (timer) { clearInterval(timer); timer = null; }
  if (ctx && musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.3); }
}
// Browsers only allow sound after a tap, so the music starts with the first tap.
export function wakeMusic() { if (on && musicOn && !timer) startMusic(); }
// Pause when the tab or app is hidden.
try {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
} catch (e) { /* no document */ }

// Dip the music for a moment so each sound effect is heard clearly.
function duck() {
  if (!ctx || !musicBus || !timer) return;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(MUSIC_VOL * 0.45, t, 0.03);
  musicBus.gain.setTargetAtTime(MUSIC_VOL, t + 0.35, 0.4);
}

function tone(freq, dur, { type = 'sine', vol = 0.25, slide = 0, delay = 0 } = {}) {
  if (!on) return;
  const a = ac(); if (!a) return;
  wakeMusic();
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t); o.stop(t + dur + 0.02);
  duck();
}

export const sfx = {
  tap: () => tone(660, 0.06, { type: 'triangle', vol: 0.12 }),
  buzz: () => { tone(140, 0.18, { type: 'square', vol: 0.08 }); tone(140, 0.18, { type: 'square', vol: 0.08, delay: 0.25 }); },
  sniff: () => { tone(900, 0.08, { vol: 0.1, slide: 400 }); tone(1200, 0.08, { vol: 0.08, slide: 300, delay: 0.09 }); },
  pin: () => tone(180, 0.12, { type: 'triangle', vol: 0.35, slide: -90 }),
  clear: () => tone(520, 0.1, { type: 'sine', vol: 0.15, slide: -120 }),
  stamp: () => { tone(90, 0.25, { type: 'square', vol: 0.25, slide: -40 }); tone(60, 0.3, { vol: 0.3, delay: 0.02 }); },
  good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.18, delay: i * 0.1 })),
  bad: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, { type: 'sawtooth', vol: 0.08, delay: i * 0.13 })),
  msg: () => tone(1040, 0.07, { vol: 0.1 }),
};

export function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported */ } }
