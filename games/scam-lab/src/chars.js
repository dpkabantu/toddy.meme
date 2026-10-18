// Animated characters: Mirage (cut-out rig built from the approved parts)
// and Toddy (flipbook emotes shared with Night Shift).
import { h } from './ui.js';

const A = (n) => `assets/${n}.webp`;

// ---------- Mirage rig ----------
// Rig space: 760 × 1000 units. Each part: image, top-left position, size, pivot (fraction of part), layer.
export const MIRAGE_PARTS = {
  tail:   { img: 'm_tail',   x: -140, y: 560, w: 496, h: 445, px: 0.85, py: 0.85, z: 1 },
  leg_l:  { img: 'm_leg_l',  x: 165, y: 735, w: 281, h: 279, px: 0.6, py: 0.15, z: 2 },
  leg_r:  { img: 'm_leg_r',  x: 345, y: 735, w: 276, h: 279, px: 0.4, py: 0.15, z: 2 },
  torso:  { img: 'm_torso',  x: 160, y: 380, w: 460, h: 437, px: 0.5, py: 1.0, z: 3 },
  arm_l:  { img: 'm_arm_l',  x: 125, y: 500, w: 223, h: 240, px: 0.75, py: 0.1, z: 4, rot: -24 },
  arm_r:  { img: 'm_arm_r',  x: 440, y: 505, w: 263, h: 213, px: 0.2, py: 0.12, z: 4, rot: 28 },
  head:   { img: 'm_head',   x: 130, y: 0,   w: 503, h: 466, px: 0.5, py: 0.9, z: 5 },
};
// face parts sit inside the head and move with it (head-local units)
const FACE = {
  eye_l: { img: 'm_eye_l', x: 40,  y: 95,  w: 236, h: 239 },
  eye_r: { img: 'm_eye_r', x: 330, y: 85,  w: 210, h: 213 },
  mouth: { img: 'm_mouth_talk', x: 175, y: 300, w: 220, h: 95 },
};
const EXPR = { smug: 'mirage_smug', sweet: 'mirage_sweet', panic: 'mirage_panic', caught: 'mirage_caughtface' };
const DISGUISE = { support: 'mirage_support', admin: 'mirage_admin', influencer: 'mirage_influencer', friend: 'mirage_friend', faketoddy: 'mirage_faketoddy' };

const pct = (v, of) => `${(v / of) * 100}%`;

export class Mirage {
  constructor() {
    this.el = h('div', { class: 'mirage-rig', 'aria-hidden': 'true' });
    this.body = h('div', { class: 'mr-body' });
    this.parts = {};
    for (const [k, p] of Object.entries(MIRAGE_PARTS)) {
      const im = h('img', { class: `mr mr-${k}`, src: A(p.img), alt: '', draggable: 'false' });
      Object.assign(im.style, { left: pct(p.x, 760), top: pct(p.y, 1000), width: pct(p.w, 760), zIndex: p.z, transformOrigin: `${p.px * 100}% ${p.py * 100}%`, rotate: p.rot ? `${p.rot}deg` : '' });
      this.parts[k] = im; this.body.append(im);
    }
    const head = MIRAGE_PARTS.head;
    this.face = h('div', { class: 'mr-face' });
    Object.assign(this.face.style, { left: pct(head.x, 760), top: pct(head.y, 1000), width: pct(head.w, 760), height: pct(head.h, 1000), zIndex: 6, transformOrigin: `${head.px * 100}% ${head.py * 100}%` });
    for (const [k, p] of Object.entries(FACE)) {
      const im = h('img', { class: `mr mr-${k}`, src: A(p.img), alt: '', draggable: 'false' });
      Object.assign(im.style, { left: pct(p.x, head.w), top: pct(p.y, head.h), width: pct(p.w, head.w) });
      this.parts[k] = im; this.face.append(im);
    }
    this.parts.mouth.hidden = true;
    this.exprImg = h('img', { class: 'mr mr-expr', alt: '', hidden: true });
    this.face.append(this.exprImg);
    this.body.append(this.face);
    this.disguiseImg = h('img', { class: 'mr-disguise', alt: '', hidden: true });
    this.el.append(this.body, this.disguiseImg);
    this.timers = [];
    this.setState('idle');
  }

