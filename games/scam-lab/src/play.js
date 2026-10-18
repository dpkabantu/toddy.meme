// The case player: Red Flag Hunt, Spot the Fake, Chat Duel and Boss Case,
// plus the timed Daily Case. Flow:
// Milo intro → phone buzz → investigate (Sniff lens + case board) → decide or chat
// → (look-alike site) → consequence → Milo debrief → quick check / case board → result.
import { h, $, A, fmt } from './ui.js';
import { scoreCase, scoreDaily, strongClues } from './engine.js';
import { sfx, vibrate } from './audio.js';
import { Mirage } from './chars.js';
import { store } from './store.js';

// The case files keep 'Chirp' as the internal key of the social-app look; players see its made-up name
const APP_NAMES = { Chirp: 'Plenvo' };
const appName = (k) => APP_NAMES[k] || k;
const NUDGE_S = 15; const GLOW_S = 25; // nobody should stay stuck for long
let S = null; let G = null;

export function playState() { return S; }

/** env: { calm(), toddy, mirageHost, show(id), hideOverlays(), done(result), sources } */
export function playCase(c, env) {
  G = env;
  S = { c, marks: {}, seen: new Set(), decision: null, quickAnswer: null, board: null, hints: 0, seconds: 0, ticking: false, kit: {},
    lastProgress: 0, nudged: false, glowed: false, countdown: 0, backedOut: false, log: [], node: null, ended: false,
    limit: c.daily ? c.seconds : 0 };
  $('board').replaceChildren(); $('board-count').hidden = true;
  $('hud').hidden = true; $('phone').hidden = true;
  G.toddy.setStill('toddy_sniff'); $('toddy').hidden = false;
  return intro();
}

// called once a second by main.js
export function tick() {
  if (!S || S.ended || document.hidden) return;
  if (S.ticking) {
    S.seconds += 1;
    if (S.limit) {
      const left = S.limit - S.seconds;
      $('hud-time').textContent = fmt(left);
      $('hud-time').classList.toggle('low', left <= 15);
      if (left <= 0) { timeUp(); return; }
    } else $('hud-time').textContent = fmt(S.seconds);
    const idle = S.seconds - S.lastProgress;
    if (!S.c.daily) {
      if (!S.nudged && idle >= NUDGE_S && S.c.hints) { S.nudged = true; toddySays(S.c.hints.nudge); react('thinking'); }
      if (!S.glowed && idle >= GLOW_S) { S.glowed = true; glowNext(); }
    }
  }
  if (S.countdown > 0) {
    S.countdown -= 1;
    document.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = `${el.dataset.label} ${fmt(S.countdown)}`; });
  }
}

