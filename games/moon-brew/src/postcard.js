// TODDY: Moon Brew — the postcard builder.
// Every Night after the third gets its own postcard, put together from a small set of painted pieces:
//   a café background (with the window glass cut out), a night sky seen through it, Toddy in one of three poses,
//   the Night's visitor, and a prop on the counter. Which pieces and where is decided only by the Night number,
//   so every player gets exactly the same postcard for the same Night, and there is no limit to how many Nights.
// planFor() is pure (no drawing), so a test can check that it is the same every time and varied from Night to Night.

import { rng } from './core.js';
import { nightInfo } from './levels.js';

export const W = 1200, H = 800;
const BGS = ['counter', 'roundwindow', 'bookshelf', 'terrace'];
const SKIES = ['fullmoon', 'crescent', 'rain', 'snow', 'aurora'];
const POSES = ['serve', 'wave', 'sip'];
const PROPS = ['plant', 'lantern', 'cakestand', 'books'];

// The recipe for Night n (0 = Night 1). Steps of different sizes walk through the pieces so neighbouring Nights differ
// in almost every layer; a little seeded jitter in position and size, and the numbered stamp, make every card unique.
export function planFor(n) {
  const c = Math.max(0, n - 3); // Night 4 is the first built card
  const R = rng(n * 2654435 + 97);
  const jitter = (range) => Math.round((R() * 2 - 1) * range);
  const toddyLeft = ((c * 7 + (c >> 2)) % 2) === 0;
  return {
    night: n + 1,
    visitor: nightInfo(n).visitor,
    bg: BGS[c % 4],
    sky: SKIES[(c * 3 + Math.floor(c / 5)) % 5],
    pose: POSES[(c * 2 + Math.floor(c / 3)) % 3],
    prop: PROPS[(c * 5 + 2 + Math.floor(c / 4)) % 4],
    toddyLeft,
    toddyX: (toddyLeft ? 330 : 870) + jitter(40),
    visitorX: (toddyLeft ? 880 : 320) + jitter(40),
    propX: 600 + jitter(70) + (toddyLeft ? 30 : -30),
    toddyH: 400 + jitter(14),
    visitorH: 300 + jitter(14),
    stampTilt: (R() * 2 - 1) * 0.08,
    golden: (n + 1) % 10 === 0, // every tenth Night gets a gold frame
  };
}

let parts = null; // postcard_parts.json: where each counter's back edge is, file names, piece sizes
const pics = {};
function pic(base, name) {
  if (!pics[name]) pics[name] = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = base + name; });
  return pics[name];
}
async function loadParts(base) {
  if (!parts) parts = await fetch(base + 'postcard_parts.json').then(r => r.json()).catch(() => null);
  return parts;
}

// Draws the postcard for Night n and returns a canvas (scale 1 = 1200 x 800).
export async function buildPostcard(n, base, scale = 1) {
  const p = planFor(n);
  const meta = await loadParts(base);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  cv.className = 'postcard';
  const x = cv.getContext('2d');
  x.scale(scale, scale);
  if (!meta) { x.fillStyle = '#17112a'; x.fillRect(0, 0, W, H); return cv; }
  const bgMeta = meta.bg[p.bg], tMeta = meta.toddy[p.pose], prMeta = meta.prop[p.prop];
  const [sky, bg, toddy, prop, vis] = await Promise.all([
    pic(base, meta.sky[p.sky]), pic(base, bgMeta.file), pic(base, tMeta.file), pic(base, prMeta.file), pic(base, `visitor_${p.visitor}_happy_v01.webp`),
  ]);
  const edge = bgMeta.counter;            // y of the counter's back edge in this background
  const put = (im, cx, h, bottom, maxW) => { // draw a piece standing with its feet at `bottom`
    if (!im) return;
    let dh = h, dw = h * im.naturalWidth / im.naturalHeight;
    if (maxW && dw > maxW) { dw = maxW; dh = dw * im.naturalHeight / im.naturalWidth; }
    x.drawImage(im, cx - dw / 2, bottom - dh, dw, dh);
  };
  // the scene is zoomed a little so the empty front of the counter does not fill the lower half of the card
  x.save(); x.translate(W / 2, 230); x.scale(1.2, 1.2); x.translate(-W / 2, -230);
  // 1 night sky, 2 café with its window glass cut out
  if (sky) x.drawImage(sky, 0, 0, W, H); else { x.fillStyle = '#22304f'; x.fillRect(0, 0, W, H); }
  if (bg) x.drawImage(bg, 0, 0, W, H);
  // 3 Toddy and the visitor stand behind the counter...
  put(toddy, p.toddyX, p.toddyH, edge + 64);
  put(vis, p.visitorX, p.visitorH, edge + 46, 400);
  // 4 ...so the counter is drawn again over their feet
  if (bg) x.drawImage(bg, 0, edge, W, H - edge, 0, edge, W, H - edge);
  // 5 the prop sits on top of the counter, with a soft shadow
  if (prop) {
    const ph = 150, pw = ph * prop.naturalWidth / prop.naturalHeight, by = edge + 52;
    x.save(); x.fillStyle = 'rgba(40,18,6,.35)'; x.beginPath(); x.ellipse(p.propX, by, pw * 0.42, 9, 0, 0, Math.PI * 2); x.fill(); x.restore();
    x.drawImage(prop, p.propX - pw / 2, by - ph, pw, ph);
  }
  x.restore();
  // 6 a warm vignette keeps the eye in the middle
  const vg = x.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, H * 0.95);
  vg.addColorStop(0, 'rgba(23,17,42,0)'); vg.addColorStop(1, 'rgba(23,17,42,.45)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  // 7 the stamp with the Night number
  x.save();
  x.translate(W - 150, H - 78); x.rotate(p.stampTilt);
  x.fillStyle = 'rgba(254,241,216,.92)'; x.strokeStyle = '#8a4a1c'; x.lineWidth = 4; x.setLineDash([10, 6]);
  x.beginPath(); x.roundRect ? x.roundRect(-104, -42, 208, 84, 12) : x.rect(-104, -42, 208, 84); x.fill(); x.stroke();
  x.setLineDash([]); x.fillStyle = '#5a2a10'; x.textAlign = 'center';
  x.font = '800 22px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif'; x.fillText('TODDY', 0, -8);
  x.font = '900 34px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif'; x.fillText('Night ' + p.night, 0, 28);
  x.restore();
  // 8 gold frame on every tenth Night
  if (p.golden) {
    x.strokeStyle = '#fdaf1e'; x.lineWidth = 16; x.strokeRect(8, 8, W - 16, H - 16);
    x.strokeStyle = '#fff1b0'; x.lineWidth = 3; x.strokeRect(20, 20, W - 40, H - 40);
  }
  return cv;
}
