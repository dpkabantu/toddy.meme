// TODDY Trail music: original, made live in the browser with Web Audio (no audio files, no third-party anything).
// One theme per night. The music builds as the lanterns run low: drums come in, the beat speeds up, the melody gets busier.
// This file only makes sound. It never touches the game rules, so replays and scores are unaffected.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORD = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], d7: [0, 4, 7, 10], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], six: [0, 4, 7, 9], m: [0, 3, 7], maj: [0, 4, 7], sus: [0, 5, 7, 10] };
const PENT_MAJ = [0, 2, 4, 7, 9], PENT_MIN = [0, 3, 5, 7, 10];

// bpm, chords (bass-octave root + type), melody scale and lowest lead note, lead sound, mood switches
const THEMES = {
  menu: { bpm: 84, chords: [[53, 'maj7'], [50, 'm7'], [55, 'm7'], [48, 'd7']], scale: PENT_MAJ, lead: 65, sound: 'rhodes', swing: 0.1, calm: true },
  1: { bpm: 92, chords: [[53, 'maj7'], [50, 'm7'], [55, 'm7'], [48, 'd7']], scale: PENT_MAJ, lead: 65, sound: 'rhodes', swing: 0.12 },
  2: { bpm: 104, chords: [[48, 'maj7'], [55, 'six'], [57, 'm7'], [53, 'maj7']], scale: PENT_MAJ, lead: 72, sound: 'pluck', swing: 0.05 },
  3: { bpm: 112, chords: [[50, 'm9'], [58, 'maj7'], [53, 'maj7'], [48, 'six']], scale: PENT_MIN, lead: 62, sound: 'pluck', swing: 0.08 },
  4: { bpm: 80, chords: [[48, 'maj9'], [57, 'm9'], [50, 'm9'], [55, 'sus']], scale: PENT_MAJ, lead: 64, sound: 'rhodes', swing: 0.1, rain: true },
  5: { bpm: 72, chords: [[55, 'maj7'], [52, 'm7'], [48, 'maj7'], [50, 'six']], scale: PENT_MAJ, lead: 67, sound: 'harp', swing: 0 },
  6: { bpm: 90, chords: [[50, 'm'], [58, 'maj'], [55, 'm'], [57, 'm']], scale: PENT_MIN, lead: 62, sound: 'bell', swing: 0 },
  7: { bpm: 122, chords: [[48, 'maj'], [55, 'maj'], [57, 'm'], [53, 'maj']], scale: PENT_MAJ, lead: 72, sound: 'pluck', swing: 0, drive: true },
};
// which beats the melody may use (16 steps per bar): a few rhythm shapes
const RHYTHMS = [[0, 3, 6, 8, 11, 14], [0, 2, 4, 7, 8, 10, 12, 15], [0, 4, 6, 8, 12, 14], [0, 3, 4, 8, 10, 11, 14], [2, 4, 7, 10, 12, 15]];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createMusic() {
  let sfxBus = null, ctx = null, master = null, bus = null, revIn = null, dlyIn = null, noiseBuf = null, timer = 0;
  let enabled = true, theme = null, themeKey = null, level = 0, targetLevel = 0, tempoMul = 1, nextTime = 0, step = 0, bar = 0, rand = rng(1), melody = [], rainNode = null, playing = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
    bus = ctx.createGain(); bus.gain.value = 0.0; bus.connect(master);
    // a soft hall made from decaying noise
    const len = Math.floor(ctx.sampleRate * 2.4), imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const conv = ctx.createConvolver(); conv.buffer = imp; revIn = ctx.createGain(); revIn.gain.value = 0.55; revIn.connect(conv); const revOut = ctx.createGain(); revOut.gain.value = 0.5; conv.connect(revOut); revOut.connect(bus);
    // a gentle echo for the melody
    const dly = ctx.createDelay(1.0); dly.delayTime.value = 0.375; const fb = ctx.createGain(); fb.gain.value = 0.3; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    dlyIn = ctx.createGain(); dlyIn.gain.value = 0.4; dlyIn.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(revIn); lp.connect(bus);
    const nlen = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else if (enabled && playing) ctx.resume().catch(() => {}); });
    return ctx;
  }

  // ---- voices ----
  function osc(type, freq, t0, t1, gain, out, detune) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; if (detune) o.detune.value = detune; const g = ctx.createGain(); o.connect(g); g.connect(out); g.gain.setValueAtTime(0.0001, t0); o.start(t0); o.stop(t1 + 0.05); return { o, g }; }
  function rhodes(f, t, dur, vol, send) {
    const out = ctx.createGain(); out.gain.value = vol; out.connect(bus); out.connect(revIn); if (send) out.connect(dlyIn);
    const a = osc('sine', f, t, t + dur + 0.2, 1, out), b = osc('sine', f * 2, t, t + dur, 0.3, out), c = osc('sine', f * 7.1, t, t + 0.25, 0.05, out);
    a.g.gain.linearRampToValueAtTime(1, t + 0.008); a.g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.15);
    b.g.gain.linearRampToValueAtTime(0.26, t + 0.006); b.g.gain.exponentialRampToValueAtTime(0.0008, t + dur * 0.6);
    c.g.gain.linearRampToValueAtTime(0.08, t + 0.003); c.g.gain.exponentialRampToValueAtTime(0.0008, t + 0.2);
  }
  function pluck(f, t, dur, vol, send) {
    const out = ctx.createGain(); out.gain.value = vol; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.35); out.connect(lp); lp.connect(bus); lp.connect(revIn); if (send) lp.connect(dlyIn);
    const a = osc('triangle', f, t, t + dur + 0.2, 1, out), b = osc('sine', f * 2, t, t + dur, 0.25, out);
    a.g.gain.linearRampToValueAtTime(1, t + 0.006); a.g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.1); b.g.gain.linearRampToValueAtTime(0.25, t + 0.004); b.g.gain.exponentialRampToValueAtTime(0.0008, t + dur * 0.5);
  }
  function bell(f, t, dur, vol, send) {
    const out = ctx.createGain(); out.gain.value = vol; out.connect(bus); out.connect(revIn); if (send) out.connect(dlyIn);
    [[1, 1], [2.76, 0.28], [5.4, 0.1]].forEach(([r, g], i) => { const v = osc('sine', f * r, t, t + dur + 0.6, 1, out); v.g.gain.linearRampToValueAtTime(g, t + 0.004); v.g.gain.exponentialRampToValueAtTime(0.0008, t + (dur + 0.5) / (1 + i * 0.7)); });
  }
  function harp(f, t, dur, vol, send) { pluck(f, t, dur * 0.8, vol * 1.1, send); }
  function lead(f, t, dur, vol) { const s = theme.sound; (s === 'bell' ? bell : s === 'harp' ? harp : s === 'pluck' ? pluck : rhodes)(f, t, dur, vol, true); }
  function pad(notes, t, dur, vol) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(vol, t + dur * 0.3); out.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.85); out.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    out.connect(lp); lp.connect(bus); lp.connect(revIn);
    notes.forEach((m) => { [-7, 0, 7].forEach((d) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = d; o.connect(out); o.start(t); o.stop(t + dur + 0.7); }); });
  }
  function bass(m, t, dur, vol) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; const out = ctx.createGain(); out.gain.value = vol; out.connect(lp); lp.connect(bus);
    const a = osc('sine', mtof(m), t, t + dur, 1, out), b = osc('triangle', mtof(m), t, t + dur, 0.3, out);
    [a, b].forEach((v) => { v.g.gain.linearRampToValueAtTime(v === a ? 1 : 0.3, t + 0.01); v.g.gain.exponentialRampToValueAtTime(0.001, t + dur); });
  }
  function kick(t, vol) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.25); }
  function noise(t, dur, type, freq, vol, q) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.9 + rand() * 0.2; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.connect(f); f.connect(g); g.connect(bus); if (type === 'bandpass') g.connect(revIn); s.start(t, rand() * 1.5); s.stop(t + dur + 0.02); }

  // ---- the arrangement ----
  const chordNotes = (c) => CHORD[c[1]].map((s) => c[0] + s);
  function planMelody() {   // a fresh little tune for each bar, from the night's pentatonic scale (deterministic per theme)
    const pool = []; for (let k = 0; k < 2; k++) for (const s of theme.scale) pool.push(theme.lead + s + 12 * k);
    melody = theme.chords.map((c, bi) => {
      const shape = RHYTHMS[Math.floor(rand() * RHYTHMS.length)], notes = {}; let idx = Math.floor(rand() * pool.length * 0.6) + 1;
      shape.forEach((st, j) => { const dir = rand() < 0.5 ? -1 : 1, hop = rand() < 0.2 ? 2 : 1; idx = Math.max(0, Math.min(pool.length - 1, idx + dir * hop)); if (j === 0 && bi === theme.chords.length - 1) idx = Math.min(pool.length - 1, 2); notes[st] = pool[idx]; });
      return notes;
    });
  }
  const stepDur = () => 60 / (theme.bpm * tempoMul) / 4;
  function scheduleStep(s, t) {
    const chord = theme.chords[bar % theme.chords.length], notes = chordNotes(chord), sd = stepDur(), lv = level;
    const sw = theme.swing && s % 2 === 1 ? theme.swing * sd : 0, tt = t + sw;
    if (s === 0) { pad(notes.map((m) => m + 12), t, sd * 16, theme.calm ? 0.05 : 0.06); if (theme.rain) startRain(); }
    // bass: root on the one, a pickup, and more movement as it gets exciting
    const bassSteps = lv === 0 ? [0, 8] : lv === 1 ? [0, 6, 8, 14] : [0, 3, 6, 8, 11, 14];
    if (bassSteps.includes(s)) bass(chord[0] - 12 + (s === 6 || s === 14 ? 7 : 0) * (lv > 0 && s % 8 === 6 ? 1 : 0), tt, sd * 3, theme.drive ? 0.42 : 0.36);
    // chord arpeggio: slow at first, quicker later
    const arpEvery = lv === 0 ? 4 : lv === 1 ? 2 : 1;
    if (s % arpEvery === 0) { const i = (s / arpEvery) % notes.length, up = notes[i] + 12 + (lv === 2 && s % 4 === 3 ? 12 : 0); if (theme.sound !== 'bell' || s % 4 === 0) (theme.sound === 'harp' ? harp : rhodes)(mtof(up), tt, sd * 3, lv === 0 ? 0.045 : 0.05, false); }
    // melody: sparse when calm, every written note when tense
    const mel = melody[bar % melody.length][s];
    if (mel !== undefined && (lv > 0 || s % 4 === 0 || s === 0 || (s % 8 === 3 && rand() < 0.5))) lead(mtof(mel), tt, sd * (lv === 2 ? 2 : 4), lv === 2 ? 0.1 : 0.085);
    if (lv === 2 && s % 2 === 1 && rand() < 0.35) lead(mtof(mel !== undefined ? mel + 12 : theme.lead + 12 + theme.scale[s % 5]), tt, sd * 1.5, 0.05);
    // drums join in from level 1
    if (lv >= 1 || theme.drive) {
      const four = lv === 2 || theme.drive;
      if (four ? s % 4 === 0 : s === 0 || s === 10) kick(t, theme.drive ? 0.5 : 0.4);
      if (s === 4 || s === 12) noise(t, 0.14, 'bandpass', 1800, lv === 2 ? 0.11 : 0.07, 0.8);
      if (s % (lv === 2 ? 1 : 2) === 0) noise(tt, 0.045, 'highpass', 7500, s % 4 === 0 ? 0.05 : 0.03);
    }
  }
  function startRain() {
    if (rainNode || !noiseBuf) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 0.4; const g = ctx.createGain(); g.gain.value = 0.05; s.connect(f); f.connect(g); g.connect(bus); s.start(); rainNode = { s, g };
  }
  function stopRain() { if (rainNode) { try { rainNode.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6); rainNode.s.stop(ctx.currentTime + 0.7); } catch (_) { /* already stopped */ } rainNode = null; } }
  function tick() {
    if (!ctx || !playing || !theme) return;
    const target = [1, 1.07, 1.15][targetLevel]; tempoMul += (target - tempoMul) * 0.01;
    level = targetLevel;
    while (nextTime < ctx.currentTime + 0.14) { scheduleStep(step % 16, nextTime); nextTime += stepDur(); step++; if (step % 16 === 0) bar++; }
  }

  return {
    sfx(kind) {   // short game sounds, louder than the music so they stand out; same context as the music
      if (!enabled) return; const c = ensure(); if (!c) return; if (c.state === 'suspended') c.resume().catch(() => {});
      if (!sfxBus) { sfxBus = c.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master); }
      const t = c.currentTime + 0.01;
      const tone = (type, f0, f1, dur, vol) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02); };
      const hiss = (type, f0, f1, dur, vol, delay) => { const s = c.createBufferSource(); s.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t + (delay || 0)); f.frequency.exponentialRampToValueAtTime(f1, t + (delay || 0) + dur); f.Q.value = 1.2; const g = c.createGain(); g.gain.setValueAtTime(vol, t + (delay || 0)); g.gain.exponentialRampToValueAtTime(0.001, t + (delay || 0) + dur); s.connect(f); f.connect(g); g.connect(sfxBus); g.connect(revIn); s.start(t + (delay || 0), Math.random()); s.stop(t + (delay || 0) + dur + 0.02); };
      const chime = (m, d, v) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(v, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.5); o.connect(g); g.connect(sfxBus); g.connect(revIn); o.start(t + d); o.stop(t + d + 0.55); };
      if (kind === 'spill') { hiss('bandpass', 2600, 500, 0.45, 0.5); hiss('lowpass', 1400, 300, 0.3, 0.4, 0.05); tone('sine', 420, 120, 0.3, 0.25); }   // splash + glug
      else if (kind === 'bump') { tone('sine', 150, 40, 0.22, 0.9); hiss('lowpass', 900, 200, 0.14, 0.5); }   // dull thud
      else if (kind === 'slide') { hiss('highpass', 1500, 5000, 0.5, 0.3); tone('triangle', 500, 900, 0.3, 0.08); }   // slippery swoosh
      else if (kind === 'snatch') { tone('sawtooth', 700, 120, 0.4, 0.25); hiss('bandpass', 3000, 800, 0.25, 0.3); }
      else if (kind === 'serve') { chime(79, 0, 0.3); chime(84, 0.09, 0.3); chime(91, 0.18, 0.28); }
      else if (kind === 'brew') { chime(88, 0, 0.22); hiss('bandpass', 3500, 2500, 0.2, 0.15); }
      else if (kind === 'sigh') { tone('triangle', 330, 180, 0.4, 0.2); }
      else if (kind === 'turn') { tone('sine', 520, 520, 0.03, 0.04); }
      else if (kind === 'win') { [72, 76, 79, 84].forEach((n, i) => chime(n, i * 0.12, 0.3)); }
    },
    ctx() { return ensure(); },
    resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); },
    setEnabled(on) {
      enabled = on; if (!ctx) return;
      if (!on) { if (sfxBus) sfxBus.gain.value = 0.0001; bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.25); }
      else { if (sfxBus) sfxBus.gain.value = 1; if (playing) bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.4); }
    },
    isEnabled() { return enabled; },
    play(key) {   // key: 'menu' or a night number
      const c = ensure(); if (!c) return; this.resume();
      if (playing && themeKey === key) return;
      themeKey = key; theme = THEMES[key] || THEMES.menu; rand = rng(7000 + (typeof key === 'number' ? key * 131 : 5)); planMelody();
      level = targetLevel = 0; tempoMul = 1; step = 0; bar = 0; nextTime = c.currentTime + 0.12; playing = true; stopRain();
      bus.gain.cancelScheduledValues(c.currentTime); bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), c.currentTime); bus.gain.linearRampToValueAtTime(enabled ? 0.6 : 0.0001, c.currentTime + 1.2);
      clearInterval(timer); timer = setInterval(tick, 30); tick();
    },
    setLevel(l) { targetLevel = Math.max(0, Math.min(2, l)); },
    stop(fade) { if (!ctx || !playing) return; playing = false; themeKey = null; clearInterval(timer); stopRain(); bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + (fade || 0.6)); },
    stinger(won) {   // a short phrase when the night ends
      if (!ctx || !enabled) return; this.stop(0.25); const t = ctx.currentTime + 0.3, th = theme || THEMES[1];
      bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setValueAtTime(0.6, ctx.currentTime);
      const base = th.chords[0][0] + 12;
      if (won) { [0, 4, 7, 11, 16].forEach((s, i) => bell(mtof(base + 12 + s), t + i * 0.13, 0.9, 0.12, true)); pad([base, base + 4, base + 7, base + 11], t, 1.6, 0.07); }
      else { [7, 3, 0].forEach((s, i) => rhodes(mtof(base + 12 + s), t + i * 0.28, 0.7, 0.11, true)); pad([base, base + 3, base + 7], t, 1.4, 0.05); }
    },
  };
}
