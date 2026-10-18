// Spoiler-free share card (1200×630) drawn in the browser, plus the share sheet.
import { h, A } from './ui.js';

export const GAME_URL = 'https://toddy.meme/games/scam-lab/';

function loadImg(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/** lines: { big, small, stars } — never contains the case answer. */
export async function makeCard({ big, small, stars = 0, badge = null, tag = '' }) {
  const W = 1200; const H = 630;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const bg = await loadImg(A('share_bg'));
  if (bg) g.drawImage(bg, 0, 0, W, H); else { g.fillStyle = '#2a1810'; g.fillRect(0, 0, W, H); }
  // readable panel over the empty cork board in the middle of the art
  g.fillStyle = 'rgba(18,12,9,0.78)';
  roundRect(g, 330, 120, 560, 380, 28); g.fill();
  g.textAlign = 'center';
  g.fillStyle = '#fce25d'; g.font = '700 30px Georgia, serif'; g.fillText('TODDY · SCAM LAB', 610, 178);
  if (tag) { g.fillStyle = '#c9b79d'; g.font = '600 22px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillText(tag.toUpperCase(), 610, 208); }
  g.fillStyle = '#fdaf1e'; g.font = '64px Georgia, serif';
  g.fillText('★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)), 610, 276);
  g.fillStyle = '#f6ead8'; g.font = '700 44px system-ui, -apple-system, Segoe UI, sans-serif';
  wrap(g, big, 610, 340, 500, 52);
  g.fillStyle = '#c9b79d'; g.font = '28px system-ui, -apple-system, Segoe UI, sans-serif';
  wrap(g, small, 610, 402, 500, 34);
  g.fillStyle = '#fdaf1e'; g.font = '700 26px system-ui, sans-serif'; g.fillText('toddy.meme/games/scam-lab', 610, 490);
  if (badge) { const b = await loadImg(A(badge)); if (b) g.drawImage(b, 920, 380, 150, 150 * b.height / b.width); }
  return cv;
}

function roundRect(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, x, y, max, lh) {
  const words = String(text).split(' '); let line = ''; let yy = y;
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > max && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  if (line) g.fillText(line, x, yy);
}

/** Opens the share sheet inside `host` (an overlay element). */
export async function shareSheet(host, { canvas, text, url = GAME_URL, onClose }) {
  const dataUrl = canvas ? canvas.toDataURL('image/png') : null;
  const full = `${text} ${url}`;
  const x = `https://x.com/intent/post?text=${encodeURIComponent(full)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const status = h('p', { class: 'small', role: 'status', text: '' });
  const copy = async () => {
    try { await navigator.clipboard.writeText(full); status.textContent = 'Link copied.'; } catch (e) { status.textContent = `Copy this: ${full}`; }
  };
  const native = async () => {
    try {
      const blob = canvas && await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const files = blob ? [new File([blob], 'toddy-scam-lab.png', { type: 'image/png' })] : [];
      if (files.length && navigator.canShare && navigator.canShare({ files })) await navigator.share({ files, text: full });
      else await navigator.share({ text, url });
    } catch (e) { /* cancelled or not allowed */ }
  };
  host.className = 'overlay scrim sheet';
  host.replaceChildren(h('div', { class: 'card share' },
    h('div', { class: 'who-says', text: 'SHARE' }),
    dataUrl ? h('img', { class: 'share-img', src: dataUrl, alt: 'Your result card' }) : null,
    h('div', { class: 'share-row' },
      navigator.share ? h('button', { class: 'btn', id: 'share-native', onclick: native }, 'Share…') : null,
      h('a', { class: 'btn dark', href: x, target: '_blank', rel: 'noopener noreferrer' }, 'Post on X'),
      h('a', { class: 'btn dark', href: tg, target: '_blank', rel: 'noopener noreferrer' }, 'Telegram'),
      h('button', { class: 'btn dark', id: 'share-copy', onclick: copy }, 'Copy link'),
      dataUrl ? h('a', { class: 'btn dark', href: dataUrl, download: 'toddy-scam-lab.png' }, 'Save image') : null),
    dataUrl ? h('p', { class: 'small', text: 'If Save image does nothing here, press and hold (or right-click) the picture to save it.' }) : null,
    status,
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', id: 'share-close', onclick: () => { host.hidden = true; onClose && onClose(); } }, 'Close'))));
  host.hidden = false;
}