const logMove = (type, data) => S.log.push({ t: S.seconds, type, ...data });
// true once the player has quit or started another case: async steps of the old run must stop
const stale = (run) => run !== S || run.ended;
const wait = (ms) => new Promise((r) => setTimeout(r, G.calm() ? Math.min(ms, 30) : ms));
function progress() { S.lastProgress = S.seconds; S.nudged = false; S.glowed = false; document.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow')); }

// ---------- Milo ----------
export function miloSays(text, btn = 'Next', step = '', label = S && S.c.label, skip = null) {
  return new Promise((res) => {
    const m = $('milo');
    m.className = 'overlay';
    m.replaceChildren(
      h('img', { class: 'milo-img', src: A('milo'), alt: 'Milo the owl' }),
      h('div', { class: 'card' }, h('div', { class: 'who-says', text: `MILO${label ? ` · ${label.toUpperCase()}` : ''}${step ? `  ·  ${step}` : ''}` }), h('p', { text }),
        h('div', { class: 'row' },
          skip ? h('button', { class: 'linkbtn', id: 'milo-skip', type: 'button', onclick: () => { sfx.tap(); m.hidden = true; res('skip'); } }, 'Skip intro') : null,
          h('button', { class: 'btn', id: 'milo-next', type: 'button', onclick: () => { sfx.tap(); m.hidden = true; res(); } }, btn))));
    m.hidden = false;
    $('milo-next').focus({ preventScroll: true });
  });
}

async function intro() {
  // very first case ever: no intro at all, the phone buzzes straight away
  if (!G.firstPlay) {
    // one short Milo card (one tap) instead of a chain of cards
    const lines = S.c.intro || [];
    if (lines.length) await miloSays(lines.join(' '), 'Begin', '', S.c.label);
  }
  G.toddy.play('curious', { reduce: G.calm() });
  return incoming();
}

// ---------- Toddy reaction portrait (jacket set): a quick pop on every important tap ----------
let reactTimer = 0;
export function react(name, ms = 1500) {
  if (G && G.calm && G.calm()) return;
  const r = $('react'); if (!r) return;
  r.firstChild.src = A(`tj_${name}_v01`);
  r.hidden = false; r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop');
  $('toddy').classList.add('hush'); // the portrait stands in for the flipbook Toddy, so there is only one Toddy on screen
  clearTimeout(reactTimer); reactTimer = setTimeout(() => { r.hidden = true; $('toddy').classList.remove('hush'); }, ms);
}

// ---------- phone ----------
function phoneScreen(...kids) { $('screen').replaceChildren(...kids); }
const statusbar = () => h('div', { class: 'statusbar' }, h('span', { text: S.c.screen.app === 'mail' ? '9:12' : '2:14' }), h('span', { text: '▮▮▮ 78%' }));

function incoming() {
  $('phone').hidden = false;
  $('react').hidden = true; $('toddy').classList.remove('hush');
  const n = S.c.notify || { app: 'Chirp', from: '', text: '' };
  phoneScreen(statusbar(), h('div', { class: 'lock' },
    h('div', { class: 'lock-time', text: S.c.screen.app === 'mail' ? '9:12' : '2:14' }), h('div', { class: 'lock-date', text: S.c.daily ? 'Today\'s Daily Case' : 'Night shift' }),
    h('button', { class: 'notif', id: 'notif', onclick: openCase },
      h('div', { class: `app app-${n.app.toLowerCase()}`, text: appName(n.app)[0] }), h('b', { text: `${appName(n.app)} · ${n.from}` }), h('span', { text: n.text })),
    h('div', { class: 'lock-hint', text: 'Tap the notification to open it' })));
  setTimeout(() => { const p = $('phone'); p.classList.remove('buzz'); void p.offsetWidth; p.classList.add('buzz'); sfx.buzz(); vibrate([120, 80, 120]); react('surprised', 1300); }, G.calm() ? 0 : 400);
  peek();
}

// Mirage peeks out from behind the shelf in his disguise while the message arrives
function peek() {
  const host = $('mirage-peek'); host.replaceChildren();
  if (!S.c.disguise || G.calm()) return;
  const m = new Mirage(); m.disguise(S.c.disguise);
  host.append(m.el); host.hidden = false; host.classList.remove('out'); void host.offsetWidth; host.classList.add('in');
  setTimeout(() => { host.classList.remove('in'); host.classList.add('out'); }, 2600);
}

// "[screenshot: …]" or "📷 [selfie …]" in a message is an attachment: shown as a small media chip
const ATTACH = /^\s*(\S*)\s*\[(.+)\]\s*$/u;
function attach(text) { const m = ATTACH.exec(text); return m ? `${m[1] || '🖼'} ${m[2]}` : null; }
function part(p) {
  if (typeof p === 'string') { const a = attach(p); return a ? h('span', { class: 'attach', text: a }) : h('span', { text: p }); }
  if (!p.clue) return h('span', { text: p.text, id: p.id || null });
  S.seen.add(p.clue);
  const attrs = { class: `sniff${p.link ? ' link' : ''}`, 'data-clue': p.clue, id: p.id || null, type: 'button', onclick: (e) => openLens(p.clue, e.currentTarget.textContent) };
  if (p.countdown) {
    if (!S.countdown) S.countdown = p.countdown;
    return h('button', { ...attrs, 'data-countdown': '', 'data-label': p.text, text: `${p.text} ${fmt(S.countdown)}` });
  }
  const a = attach(p.text);
  return h('button', { ...attrs, class: `${attrs.class}${a ? ' attach' : ''}`, text: a || p.text });
}
const parts = (arr) => (arr || []).map(part);
const plain = (arr) => (arr || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join('');

function avatar(a) {
  if (!a) return null;
  if (a.clue) S.seen.add(a.clue);
  return h('button', { class: 'avatar', type: 'button', 'data-clue': a.clue || null, 'aria-label': 'Profile picture', onclick: a.clue ? () => openLens(a.clue, `${a.glyph} profile picture`) : null, text: a.glyph });
}

function item(it, app) {
  if (it.time) return h('div', { class: 'stamp-time' }, parts(it.time));
  if (it.sys) return h('div', { class: 'sys' }, parts(it.sys));
  if (it.msg) return h('div', { class: `bubble${it.from === 'me' ? ' me' : ''}${app === 'sms' ? ' sms' : ''}` }, parts(it.msg));
  if (it.p) return h('p', { class: 'mail-p' }, parts(it.p));
  if (it.foot) return h('p', { class: 'mail-foot' }, parts(it.foot));
  return null;
}

function renderScreen() {
  const sc = S.c.screen;
  const kids = [statusbar()];
  let body;
  if (sc.app === 'mail') {
    body = h('div', { class: 'mail', id: 'thread' },
      h('div', { class: 'mail-top' }, h('span', { class: 'back', text: '‹' }), h('span', { text: 'Inbox' })),
      h('h3', { class: 'mail-subject' }, parts(sc.head.subject)),
      h('div', { class: 'mail-from' }, h('div', { class: 'avatar mail-av', text: plain(sc.head.from).trim()[0] || 'M' }),
        h('div', { class: 'who' }, h('span', { class: 'nm' }, parts(sc.head.from)), h('span', { class: 'hd' }, parts(sc.head.addr))),
        h('span', { class: 'mail-time' }, parts(sc.head.time))),
      sc.context ? h('div', { class: 'context', text: sc.context }) : null,
      (sc.items || []).map((it) => item(it, 'mail')));
  } else if (sc.app === 'wallet') {
    // a wallet pop-up (signing request) or the wallet's history list
    body = h('div', { class: 'thread wallet', id: 'thread' },
      sc.context ? h('div', { class: 'context', text: sc.context }) : null,
      h('div', { class: 'w-card' },
        h('div', { class: 'w-top' }, h('span', { class: 'w-logo', text: '🐾' }), h('b', { text: sc.wallet || 'Hedrio' }), h('span', { class: 'w-net', text: sc.network || 'Zelvora Chain' })),
        sc.site ? h('div', { class: 'w-site' }, h('span', { class: 'w-globe', text: '🌐' }), parts(sc.site)) : null,
        h('h3', { class: 'w-title', text: sc.title }),
        sc.rows ? h('dl', { class: 'w-rows' }, sc.rows.map((r) => [h('dt', { text: r.k }), h('dd', {}, parts(r.v))])) : null,
        sc.list ? h('ul', { class: 'w-list' }, sc.list.map((r) => h('li', {}, h('span', { class: 'w-dir', text: r.dir === 'in' ? '↓' : '↑' }), h('span', { class: 'w-what' }, parts(r.what)), h('span', { class: 'w-amt' }, parts(r.amt))))) : null,
        sc.note ? h('p', { class: 'w-note' }, parts(sc.note)) : null,
        // the wallet's own buttons open the decision, like the Decide button
        sc.buttons ? h('div', { class: 'w-btns' }, h('button', { class: 'w-reject', type: 'button', onclick: openDecide, text: sc.buttons[0] }), h('button', { class: 'w-approve', type: 'button', onclick: openDecide, text: sc.buttons[1] })) : null));
  } else if (sc.app === 'compare') {
    body = h('div', { class: 'thread compare', id: 'thread' },
      h('div', { class: 'context', text: sc.context }),
      sc.panels.map((pn) => h('div', { class: 'panel' },
        h('div', { class: 'panel-top' }, avatar(pn.avatar), h('b', { text: pn.label })),
        h('dl', {}, pn.rows.map((r) => [h('dt', { text: r.k }), h('dd', {}, parts(r.v))])),
        pn.note ? h('p', { class: 'panel-note' }, parts(pn.note)) : null)));
  } else {
    const head = sc.head || {};
    body = [
      h('div', { class: `appbar${sc.app === 'sms' ? ' sms-bar' : ''}` }, h('span', { class: 'back', text: '‹' }), avatar(head.avatar),
        h('div', { class: 'who' }, h('span', { class: 'nm' }, parts(head.name)), head.sub ? h('span', { class: 'hd' }, parts(head.sub)) : null)),
      h('div', { class: 'thread', id: 'thread' },
        sc.banner ? h('div', { class: 'request' }, parts(sc.banner)) : null,
        sc.context ? h('div', { class: 'context', text: sc.context }) : null),
    ];
  }
  kids.push(...[body].flat());
  if (S.c.kit) kids.push(kitRow());
  kids.push(h('div', { class: 'phonebar', id: 'phonebar' },
    h('div', { class: 'tip' }, 'Tap anything to sniff it. ', h('span', { class: 'count', id: 'pin-count' })),
    S.c.type === 'duel' ? null : h('button', { class: 'btn', id: 'btn-decide', type: 'button', onclick: openDecide }, 'Decide')));
  phoneScreen(...kids);
}

async function openCase(instant = false) {
  if (instant !== true) sfx.tap();
  $('mirage-peek').hidden = true;
  $('hud').hidden = false; $('hud-case').textContent = `${S.c.label || ''} · ${S.c.daily ? S.c.title.replace('Daily Quickie · ', '') : S.c.title}`;
  $('btn-hint').hidden = !!S.c.daily;
  $('hud-time').textContent = fmt(S.limit ? S.limit - S.seconds : S.seconds);
  $('board-count').hidden = false;
  renderScreen();
  const thread = $('thread'); const run = S;
  S.ticking = true; if (instant !== true) S.lastProgress = S.seconds;
  if (instant !== true && G.firstPlay) toddySays('Tap the glowing words. Let\'s sniff!', 9000);
  if (S.c.screen.app === 'chirp' || S.c.screen.app === 'sms') {
    for (const it of S.c.screen.items) {
      if (it.msg && instant !== true) await typing(thread);
      if (stale(run)) return;
      thread.append(item(it, S.c.screen.app)); thread.scrollTop = thread.scrollHeight;
      if (it.msg && instant !== true) { sfx.msg(); await wait(300); }
    }
    if (stale(run)) return;
    if (S.c.type === 'duel') await runNode(S.node || S.c.duel.start, instant === true);
    if (stale(run)) return;
  }
  paintMarks();
  if (instant !== true && G.firstPlay) { setTimeout(() => glowNext(true), 400); }
  else if (instant !== true && !S.c.daily) setTimeout(() => toddySays(S.c.type === 'duel' ? 'Pick a reply below. Sniff its messages too!' : 'Something smells… let\'s sniff around.'), 300);
}

async function typing(thread) {
  const dots = h('div', { class: 'typing', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
  thread.append(dots); thread.scrollTop = thread.scrollHeight;
  await wait(650); dots.remove();
}

// ---------- chat duel ----------
async function runNode(id, instant = false) {
  S.node = id;
  const n = S.c.duel.nodes[id];
  const thread = $('thread'); const run = S;
  if (!instant) {
    if (n.rename) { const nm = document.getElementById('duel-name'); if (nm) nm.textContent = n.rename; }
    if (n.disguise) peekSwap(n.disguise);
    for (const it of n.say) {
      if (it.msg) await typing(thread);
      if (stale(run)) return;
      thread.append(item(it, 'chirp')); thread.scrollTop = thread.scrollHeight;
      if (it.msg) { sfx.msg(); await wait(250); }
    }
  }
  if (stale(run)) return;
  paintMarks();
  const bar = $('phonebar');
  S.busy = false;
  bar.replaceChildren(h('div', { class: 'replies' }, n.replies.map((r) => h('button', { class: 'reply', type: 'button', 'data-reply': r.next || r.end, onclick: () => reply(r) }, r.text))));
}

function peekSwap(name) {
  if (G.calm()) return;
  const host = $('mirage-peek'); host.replaceChildren();
  const m = new Mirage(); m.disguise(S.c.disguise || name); host.append(m.el);
  host.hidden = false; host.classList.remove('out'); host.classList.add('in');
  setTimeout(() => m.disguise(name), 700);
  setTimeout(() => { host.classList.remove('in'); host.classList.add('out'); }, 2400);
}

async function reply(r) {
  if (S.busy) return; S.busy = true;
  sfx.tap(); progress();
  logMove('reply', { text: r.text, next: r.next, end: r.end });
  $('phonebar').replaceChildren(h('div', { class: 'tip' }, '…'));
  const thread = $('thread');
  thread.append(h('div', { class: 'bubble me' }, r.text)); thread.scrollTop = thread.scrollHeight;
  const run = S;
  await wait(350);
  if (stale(run)) return;
  if (r.next) {
    await runNode(r.next);
    // after the chat moves on, the board count stays live
    updateCount();
  } else finish(r.end);
}

// ---------- Sniff lens ----------
function openLens(clueId, shownText, review = false, after = null) {
  sfx.sniff();
  const clue = S.c.clues[clueId];
  const cur = S.marks[clueId];
  const choose = (mark) => {
    S.marks[clueId] = mark; logMove('mark', { clue: clueId, mark }); progress();
    if (mark === 'flag') { sfx.pin(); vibrate(30); } else sfx.clear();
    paintMarks(); renderBoard(); $('lens').hidden = true; if (after) after();
    G.toddy.play(mark === 'flag' ? 'surprised' : 'curious', { reduce: G.calm() });
    react(mark === 'flag' ? 'suspicious' : 'thinking', 1200);
    if (G.firstPlay && mark === 'flag') glowNext(true); // the next clue lights up by itself
  };
  const l = $('lens');
  l.className = 'overlay scrim';
  l.replaceChildren(
    h('div', { class: 'lens-wrap' }, h('div', { class: `lens-view${shownText.length > 28 ? ' long' : ''}`, text: shownText }), h('img', { src: A('lens'), alt: '' })),
    h('div', { class: 'card lens-card' },
      h('div', { class: 'who-says', text: review ? clue.label.toUpperCase() : 'SNIFF LENS' }),
      h('p', { text: clue.lens }),
      review ? h('p', { class: 'small', text: clue.why }) : null,
      h('div', { class: 'row' }, review
        ? [h('button', { class: 'btn', id: 'lens-close', type: 'button', onclick: () => { l.hidden = true; } }, 'Back')]
        : [
            h('button', { class: 'mark red', id: 'mark-flag', type: 'button', 'aria-pressed': String(cur === 'flag'), onclick: () => choose('flag') }, h('img', { src: A('pin_red'), alt: '' }), 'Red flag'),
            h('button', { class: 'mark grey', id: 'mark-ok', type: 'button', 'aria-pressed': String(cur === 'ok'), onclick: () => choose('ok') }, h('img', { src: A('pin_grey'), alt: '' }), 'Harmless'),
            h('button', { class: 'mark close', id: 'lens-close', type: 'button', onclick: () => { l.hidden = true; if (after) after(); } }, 'Close'),
          ])));
  l.hidden = false;
  (l.querySelector('#mark-flag') || l.querySelector('#lens-close')).focus({ preventScroll: true });
}

function paintMarks() {
  document.querySelectorAll('#screen [data-clue]').forEach((el) => {
    const m = S.marks[el.dataset.clue];
    el.classList.toggle('flagged', m === 'flag'); el.classList.toggle('cleared', m === 'ok');
  });
  updateCount();
}
function updateCount() {
  const n = Object.values(S.marks).filter((m) => m === 'flag').length;
  const k = Object.values(S.marks).filter((m) => m === 'ok').length;
  if ($('pin-count')) $('pin-count').textContent = n ? `${n} red flag${n > 1 ? 's' : ''} pinned.` : '';
  $('board-count').textContent = n + k ? `📌 ${n} pinned · ${k} cleared` : 'Tap what looks odd';
}
function renderBoard() {
  const b = $('board');
  const order = S.log.filter((x) => x.type === 'mark').map((x) => x.clue);
  const ids = [...new Set(order.slice().reverse())].reverse().slice(-9);
  const before = new Set([...b.children].map((n) => n.dataset.k));
  b.replaceChildren(...ids.map((k) => {
    const m = S.marks[k];
    const n = h('div', { class: `note${m === 'ok' ? ' ok' : ''}`, 'data-k': `${k}:${m}` }, h('img', { src: A(m === 'flag' ? 'pin_red' : 'pin_grey'), alt: '' }), S.c.clues[k].label);
    if (before.has(`${k}:${m}`)) n.classList.add('still');
    return n;
  }));
}

// ---------- Toddy's kit: check the profile, the link, the official page ----------
// Each check reveals facts the message doesn't show. A fact tied to a clue can be sniffed and pinned
// from the card, so the evidence and the score work exactly as before.
function kitRow() {
  return h('div', { class: 'kit', id: 'kit-row' }, S.c.kit.map((t) =>
    h('button', { class: `kit-btn${S.kit[t.id] ? ' used' : ''}`, type: 'button', 'data-kit': t.id, onclick: () => openKit(t.id) }, h('span', { class: 'kit-ic', text: t.icon }), t.label)));
}
// In a chat (duel or boss) a fact appears in the card only once its message has shown up, so a check never spoils what comes next
function kitRows(t) { return S.c.duel ? t.rows.filter((r) => !r.clue || S.seen.has(r.clue)) : t.rows; }
function openKit(id) {
  const t = S.c.kit.find((x) => x.id === id); if (!t) return;
  const first = !S.kit[id];
  if (first) { S.kit[id] = true; logMove('kit', { tool: id }); progress(); react('found', 1600); }
  sfx.sniff();
  document.querySelectorAll('.kit-btn.glow').forEach((e) => e.classList.remove('glow'));
  const l = $('lens'); l.className = 'overlay scrim';
  l.replaceChildren(h('div', { class: 'card kit-card' },
    h('div', { class: 'who-says', text: `TODDY'S KIT · ${t.label.toUpperCase()}` }),
    h('h3', { text: t.title }),
    h('ul', { class: 'kit-rows' }, kitRows(t).map((r, i) => {
      const m = r.clue ? S.marks[r.clue] : null;
      const inner = [h('span', { class: 'kit-k', text: r.k }), h('b', { class: 'kit-v', text: r.v }),
        r.clue ? h('span', { class: `kit-mark${m ? ` ${m}` : ''}`, text: m === 'flag' ? '📌 red flag' : m === 'ok' ? '✓ harmless' : 'Sniff ›' }) : null];
      return h('li', { class: first ? 'kit-new' : '', style: null }, r.clue
        ? h('button', { class: 'kit-row', type: 'button', 'data-clue': r.clue, onclick: () => openLens(r.clue, r.v, false, () => openKit(id)) }, inner)
        : h('div', { class: 'kit-row plain' }, inner));
    })),
    h('div', { class: 'row' }, h('button', { class: 'btn', id: 'kit-close', type: 'button', onclick: () => { l.hidden = true; document.querySelectorAll('#kit-row .kit-btn').forEach((b) => b.classList.toggle('used', !!S.kit[b.dataset.kit])); } }, 'Back to the phone'))));
  l.hidden = false; $('kit-close').focus({ preventScroll: true });
}
function suggestKit() {
  const next = (S.c.kit || []).find((t) => !S.kit[t.id]);
  if (!next) return false;
  const b = document.querySelector(`#kit-row [data-kit="${next.id}"]`);
  if (b) { b.classList.add('glow'); b.scrollIntoView({ block: 'nearest' }); }
  toddySays(`Not sure? Good detectives check first. Try “${next.label}”.`, 6000); react('sip', 1800);
  return true;
}

// ---------- Toddy hints ----------
let sayTimer = 0;
export function toddySays(text, ms = 5000) {
  if (!text) return;
  const s = $('toddy-say'); s.textContent = text; s.hidden = false;
  clearTimeout(sayTimer); sayTimer = setTimeout(() => { s.hidden = true; }, ms);
}
function glowNext(quiet = false) {
  const next = (S.c.hints && S.c.hints.glow_order || []).find((k) => S.marks[k] !== 'flag' && document.querySelector(`#screen [data-clue="${k}"]`));
  if (!next) { toddySays(S.c.type === 'duel' ? 'Which reply keeps you safest?' : 'I think we\'ve sniffed enough. Time to decide?'); return; }
  const el = document.querySelector(`#screen [data-clue="${next}"]`);
  el.classList.add('glow'); el.scrollIntoView({ block: 'nearest', behavior: G.calm() ? 'auto' : 'smooth' });
  if (!quiet) { toddySays('Hmm… take a closer sniff at the glowing bit.'); react('thinking'); }
  G.toddy.play('curious', { reduce: G.calm() });
}
export function useHint() {
  if (!S || !S.ticking || S.c.daily) return;
  S.hints += 1; logMove('hint', {}); sfx.tap();
  if (!S.nudged) { S.nudged = true; toddySays(S.c.hints.nudge); } else glowNext();
  S.lastProgress = S.seconds;
}

// ---------- decide ----------
function openDecide() {
  sfx.tap();
  const pinned = Object.values(S.marks).filter((m) => m === 'flag').length;
  const d = $('decide');
  d.className = 'overlay scrim';
  d.replaceChildren(h('div', { class: 'card' },
    h('div', { class: 'who-says', text: 'YOUR MOVE' }),
    h('p', { text: S.c.decide_q || 'What will you do about this message?' }),
    pinned === 0 && strongClues(S.c).length ? h('p', { class: 'small', text: 'You haven\'t pinned any red flags yet. You can still decide, or keep sniffing.' }) : null,
    h('div', { class: 'choices' }, S.c.actions.filter((a) => !a.hidden).map((a) => h('button', { class: 'choice', type: 'button', 'data-action': a.id, onclick: () => decide(a) }, a.label))),
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', id: 'btn-keep', type: 'button', onclick: () => { d.hidden = true; logMove('unsure', {}); if (!suggestKit()) { toddySays('No rush. Sniff anything that looks odd.'); react('thinking'); } } }, S.c.kit ? 'Not sure · investigate more' : 'Not sure · keep sniffing'))));
  d.hidden = false;
}

function decide(a) {
  sfx.tap(); logMove('decide', { action: a.id }); $('decide').hidden = true;
  if (a.goto === 'duel') return startBossChat();
  finish(a.id);
}

async function startBossChat() {
  $('phonebar').replaceChildren(h('div', { class: 'tip' }, 'Opening chat…'));
  toddySays('Careful now. Keep sniffing as they talk.');
  await runNode(S.c.duel.start);
}

function finish(actionId) {
  const a = S.c.actions.find((x) => x.id === actionId);
  if (a && a.trap && !S.backedOut) return trap(actionId);
  S.decision = actionId; S.ticking = false;
  consequence();
}

function trap(actionId) {
  const t = S.c.trap;
  S.saved = [...$('screen').childNodes];
  phoneScreen(statusbar(), h('div', { class: 'browser' },
    h('div', { class: 'urlbar', text: `🔒 ${t.url}` }),
    h('div', { class: 'site' },
      h('h3', { text: t.title }),
      h('div', { class: 'sim', text: 'SIMULATION · never type a real phrase anywhere' }),
      h('p', { class: 'small', text: t.ask }),
      h('div', { class: 'words' }, Array.from({ length: 12 }, (_, i) => h('span', { text: `${i + 1}. •••••` }))),
      h('button', { class: 'go', id: 'trap-go', type: 'button', onclick: () => { logMove('trap', { go: true }); S.decision = actionId; S.ticking = false; consequence(); } }, t.go),
      h('button', { class: 'no', id: 'trap-back', type: 'button', onclick: () => { logMove('trap', { go: false }); S.backedOut = true; toddySays('Phew! Good call backing out. Now pick a safer move.'); backOut(); } }, t.back))));
}

async function backOut() {
  phoneScreen(...S.saved);
  paintMarks();
  if (S.node) await runNode(S.node, true); // put the chat replies back
  else openDecide();
}

function timeUp() {
  S.ticking = false; S.decision = null; logMove('timeout', {});
  ['lens', 'decide'].forEach((id) => { $(id).hidden = true; });
  toddySays('Time\'s up!');
  consequence(true);
}

// ---------- consequence ----------
async function consequence(timeout = false) {
  S.ended = false;
  const o = timeout ? { scene: 'drained', mirage: 'smug', stamp: 'TIME UP', line: 'Out of time. In real life there\'s no timer, so take your time. Here, the clock is part of the challenge.', mirageSays: 'Too slow!' } : S.c.outcomes[S.decision];
  const safe = o.scene === 'safe';
  const wolf = o.scene === 'wolf';
  const sc = h('div', { class: 'sc' });
  const vault = h('img', { class: `vault${safe || wolf ? '' : ' shake'}`, id: 'sc-vault', src: A('vault_shut'), alt: safe ? 'The bean vault, locked tight' : 'The bean vault' });
  sc.append(vault);
  if (o.mirage) {
    const m = new Mirage();
    const holder = h('div', { class: 'sc-mirage' }, m.el);
    sc.append(holder, h('div', { class: 'say mirage-says', text: o.mirageSays }));
    if (S.c.disguise && !wolf) { m.disguise(S.c.disguise2 && S.node ? S.c.disguise2 : S.c.disguise); setTimeout(() => m.unmask(o.mirage), G.calm() ? 0 : 700); }
    else m.setState(o.mirage);
  } else {
    sc.append(h('img', { class: 'sc-toddy', src: A(safe ? 'tj_celebrate_v01' : 'tj_worried_v01'), alt: safe ? 'Toddy, celebrating' : 'Toddy, worried' }));
  }
  sc.append(h('div', { class: `ink${safe ? ' ok' : wolf ? ' wolf' : ''}`, text: o.stamp }));
  if (!safe && !wolf) sc.append(h('img', { class: 'mug', src: A('mug_drained'), alt: 'Toddy\'s mug, drained' }));
  sc.append(h('p', { class: 'line', text: o.line }));
  const s = $('scene');
  s.className = 'overlay';
  s.replaceChildren(sc, h('button', { class: 'btn', id: 'btn-continue', type: 'button', onclick: () => { sfx.tap(); debrief(timeout); } }, 'Continue'));
  s.hidden = false;
  if (!safe && !wolf) { setTimeout(() => { vault.src = A('vault_empty'); }, G.calm() ? 0 : 1000); sfx.bad(); G.toddy.play('worried', { reduce: G.calm() }); }
  else if (wolf) { sfx.bad(); G.toddy.play('worried', { reduce: G.calm() }); }
  else { sfx.good(); G.toddy.play('happy', { reduce: G.calm() }); }
  setTimeout(() => sfx.stamp(), G.calm() ? 0 : 1600);
}

// ---------- debrief ----------
function currentScore() {
  const log = { marks: S.marks, decision: S.decision, quickAnswer: S.quickAnswer, seconds: S.seconds, hints: S.hints, seen: S.c.duel ? [...S.seen] : null, board: S.board };
  return S.c.daily ? scoreDaily(S.c, log) : scoreCase(S.c, log);
}

function debrief(timeout) {
  $('scene').hidden = true;
  const r = currentScore();
  const C = S.c;
  const item = (k, pin) => h('button', { class: 'item', type: 'button', 'data-review': k, onclick: () => openLens(k, C.clues[k].label, true) },
    h('img', { src: A(pin), alt: '' }), h('div', {}, h('b', { text: C.clues[k].label }), h('span', { text: C.clues[k].why })));
  const act = C.actions.find((a) => a.id === S.decision);
  const best = C.actions.find((a) => a.id === C.best_action);
  const verdictText = { best: 'Best move', acceptable: 'Safe move', unsafe: timeout ? 'Out of time' : 'Unsafe move' }[r.decisionKind];
  const strongTotal = strongClues(C, C.duel ? [...S.seen] : null).length;
  const isNewRule = store.addRule(C.id, C.golden_rule, C.title);
  const d = $('debrief');
  d.className = 'overlay scrim';
  d.replaceChildren(h('div', { class: 'card' },
    h('div', { class: 'who-says', text: 'MILO\'S DEBRIEF' }),
    strongTotal ? h('div', { class: 'dsec' }, h('h4', { text: `Red flags you found · ${r.found.length} of ${strongTotal}` }),
      r.found.length ? r.found.map((k) => item(k, 'pin_red')) : h('p', { class: 'small', text: 'None this time.' }))
      : h('div', { class: 'dsec' }, h('h4', { text: 'Red flags in this message · none' }), h('p', { class: 'small', text: 'This one was genuine. The skill here was not crying wolf.' })),
    r.missed.length ? h('div', { class: 'dsec' }, h('h4', { text: 'Red flags you missed' }), r.missed.map((k) => item(k, 'pin_red'))) : null,
    r.falseAlarms.length ? h('div', { class: 'dsec' }, h('h4', { text: 'Harmless details you flagged' }), r.falseAlarms.map((k) => item(k, 'pin_grey'))) : null,
    h('div', { class: 'dsec' }, h('h4', { text: 'Your move' }),
      h('p', {}, h('span', { class: `verdict ${r.decisionKind}`, text: verdictText }), act ? ` ${act.label}.` : ''),
      r.decisionKind !== 'best' ? h('p', { class: 'small', text: `Best move: ${best.label}. ${(C.what_if || {})[S.decision] || ''}` }) : null),
    h('div', { class: 'rule' }, h('small', { text: isNewRule ? 'New Golden Rule · added to your notebook' : 'Golden Rule' }), C.golden_rule),
    h('p', { class: 'small', text: 'Tap any flag above to look at the evidence again.' }),
    h('div', { class: 'row sticky' }, h('button', { class: 'btn', id: 'btn-quick', type: 'button', onclick: () => { sfx.tap(); d.hidden = true; if (C.board) board(); else if (C.quick_check && !C.daily) quick(); else result(); } }, C.board ? 'To the case board' : C.quick_check && !C.daily ? 'Quick check' : 'See your result'))));
  d.hidden = false;
  d.querySelector('.card').scrollTop = 0;
}

// ---------- quick check ----------
function quick() {
  const q = S.c.quick_check;
  const box = h('div', { class: 'choices' }); const after = h('div', {});
  q.options.forEach((o) => box.append(h('button', { class: 'choice', type: 'button', 'data-option': o.id, onclick: (e) => {
    if (S.quickAnswer) return;
    S.quickAnswer = o.id; logMove('quick', { answer: o.id });
    const right = o.id === q.answer;
    right ? sfx.good() : sfx.bad();
    box.querySelectorAll('.choice').forEach((b) => { if (b.dataset.option === q.answer) b.classList.add('right'); });
    if (!right) e.currentTarget.classList.add('wrong');
    after.replaceChildren(h('p', { class: 'small', text: `${right ? 'Right!' : 'Not quite.'} ${q.explain}` }),
      h('div', { class: 'row' }, h('button', { class: 'btn', id: 'btn-result', type: 'button', onclick: () => { sfx.tap(); $('quick').hidden = true; result(); } }, 'See your result')));
  } }, o.text)));
  const el = $('quick');
  el.className = 'overlay scrim';
  el.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'who-says', text: 'QUICK CHECK' }), h('p', { text: q.q }), box, after));
  el.hidden = false;
}

// ---------- boss case board ----------
function board() {
  const B = S.c.board;
  const seen = [...S.seen].filter((k) => S.c.clues[k]);
  let verdict = null; const picks = new Set();
  const submit = h('button', { class: 'btn', id: 'btn-board', type: 'button', disabled: true, onclick: () => {
    S.board = { verdict, picks: [...picks] }; logMove('board', S.board);
    const right = verdict === B.answer;
    right ? sfx.good() : sfx.bad();
    $('quick').hidden = true;
    unmask(right);
  } }, 'Close the case');
  const ready = () => { submit.disabled = !(verdict && picks.size === B.pick); count.textContent = `${picks.size} of ${B.pick} picked`; };
  const count = h('span', { class: 'small' });
  const el = $('quick');
  el.className = 'overlay scrim';
  el.replaceChildren(h('div', { class: 'card' },
    h('div', { class: 'who-says', text: 'CASE BOARD' }), h('p', { text: B.q }),
    h('div', { class: 'choices' }, B.verdicts.map((v) => h('button', { class: 'choice', type: 'button', 'data-verdict': v.id, 'aria-pressed': 'false', onclick: (e) => {
      verdict = v.id; el.querySelectorAll('[data-verdict]').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); sfx.tap(); ready();
    } }, v.text))),
    h('p', { text: `Pin the ${B.pick} strongest pieces of evidence:` }),
    h('div', { class: 'pickgrid' }, seen.map((k) => h('button', { class: 'pick', type: 'button', 'data-pick': k, 'aria-pressed': 'false', onclick: (e) => {
      if (picks.has(k)) picks.delete(k); else if (picks.size < B.pick) picks.add(k);
      e.currentTarget.setAttribute('aria-pressed', String(picks.has(k))); sfx.pin(); ready();
    } }, h('img', { src: A('pin_red'), alt: '' }), S.c.clues[k].label))),
    h('div', { class: 'row sticky' }, count, submit)));
  el.hidden = false; ready();
}

function unmask(right) {
  const s = $('scene');
  const m = new Mirage();
  const o = S.decision && S.c.outcomes[S.decision];
  const safe = !!o && o.scene === 'safe';
  const caught = right && safe;
  const sc = h('div', { class: 'sc unmask' },
    h('div', { class: 'sc-mirage big' }, m.el),
    h('div', { class: `ink${caught ? ' ok' : ''}`, text: caught ? 'UNMASKED' : 'ESCAPED' }),
    h('p', { class: 'line', text: caught ? `${S.c.board.explain} Mirage is caught red-handed!` : `${S.c.board.explain} This time, Mirage slipped away.` }));
  s.className = 'overlay';
  s.replaceChildren(sc, h('button', { class: 'btn', id: 'btn-continue', type: 'button', onclick: () => { sfx.tap(); s.hidden = true; result(); } }, 'See your result'));
  s.hidden = false;
  m.disguise(S.c.disguise2 || S.c.disguise);
  setTimeout(() => {
    m.unmask(caught ? 'caught' : 'smug');
    if (caught) setTimeout(() => { const img = h('img', { class: 'sc-caught', src: A('mirage_caught'), alt: 'Mirage, tangled in red string' }); sc.querySelector('.sc-mirage').replaceChildren(img); sfx.stamp(); vibrate(60); }, G.calm() ? 0 : 1500);
  }, G.calm() ? 0 : 900);
  caught ? G.toddy.play('happy', { reduce: G.calm() }) : G.toddy.play('worried', { reduce: G.calm() });
}

// ---------- result ----------
function result() {
  S.ended = true;
  const r = currentScore();
  G.done({ case: S.c, score: r, seconds: S.seconds, log: S.log });
}