  clear() { this.timers.forEach(clearTimeout); this.timers = []; clearInterval(this.talkT); }
  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }

  /** idle | talk | smug | sweet | panic | caught */
  setState(s) {
    this.state = s;
    this.el.dataset.state = s;
    const ex = EXPR[s];
    this.exprImg.hidden = !ex;
    if (ex) this.exprImg.src = A(ex);
    this.parts.head.style.visibility = ex ? 'hidden' : 'visible';
    for (const k of ['eye_l', 'eye_r']) this.parts[k].hidden = !!ex;
    clearInterval(this.talkT);
    this.parts.mouth.hidden = true;
    if (s === 'talk') {
      let open = false;
      this.talkT = setInterval(() => { open = !open; this.parts.mouth.hidden = !open; }, 160);
    }
    return this;
  }

  talk(ms = 1400, then = 'idle') { this.setState('talk'); this.later(ms, () => this.setState(then)); }

  /** Show a disguise, then shimmer away to reveal the chameleon underneath. */
  disguise(name) {
    this.disguiseImg.src = A(DISGUISE[name]);
    this.disguiseImg.hidden = false;
    this.disguiseImg.classList.remove('shimmer-out');
    this.body.classList.add('under');
    return this;
  }
  unmask(after = 'caught') {
    this.disguiseImg.classList.add('shimmer-out');
    this.body.classList.remove('under');
    this.body.classList.add('reveal');
    this.later(1300, () => { this.disguiseImg.hidden = true; this.body.classList.remove('reveal'); });
    this.setState(after);
    return this;
  }
}

// ---------- Toddy flipbooks ----------
// Night Shift emote sheets at 256 px tall: 8 columns, frames left→right, top→bottom.
const EMOTES = {
  curious:   { frames: 44, fw: 243.3 },
  happy:     { frames: 50, fw: 238 },
  surprised: { frames: 52, fw: 240.7 },
  worried:   { frames: 48, fw: 244 },
  wave:      { frames: 49, fw: 238.7 },
};
const COLS = 8; const FH = 256; const FPS = 24;
const loaded = new Map();
export function preloadToddy() {
  for (const k of Object.keys(EMOTES)) {
    if (loaded.has(k)) continue;
    const im = new Image(); im.decoding = 'async'; im.src = `assets/toddy/${k}.webp`;
    loaded.set(k, im.decode ? im.decode().then(() => im).catch(() => null) : Promise.resolve(im));
  }
}

export class Toddy {
  constructor(fallback = 'toddy_sniff') {
    this.el = h('div', { class: 'toddy-fb', role: 'img', 'aria-label': 'Toddy' });
    this.still = h('img', { class: 'toddy-still', src: A(fallback), alt: '' });
    this.canvas = h('canvas', { class: 'toddy-canvas', width: '256', height: '256', hidden: true });
    this.el.append(this.still, this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.raf = 0;
  }
  setStill(name) { this.stop(); this.still.src = A(name); this.still.hidden = false; this.canvas.hidden = true; }
  async play(name, { loop = false, hold = true, reduce = false } = {}) {
    const e = EMOTES[name];
    preloadToddy();
    const im = e && (await loaded.get(name));
    if (!im) return; // sheet not ready or unavailable: keep the still pose
    this.stop();
    const fw = e.fw; const cw = Math.ceil(fw);
    this.canvas.width = cw; this.canvas.height = FH;
    this.still.hidden = true; this.canvas.hidden = false;
    const draw = (f) => {
      const c = f % COLS; const r = Math.floor(f / COLS);
      this.ctx.clearRect(0, 0, cw, FH);
      this.ctx.drawImage(im, c * fw, r * FH, fw, FH, 0, 0, fw, FH);
    };
    if (reduce) { draw(Math.floor(e.frames * 0.6)); return; }
    const t0 = performance.now(); const token = {}; this.token = token;
    const tick = (t) => {
      if (this.token !== token) return;
      let f = Math.floor(((t - t0) / 1000) * FPS);
      if (f >= e.frames) { if (loop) f %= e.frames; else { draw(hold ? e.frames - 1 : 0); return; } }
      draw(f); this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop() { cancelAnimationFrame(this.raf); this.token = null; }
}
