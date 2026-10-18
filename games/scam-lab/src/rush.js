// Inbox Rush: swipe left = scam, right = safe. Ten messages, one real minute.
import { h, $, fmt } from './ui.js';
import { scoreRush } from './engine.js';
import { sfx, vibrate } from './audio.js';
import { miloSays } from './play.js';
import { store } from './store.js';

let R = null; let G = null;
export function rushState() { return R; }

export async function playRush(c, env) {
  G = env;
  R = { c, i: 0, answers: {}, left: c.seconds, ticking: false, ended: false, quickAnswer: null, log: [] };
  $('board').replaceChildren(); $('board-count').hidden = true; $('hud').hidden = true; $('phone').hidden = true;
  G.toddy.setStill('toddy_sniff'); $('toddy').hidden = false;
  for (let i = 0; i < c.intro.length; i++) {
    const last = i === c.intro.length - 1;
    if (await miloSays(c.intro[i], last ? 'Start the clock' : 'Next', `${i + 1} / ${c.intro.length}`, c.label, !last) === 'skip') break;
  }
  start();
}

export function rushTick() {
  if (!R || !R.ticking || document.hidden) return;
  R.left -= 1;
  $('hud-time').textContent = fmt(R.left);
  $('hud-time').classList.toggle('low', R.left <= 10);
  const bar = $('rush-bar'); if (bar) bar.style.width = `${(100 * R.left) / R.c.seconds}%`;
  if (R.left <= 0) end();
}

function start() {
  $('hud').hidden = false; $('btn-hint').hidden = true;
  $('hud-case').textContent = `${R.c.label} · ${R.c.title}`; $('hud-time').textContent = fmt(R.left);
  $('phone').hidden = false;
  $('screen').replaceChildren(
    h('div', { class: 'statusbar' }, h('span', { text: '7:58' }), h('span', { text: '▮▮▮ 91%' })),
    h('div', { class: 'rush-top' }, h('b', { text: 'Inbox' }), h('span', { id: 'rush-count', class: 'small-ph' })),
    h('div', { class: 'rush-timer' }, h('i', { id: 'rush-bar' })),
    h('div', { class: 'rush-deck', id: 'rush-deck' }),
    h('div', { class: 'rush-btns' },
      h('button', { class: 'rush-btn scam', id: 'rush-scam', type: 'button', onclick: () => answer('scam') }, '← Scam'),
      h('button', { class: 'rush-btn safe', id: 'rush-safe', type: 'button', onclick: () => answer('safe') }, 'Safe →')));
  showCard();
  R.ticking = true;
  document.addEventListener('keydown', keys);
}

function keys(e) {
  if (!R || !R.ticking) return;
  if (e.key === 'ArrowLeft') answer('scam');
  if (e.key === 'ArrowRight') answer('safe');
}

function showCard() {
  const deck = $('rush-deck');
  const k = R.c.cards[R.i];
  $('rush-count').textContent = `${R.i + 1} / ${R.c.cards.length}`;
  if (!k) return;
  const card = h('div', { class: 'rush-card', id: 'rush-card', tabindex: '0', 'aria-label': `${k.app} from ${k.from}: ${k.text}` },
    h('div', { class: 'rush-app', text: k.app }), h('b', { class: 'rush-from', text: k.from }), h('p', { class: 'rush-text', text: k.text }),
    h('div', { class: 'rush-hint', text: 'Swipe ← scam · safe →' }));
  deck.replaceChildren(card);
  swipe(card);
}

function swipe(card) {
  let x0 = null; let dx = 0;
  card.addEventListener('pointerdown', (e) => { x0 = e.clientX; card.setPointerCapture(e.pointerId); card.classList.add('drag'); });
  card.addEventListener('pointermove', (e) => { if (x0 == null) return; dx = e.clientX - x0; card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; card.dataset.lean = dx < -30 ? 'scam' : dx > 30 ? 'safe' : ''; });
  const up = () => {
    if (x0 == null) return; x0 = null; card.classList.remove('drag');
    const w = card.offsetWidth;
    if (Math.abs(dx) > w * 0.28) answer(dx < 0 ? 'scam' : 'safe');
    else { card.style.transform = ''; card.dataset.lean = ''; }
    dx = 0;
  };
  card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
}

function answer(a) {
  if (!R.ticking) return;
  const k = R.c.cards[R.i]; if (!k) return;
  R.answers[k.id] = a; R.log.push({ t: R.c.seconds - R.left, card: k.id, a });
  const right = a === (k.scam ? 'scam' : 'safe');
  const card = $('rush-card');
  if (card) { card.classList.add(a === 'scam' ? 'fly-left' : 'fly-right'); card.dataset.result = right ? 'right' : 'wrong'; }
  if (right) { sfx.pin(); } else { sfx.bad(); vibrate(80); }
  G.toddy.play(right ? 'happy' : 'worried', { reduce: G.calm() });
  R.i += 1;
  if (R.i >= R.c.cards.length) { setTimeout(end, G.calm() ? 0 : 250); return; }
  setTimeout(showCard, G.calm() ? 0 : 220);
}

function end() {
  if (R.ended) return;
  R.ended = true; R.ticking = false;
  document.removeEventListener('keydown', keys);
  const r = scoreRush(R.c, R.answers, Math.max(0, R.left), null);
  const isNewRule = store.addRule(R.c.id, R.c.golden_rule, R.c.title);
  const d = $('debrief');
  d.className = 'overlay scrim';
  d.replaceChildren(h('div', { class: 'card' },
    h('div', { class: 'who-says', text: 'MILO\'S DEBRIEF' }),
    h('div', { class: 'dsec' }, h('h4', { text: `You sorted ${r.right.length} of ${R.c.cards.length} correctly${R.left <= 0 && Object.keys(R.answers).length < R.c.cards.length ? ' before time ran out' : ''}` }),
      R.c.cards.map((k) => {
        const a = R.answers[k.id]; const ok = a === (k.scam ? 'scam' : 'safe');
        return h('div', { class: `item rush-item ${ok ? 'ok' : 'bad'}`, 'data-card': k.id },
          h('span', { class: 'mark-dot', text: ok ? '✓' : '✗' }),
          h('div', {}, h('b', { text: `${k.from}: ${k.scam ? 'scam' : 'safe'}${a ? '' : ' (no answer)'}` }), h('span', { text: k.why })));
      })),
    h('div', { class: 'rule' }, h('small', { text: isNewRule ? 'New Golden Rule · added to your notebook' : 'Golden Rule' }), R.c.golden_rule),
    h('div', { class: 'row sticky' }, h('button', { class: 'btn', id: 'btn-quick', type: 'button', onclick: () => { sfx.tap(); d.hidden = true; quick(); } }, 'Quick check'))));
  d.hidden = false;
}

function quick() {
  const q = R.c.quick_check;
  const box = h('div', { class: 'choices' }); const after = h('div', {});
  q.options.forEach((o) => box.append(h('button', { class: 'choice', type: 'button', 'data-option': o.id, onclick: (e) => {
    if (R.quickAnswer) return;
    R.quickAnswer = o.id;
    const right = o.id === q.answer; right ? sfx.good() : sfx.bad();
    box.querySelectorAll('.choice').forEach((b) => { if (b.dataset.option === q.answer) b.classList.add('right'); });
    if (!right) e.currentTarget.classList.add('wrong');
    after.replaceChildren(h('p', { class: 'small', text: `${right ? 'Right!' : 'Not quite.'} ${q.explain}` }),
      h('div', { class: 'row' }, h('button', { class: 'btn', id: 'btn-result', type: 'button', onclick: () => {
        sfx.tap(); $('quick').hidden = true;
        const r = scoreRush(R.c, R.answers, Math.max(0, R.left), R.quickAnswer);
        G.done({ case: R.c, score: r, seconds: R.c.seconds - Math.max(0, R.left), log: R.log });
      } }, 'See your result')));
  } }, o.text)));
  const el = $('quick');
  el.className = 'overlay scrim';
  el.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'who-says', text: 'QUICK CHECK' }), h('p', { text: q.q }), box, after));
  el.hidden = false;
}
