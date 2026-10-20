// TODDY: Scam Lab — app shell: title, case files (hub), notebook, settings,
// about, real help, results and sharing. Cases run in play.js and rush.js.
import { h, $, A, fmt } from './ui.js';
import { sfx, setSound, soundOn, wakeMusic } from './audio.js';
import { store } from './store.js';
import { RANKS, rankFor, nextRank, streak } from './engine.js';
import { dailyCase, dayKey, dayNumber } from './daily.js';
import { playCase, tick, useHint, playState } from './play.js';
import { playRush, rushTick, rushState } from './rush.js';
import { Toddy, preloadToddy } from './chars.js';
import { makeCard, shareSheet, GAME_URL } from './share.js';

export const VERSION = '0.6.0';
const TELEGRAM = 'https://t.me/ToddyCoinCommunity';
const PRIVACY = 'https://toddy.meme/privacy.html';
const OVERLAYS = ['page', 'milo', 'lens', 'decide', 'scene', 'debrief', 'quick', 'result', 'sheet'];

let CH = null; const CASES = {}; let SOURCES = {};
const toddy = new Toddy();
const calm = () => store.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const env = { calm, toddy, done: (res) => showResult(res) };

function hideAll() { OVERLAYS.forEach((o) => { $(o).hidden = true; }); $('toddy-say').hidden = true; $('mirage-peek').hidden = true; }
function setBg(name, dim = false) { $('bg').src = A(name); $('stage').classList.toggle('dim', dim); }
function gameLayer(on) { ['hud', 'phone', 'board', 'board-count', 'toddy'].forEach((id) => { $(id).hidden = !on; }); if (!on) { $('board').replaceChildren(); } }
function page(...kids) { hideAll(); const p = $('page'); p.className = 'overlay page'; p.replaceChildren(...kids); p.hidden = false; p.scrollTop = 0; }
function applySettings() {
  setSound(store.settings.sound, store.settings.music !== false);
  const mute = $('btn-mute'); mute.textContent = store.settings.sound ? '🔊' : '🔇'; mute.setAttribute('aria-label', store.settings.sound ? 'Sound on. Tap to mute' : 'Sound off. Tap to unmute');
  $('stage').classList.toggle('calm', calm());
  $('stage').classList.toggle('big', !!store.settings.big);
}
let up = null; // where the phone's Back button goes from the current screen
function setUp(fn) {
  up = fn;
  if (fn && !(history.state && history.state.lab)) history.pushState({ lab: 1 }, '');
}
addEventListener('popstate', () => {
  const sheet = $('sheet');
  if (!sheet.hidden) { sheet.hidden = true; history.pushState({ lab: 1 }, ''); return; }
  for (const o of ['lens', 'decide']) if (!$(o).hidden) { $(o).hidden = true; history.pushState({ lab: 1 }, ''); return; }
  if (!up) return;
  const fn = up; history.pushState({ lab: 1 }, ''); fn();
});
function back(to, label = 'Back') { return h('button', { class: 'chip back-chip', type: 'button', onclick: () => { sfx.tap(); to(); } }, `‹ ${label}`); }

// ---------- title ----------
function title() {
  gameLayer(false); setBg('title_bg'); up = null;
  const challenge = /^#c\d-\d\d$/.test(location.hash) && CASES[location.hash.slice(1)] ? CASES[location.hash.slice(1)] : null;
  page(
    h('div', { class: 'title-wrap' },
      h('h1', { class: 'logo' }, h('span', { text: 'TODDY' }), 'Scam Lab'),
      h('p', { class: 'tagline', text: 'Every case is a real-looking scam. Sniff out the red flags, and don\'t cry wolf at the honest ones.' }),
      challenge ? h('div', { class: 'casecard' }, 'A friend challenged you', h('b', { text: challenge.title })) : null,
      challenge
        ? h('button', { class: 'btn', id: 'btn-challenge', type: 'button', onclick: () => { sfx.tap(); store.howto = true; caseIntro(challenge.id); } }, 'Take the challenge')
        : null,
      h('button', { class: challenge ? 'btn ghost' : 'btn', id: 'btn-start', type: 'button', onclick: () => { sfx.tap(); if (!store.howto) { store.howto = true; firstPlay = true; startCase(ALL()[0]); } else hub(); } }, challenge ? 'Open Scam Lab' : 'Play'),
      h('nav', { class: 'title-nav', 'aria-label': 'More' },
        h('button', { class: 'chip', id: 't-rules', type: 'button', onclick: () => { sfx.tap(); notebook(title); } }, 'Golden Rules'),
        h('button', { class: 'chip', id: 't-howto', type: 'button', onclick: () => { sfx.tap(); howTo(title); } }, 'How to play'),
        h('button', { class: 'chip', id: 't-help', type: 'button', onclick: () => { sfx.tap(); help(title); } }, 'Real help'),
        h('button', { class: 'chip', id: 't-about', type: 'button', onclick: () => { sfx.tap(); about(title); } }, 'About')),
      h('p', { class: 'legal', text: 'A safety game. Every brand, account and link is made up, nothing you do leaves this device, and the game never asks for real details. Education only, not financial advice.' })));
}

// ---------- how to play ----------
function howTo(from = home) {
  setBg('lab_bg', true); setUp(from);
  const first = !store.howto && from === home;
  const step = (img, t, d) => h('div', { class: 'how' }, h('img', { src: A(img), alt: '' }), h('div', {}, h('b', { text: t }), h('p', { text: d })));
  page(h('div', { class: 'pagecard' },
    h('h2', { text: 'How to play' }),
    step('lens', 'Sniff and check', 'A message arrives on Toddy\'s phone. Tap anything odd, or use Toddy\'s kit to check the profile, the link and the official page.'),
    step('pin_red', 'Pin or clear', 'Pin real warning signs as red flags. Clear details that are harmless. Some messages are honest!'),
    step('stamp', 'Decide', 'Block, report, check, ignore or go ahead. Not sure? Choose "investigate more". Then see what happens, and Milo explains.'),
    h('p', { class: 'small', text: 'Stuck? Toddy gives a nudge after a while, or tap Hint (costs 50 points).' }),
    h('div', { class: 'row' }, h('button', { class: 'btn', id: 'btn-howto-ok', type: 'button', onclick: () => { sfx.tap(); if (first) { store.howto = true; caseIntro(ALL()[0]); } else from(); } }, first ? 'Start Case 1' : 'Back'))));
}

// ---------- hub ----------
const MISSION = {
  hunt: ['Red Flag Hunt', 'A message arrives. Tap parts of it to sniff them, pin the red flags, then decide what to do.'],
  rush: ['Inbox Rush', '10 messages, 60 seconds. Swipe left for scam, right for safe.'],
  compare: ['Spot the Fake', 'Two look-alikes side by side. Sniff the details and work out which one is fake.'],
  wallet: ['Wallet Pop-up', 'Your wallet asks you to sign something. Read what it really allows, then approve or reject.'],
  duel: ['Chat Duel', 'Talk back to the scammer. Pick your replies and sniff every message.'],
  boss: ['Boss Case', 'Mirage himself. Collect the clues, then unmask him on the case board.'],
};
const missionOf = (c) => c.mission || MISSION[c.type === 'boss' || c.type === 'duel' || c.type === 'rush' ? c.type : c.screen && MISSION[c.screen.app] ? c.screen.app : c.type];

// ---------- chapters and unlocking ----------
// Chapter 1 teaches the basics, so it comes first. After that, every released chapter is open in any order.
// Inside a chapter, cases go in order.
const OPEN = () => CH.chapters.filter((c) => c.status === 'open' && c.cases.length);
const ALL = () => OPEN().flatMap((c) => c.cases);
function where(id) { for (const ch of OPEN()) { const i = ch.cases.indexOf(id); if (i >= 0) return { ch, i, k: ch.cases.length }; } return null; }
const chDone = (ch) => ch.cases.every((id) => store.played(id));
const chSolved = (ch) => ch.cases.filter((id) => store.played(id)).length;
const chStars = (ch) => ch.cases.reduce((a, id) => a + store.stars(id), 0);
function chapterOpen(ch) { const first = OPEN()[0]; return ch === first || chDone(first); }
function unlocked(id) { const w = where(id); if (!w || !chapterOpen(w.ch)) return false; return w.i === 0 || store.played(w.ch.cases[w.i - 1]); }
const nextIn = (ch) => ch.cases.find((id) => !store.played(id)) || null;
function nextUp() {
  const last = OPEN().find((c) => c.n === store.settings.lastCh);
  if (last && chapterOpen(last) && nextIn(last)) return nextIn(last);
  for (const ch of OPEN()) if (chapterOpen(ch) && nextIn(ch)) return nextIn(ch);
  return null;
}
function dots(ch, current) {
  return h('div', { class: 'dots', 'aria-hidden': 'true' }, ch.cases.map((id, i) => h('i', { class: `${store.played(id) ? 'done' : ''}${i === current ? ' now' : ''}` })));
}
const caseTag = (id) => { const w = where(id); return `Chapter ${w.ch.n} · Case ${w.i + 1} of ${w.k}`; };
function crumbs(...parts) {
  return h('nav', { class: 'crumbs', 'aria-label': 'You are here' }, parts.map((p, i) => [
    i ? h('span', { class: 'sep', 'aria-hidden': 'true', text: '›' }) : null,
    p.go ? h('button', { class: 'crumb', type: 'button', onclick: () => { sfx.tap(); p.go(); } }, p.label) : h('span', { class: 'crumb here', text: p.label }),
  ]));
}
const HOME = { label: 'Scam Lab', go: () => home() };

// ---------- SCAM LAB HOME: chapter cards ----------
function home() {
  gameLayer(false); setBg('lab_bg', true); setUp(title);
  location.hash.length > 1 && history.replaceState(history.state, '', location.pathname + location.search);
  const total = store.totalStars(); const rank = rankFor(total); const nxt = nextRank(total);
  const key = dayKey(); const today = store.daily(key);
  const st = streak(store.dailyKeys().map(dayNumber), dayNumber(key));
  const first = ALL()[0];
  const up = nextUp(); const w = up ? where(up) : null;
  const solvedAll = ALL().filter((id) => store.played(id)).length;
  page(
    h('div', { class: 'hub' },
      h('div', { class: 'hub-head' },
        h('img', { class: 'rank-badge', src: A(`rank_${rank.id}`), alt: '' }),
        h('div', {}, h('div', { class: 'eyebrow', text: 'YOUR DETECTIVE RANK' }), h('b', { class: 'rank-name', text: rank.name }),
          h('div', { class: 'small-ink', text: `★ ${total} · ${solvedAll} of ${ALL().length} cases solved${nxt ? ` · ${nxt.stars - total}★ to ${nxt.name}` : ''}` })),
        h('button', { class: 'chip', type: 'button', id: 'btn-settings', 'aria-label': 'Settings', onclick: () => { sfx.tap(); settings(); } }, '⚙')),

      up
        ? h('button', { class: 'continue', id: 'btn-continue-case', type: 'button', onclick: () => { sfx.tap(); caseIntro(up); } },
            h('span', { class: 'eyebrow', text: store.played(first) ? 'CONTINUE' : 'START HERE' }),
            h('b', { text: CASES[up].title }),
            h('span', { class: 'small-ink', text: `Chapter ${w.ch.n} · ${w.ch.title} · Case ${w.i + 1} of ${w.k}` }),
            h('span', { class: 'play-pill', text: '▶ Play' }))
        : h('div', { class: 'continue done' },
            h('span', { class: 'eyebrow', text: 'ALL 48 CASES SOLVED' }),
            h('b', { text: `Every case cracked, ${rankFor(store.totalStars()).name}!` }),
            h('span', { class: 'small-ink', text: 'Replay cases for 3 stars, or keep your Daily Quickie streak going.' })),

      h('h2', { class: 'section-h', text: 'Chapters' }),
      h('p', { class: 'small-ink section-sub', text: 'Ordered by how many people each kind of scam hurts. Chapter 1 first, then any order.' }),
      h('div', { class: 'ch-grid' }, CH.chapters.map((ch) => {
        const released = ch.status === 'open' && ch.cases.length;
        const open = released && chapterOpen(ch);
        const done = released && chDone(ch);
        const state = !released ? 'soon' : !open ? 'locked' : done ? 'done' : chSolved(ch) ? 'going' : 'new';
        const label = { soon: 'Coming soon', locked: '🔒 After Chapter 1', done: `✓ Solved · ★ ${chStars(ch)}/${ch.cases.length * 3}`, going: `${chSolved(ch)} of ${ch.cases.length} solved`, new: `${ch.cases.length} cases` }[state];
        return h('button', { class: `ch-card ${state}`, type: 'button', 'data-chapter': String(ch.n), disabled: !open, onclick: () => { sfx.tap(); chapterPage(ch); } },
          h('img', { src: A(ch.card), alt: '', loading: 'lazy', class: ch.focus ? `focus-${ch.focus}` : null }),
          h('span', { class: 'ch-n', text: String(ch.n) }),
          h('span', { class: 'ch-body' },
            h('b', { text: ch.title }),
            open ? h('span', { class: 'ch-bar' }, h('i', { style: null, 'data-w': String(chSolved(ch) / ch.cases.length) })) : null,
            h('span', { class: 'ch-state', text: label })));
      })),

      h('button', { class: `daily${today ? ' done' : ''}`, id: 'btn-daily', type: 'button', disabled: !store.played(first), onclick: () => { sfx.tap(); caseIntro('daily'); } },
        h('div', { class: 'eyebrow', text: 'BONUS · DAILY QUICKIE' }),
        h('b', { text: !store.played(first) ? 'Unlocks after your first case' : today ? `Done today · ${today.score} / 1000` : 'A new 90-second case every day' }),
        h('span', { class: 'small-ink', text: `${st ? `🔥 ${st}-day streak · ` : ''}Same case for everyone${today ? ' · replay for practice' : ''}` })),
      h('nav', { class: 'hub-nav' },
        h('button', { class: 'chip', id: 'btn-notebook', type: 'button', onclick: () => { sfx.tap(); notebook(); } }, '📒 Golden Rules'),
        h('button', { class: 'chip', id: 'btn-howto', type: 'button', onclick: () => { sfx.tap(); howTo(); } }, 'How to play'),
        h('button', { class: 'chip', id: 'btn-help', type: 'button', onclick: () => { sfx.tap(); help(); } }, '🆘 Real help'),
        h('button', { class: 'chip', id: 'btn-about', type: 'button', onclick: () => { sfx.tap(); about(); } }, 'About'))));
  // progress bars are sized by CSS custom property (no inline styles under the strict CSP)
  document.querySelectorAll('.ch-bar i').forEach((i) => i.style.setProperty('--w', i.dataset.w));
}
const hub = home;

// ---------- CHAPTER PAGE: its cases in order ----------
function chapterPage(ch) {
  gameLayer(false); setBg('lab_bg', true); setUp(home);
  store.set('lastCh', ch.n);
  const up = nextIn(ch);
  page(
    h('div', { class: 'chapter-page' },
      crumbs(HOME, { label: `Chapter ${ch.n}` }),
      h('div', { class: 'ch-hero' },
        h('img', { src: A(ch.card), alt: '', class: ch.focus ? `focus-${ch.focus}` : null }),
        h('div', { class: 'ch-hero-text' },
          h('span', { class: 'eyebrow', text: `CHAPTER ${ch.n} · ${chSolved(ch)} OF ${ch.cases.length} SOLVED · ★ ${chStars(ch)}/${ch.cases.length * 3}` }),
          h('h2', { text: ch.title }),
          h('p', { text: ch.blurb }),
          dots(ch, up ? ch.cases.indexOf(up) : -1))),
      ch.learn ? h('div', { class: 'learn' }, h('b', { text: 'In this chapter you\'ll learn to spot:' }), h('p', { text: ch.learn })) : null,
      h('ol', { class: 'cases big' }, ch.cases.map((id, i) => {
        const c = CASES[id]; const open = unlocked(id); const done = store.played(id); const s = store.stars(id);
        const state = done ? 'done' : id === up ? 'next' : 'locked';
        return h('li', {}, h('button', { class: `case-row ${state}`, type: 'button', 'data-case': id, disabled: !open, onclick: () => { sfx.tap(); caseIntro(id); } },
          h('span', { class: 'case-n', text: done ? '✓' : c.type === 'boss' ? '★' : String(i + 1) }),
          h('span', { class: 'case-t' }, h('b', { text: `Case ${i + 1} · ${c.title}` }), h('span', { text: missionOf(c)[0] })),
          h('span', { class: 'case-s', 'aria-label': done ? `${s} of 3 stars` : state === 'next' ? 'Play next' : 'Locked',
            text: done ? '★'.repeat(s) + '☆'.repeat(3 - s) : state === 'next' ? 'Play' : '🔒' })));
      })),
      h('div', { class: 'row center' }, h('button', { class: 'btn ghost', id: 'btn-back-home', type: 'button', onclick: () => { sfx.tap(); home(); } }, '‹ All chapters'))));
}

// ---------- case card before every case ----------
function caseIntro(id) {
  const daily = id === 'daily';
  const c = daily ? dailyCase(dayKey()) : CASES[id];
  const w = daily ? null : where(id);
  if (w) store.set('lastCh', w.ch.n);
  setUp(w ? () => chapterPage(w.ch) : home);
  const [mName, mHow] = daily ? ['90-second challenge', 'One message, 90 seconds, no hints. Sniff it, pin the red flags, then decide. It might be honest!'] : missionOf(c);
  setBg(daily ? 'lab_bg' : w.ch.card, true); gameLayer(false);
  page(h('div', { class: 'intro-card' },
    daily ? crumbs(HOME, { label: 'Daily Quickie' }) : crumbs(HOME, { label: `Ch ${w.ch.n} · ${w.ch.title}`, go: () => chapterPage(w.ch) }, { label: `Case ${w.i + 1}` }),
    h('div', { class: 'eyebrow', text: daily ? 'BONUS' : `CHAPTER ${w.ch.n} · CASE ${w.i + 1} OF ${w.k}` }),
    daily ? null : dots(w.ch, w.i),
    h('h2', { text: daily ? 'Daily Quickie' : c.title }),
    h('div', { class: 'mission' }, h('b', { text: mName }), h('p', { text: mHow })),
    !daily && store.played(id) ? h('p', { class: 'small-ink', text: `Your best: ${'★'.repeat(store.stars(id))}${'☆'.repeat(3 - store.stars(id))} · ${store.best(id)} / 1000` }) : null,
    h('button', { class: 'btn big', id: 'btn-go', type: 'button', onclick: () => { sfx.tap(); daily ? startDaily() : startCase(id); } }, daily || !store.played(id) ? 'Start case' : 'Play again')));
}

let current = null;
let firstPlay = false; // true only for the very first tap on Play: Case 1 starts at once with no intro
function startCase(id) {
  env.firstPlay = firstPlay; firstPlay = false;
  hideAll(); setBg('lab_bg'); gameLayer(true); $('hud').hidden = true; $('phone').hidden = true;
  current = id; setUp(quitCase);
  const c = CASES[id];
  if (c.type === 'rush') playRush(c, env); else playCase(c, env);
}
function startDaily() {
  env.firstPlay = false;
  hideAll(); setBg('lab_bg'); gameLayer(true); $('hud').hidden = true; $('phone').hidden = true;
  current = null; setUp(quitCase);
  const c = dailyCase(dayKey()); c.label = 'Daily Quickie';
  if (window.ToddySeason) window.ToddySeason.start('scam-lab');   // signed-in players only; guests send nothing
  playCase(c, env);
}
function quitCase() { const s = playState(); if (s) s.ended = true; const r = rushState(); if (r) { r.ticking = false; r.ended = true; } leaveCase(); }
function leaveCase() { const w = current ? where(current) : null; w ? chapterPage(w.ch) : home(); }

// ---------- result ----------
async function showResult({ case: c, score: r, seconds }) {
  hideAll();
  const rankBefore = rankFor(store.totalStars());
  let streakLine = null;
  const ps = playState();
  const seasonRes = c.daily && window.ToddySeason && ps ? window.ToddySeason.finish('scam-lab', { marks: ps.marks, decision: ps.decision || null, seconds: ps.seconds, score: r.total }) : null;
  const w = c.daily ? null : where(c.id);
  const wasOpen = OPEN().filter(chapterOpen).length;
  if (c.daily) {
    const key = c.id.replace('daily-', '');
    const first = store.recordDaily(key, r.total, r.stars);
    store.addRule(`daily-${c.template}`, c.golden_rule, 'Daily Quickie');
    const st = streak(store.dailyKeys().map(dayNumber), dayNumber(key));
    streakLine = first ? `🔥 ${st}-day streak · come back tomorrow for a new case` : 'Practice run: today\'s score was already saved.';
  } else store.record(c.id, r.stars, r.total);
  const nextInCh = w ? nextIn(w.ch) && w.ch.cases.slice(w.i + 1).find((id) => !store.played(id)) || nextIn(w.ch) : null;
  const chJustDone = w && chDone(w.ch) && w.i === w.k - 1;
  const opened = OPEN().filter(chapterOpen).length > wasOpen;
  const up = nextUp();
  const row = (a, b) => h('tr', {}, h('td', { text: a }), h('td', { text: b }));
  const rows = c.type === 'rush'
    ? [row(`Sorted right (${r.right.length}/${c.cards.length})`, r.accuracy), row('Time left bonus', r.speed), row('Quick check', r.quick)]
    : [row(`Evidence (${r.found.length} found${r.falseAlarms.length ? `, ${r.falseAlarms.length} false alarm${r.falseAlarms.length > 1 ? 's' : ''}` : ''})`, r.evidence),
        row('Decision', r.decision), c.daily ? null : row(c.board ? 'Case board' : 'Quick check', r.quick), row(`Speed (${fmt(seconds)})`, r.speed), r.hintCost ? row('Hints', `−${r.hintCost}`) : null];
  const lines = ['Mirage got away this time. Try again and catch him.', 'You stayed safe. Find every flag to catch Mirage.', 'Great sniffing. One step from a perfect case.', 'Case closed! Mirage is caught red-handed.'];
  const total = store.totalStars(); const rank = rankFor(total);
  const rankUp = rank.id > rankBefore.id;
  setUp(w ? () => chapterPage(w.ch) : home);
  let primary;
  if (c.daily) primary = h('button', { class: 'btn big', id: 'btn-hub', type: 'button', onclick: () => { sfx.tap(); home(); } }, 'Back to Scam Lab');
  else if (nextInCh && !chJustDone) primary = h('button', { class: 'btn big', id: 'btn-next', type: 'button', onclick: () => { sfx.tap(); caseIntro(nextInCh); } }, `Next: Case ${where(nextInCh).i + 1} · ${CASES[nextInCh].title}`);
  else if (up) { const nw = where(up); primary = h('button', { class: 'btn big', id: 'btn-next', type: 'button', onclick: () => { sfx.tap(); opened ? home() : caseIntro(up); } }, opened ? 'New chapters unlocked · Choose one' : `Next: Chapter ${nw.ch.n} · ${nw.ch.title}`); }
  else primary = h('button', { class: 'btn big', id: 'btn-hub', type: 'button', onclick: () => { sfx.tap(); home(); } }, 'Every case solved · Back to Scam Lab');
  const el = $('result');
  el.className = 'overlay scrim result';
  el.replaceChildren(...[
    h('div', { class: 'eyebrow', text: c.daily ? 'DAILY QUICKIE' : `${caseTag(c.id).toUpperCase()} · ${c.title.toUpperCase()}` }),
    c.daily ? null : dots(w.ch, -1),
    // 3 stars: Mirage caught, with Toddy celebrating beside him. 1-2 stars: Toddy cheering. 0 stars: Mirage smug.
    h('div', { class: 'hero-wrap' },
      h('img', { class: 'hero-img', src: A(r.stars >= 3 ? 'mirage_caught' : r.stars >= 1 ? 'tj_cheer_v01' : 'mirage_smug'), alt: '' }),
      r.stars >= 3 ? h('img', { class: 'res-toddy', src: A('tj_celebrate_v01'), alt: '' }) : null),
    h('div', { class: 'stars', 'aria-label': `${r.stars} of 3 stars` }, [0, 1, 2].map((i) => h('span', { class: i < r.stars ? '' : 'off', text: '★' }))),
    h('p', { class: 'tagline', text: chJustDone ? `Chapter ${w.ch.n} solved: ${w.ch.title}!${opened ? ' Every other chapter is now open.' : ''}` : lines[r.stars] }),
    h('div', { class: 'total', id: 'total' }, String(r.total), h('small', { text: ' / 1000' })),
    h('table', { class: 'breakdown' }, h('tbody', {}, rows)),
    rankUp ? h('div', { class: 'rankup' }, h('img', { src: A(`rank_${rank.id}`), alt: '' }), h('div', {}, h('small', { text: 'NEW RANK' }), h('b', { text: rank.name }))) : null,
    h('p', { class: 'small-ink', text: streakLine || `Rank: ${rank.name} · ★ ${total}` }),
    c.daily ? h('p', { class: 'small-ink', id: 'seasonline', hidden: true }) : null,
    primary,
    h('div', { class: 'row center minor' },
      c.daily ? null : h('button', { class: 'linkbtn', id: 'btn-again', type: 'button', onclick: () => { sfx.tap(); startCase(c.id); } }, '↻ Replay'),
      h('button', { class: 'linkbtn', id: 'btn-share', type: 'button', onclick: () => share(c, r, seconds) }, '↗ Share'),
      c.daily ? null : h('button', { class: 'linkbtn', id: 'btn-challenge-friend', type: 'button', onclick: () => challenge(c) }, '⚔ Challenge a friend'),
      c.daily ? null : h('button', { class: 'linkbtn', id: 'btn-files', type: 'button', onclick: () => { sfx.tap(); chapterPage(w.ch); } }, `☰ Chapter ${w.ch.n}`),
      h('button', { class: 'linkbtn', id: 'btn-home', type: 'button', onclick: () => { sfx.tap(); home(); } }, '⌂ Scam Lab')),
  ].filter(Boolean)); // replaceChildren turns a null into the text "null"
  el.hidden = false;
  if (seasonRes) seasonRes.then((res) => { const line = $('seasonline'); if (!line) return; if (res && res.guest) window.ToddySeason.guestHint(line); else window.ToddySeason.show(line, res); });
  if (r.stars >= 1 || rankUp) sfx.good();
}

async function share(c, r, seconds) {
  sfx.tap();
  const w = c.daily ? null : where(c.id);
  const big = c.daily ? `Daily Quickie: ${r.total} / 1000` : c.type === 'rush' ? `Sorted ${r.right.length}/${c.cards.length} in ${fmt(seconds)}` : r.stars >= 3 ? `I caught Mirage in ${fmt(seconds)}` : `${r.total} / 1000 on "${c.title}"`;
  // one witty, spoiler-free line: skill only, never about money
  const witty = r.stars >= 3 ? (w ? `Mirage tried "${w.ch.title}". Toddy wasn't buying it.` : 'Mirage tried a quickie. Toddy wasn\'t buying it.')
    : r.stars === 2 ? 'Nearly flawless. Mirage is sweating.' : r.stars === 1 ? 'Stayed safe, but Mirage slipped away. Rematch?' : 'Mirage won this round. Toddy wants a rematch.';
  const small = c.type === 'rush' ? `${witty} Can you spot the scams faster?` : witty;
  const tag = c.daily ? 'Daily Quickie' : `Chapter ${w.ch.n} · ${w.ch.title}`;
  const canvas = await makeCard({ big, small, stars: r.stars, badge: `rank_${rankFor(store.totalStars()).id}`, tag });
  shareSheet($('sheet'), { canvas, text: `🔍 ${big} in TODDY Scam Lab. ${witty}`, url: GAME_URL });
}
async function challenge(c) {
  sfx.tap();
  const canvas = await makeCard({ big: `Can you crack "${c.title}"?`, small: 'A friend thinks you can\'t spot the scam.', stars: 0 });
  shareSheet($('sheet'), { canvas, text: `🔍 I dare you to solve "${c.title}" in TODDY Scam Lab.`, url: `${GAME_URL}#${c.id}` });
}

// ---------- notebook ----------
function notebook(from = home) {
  setBg('lab_bg', true); setUp(from);
  const rules = store.rules();
  page(h('div', { class: 'pagecard' },
    back(from, from === home ? 'Scam Lab' : 'Back'),
    h('h2', { text: 'Golden Rules' }),
    h('p', { class: 'small', text: rules.length ? `${rules.length} rule${rules.length > 1 ? 's' : ''} collected. Your pocket safety guide.` : 'Finish a case to collect your first Golden Rule.' }),
    // grouped by chapter, in chapter order, then Daily Quickie rules
    [...CH.chapters.map((ch) => [`Chapter ${ch.n} · ${ch.title}`, rules.filter((r) => r.id && r.id.startsWith(`c${ch.n}-`))]),
      ['Daily Quickie', rules.filter((r) => !/^c\d-/.test(r.id || ''))]]
      .filter(([, list]) => list.length)
      .map(([head, list]) => h('section', { class: 'rule-group' }, h('h3', { text: head }),
        h('div', { class: 'rules' }, list.map((r) => h('div', { class: 'rule-card' }, h('small', { text: r.from || '' }), h('p', { text: r.text })))))),
    rules.length ? h('div', { class: 'row' }, h('button', { class: 'btn', id: 'btn-save-rules', type: 'button', onclick: () => saveRules(rules) }, 'Save as a picture')) : null));
}
async function saveRules(rules) {
  sfx.tap();
  const W = 1080; const pad = 60; const lh = 40;
  const cv = document.createElement('canvas'); const g = cv.getContext('2d');
  g.font = '32px Georgia, serif';
  const lines = [];
  for (const r of rules) {
    const words = r.text.split(' '); let line = '';
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > W - pad * 2 - 50 && line) { lines.push([line, false]); line = w; } else line = t; }
    lines.push([line, true]);
  }
  cv.width = W; cv.height = 220 + lines.length * lh + rules.length * 24 + 90;
  g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, W, cv.height);
  g.fillStyle = '#a65d0e'; g.font = '700 54px Georgia, serif'; g.fillText('My Golden Rules', pad, 110);
  g.fillStyle = '#6f5a47'; g.font = '28px system-ui, sans-serif'; g.fillText('TODDY Scam Lab · pocket safety guide', pad, 158);
  let y = 230; g.fillStyle = '#2a1a10'; g.font = '32px Georgia, serif'; let n = 1; let start = true;
  for (const [t, end] of lines) {
    if (start) { g.fillStyle = '#d93a3a'; g.fillText(`${n}.`, pad, y); g.fillStyle = '#2a1a10'; n += 1; }
    g.fillText(t, pad + 50, y); y += lh; start = end; if (end) y += 24;
  }
  g.fillStyle = '#a65d0e'; g.font = '700 26px system-ui, sans-serif'; g.fillText('toddy.meme/games/scam-lab', pad, cv.height - 40);
  shareSheet($('sheet'), { canvas: cv, text: '📒 My Golden Rules from TODDY Scam Lab.', url: GAME_URL });
}

// ---------- settings ----------
function settings() {
  setBg('lab_bg', true); setUp(home);
  const tog = (id, label, key, after) => h('button', { class: 'toggle', id, type: 'button', role: 'switch', 'aria-checked': String(!!store.settings[key]), onclick: (e) => {
    store.set(key, !store.settings[key]); e.currentTarget.setAttribute('aria-checked', String(store.settings[key])); applySettings(); after && after(); sfx.tap();
  } }, h('span', { text: label }), h('i'));
  const confirmBox = h('div', { class: 'confirm', hidden: true },
    h('p', { text: 'Erase all stars, scores, streaks and Golden Rules on this device?' }),
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { confirmBox.hidden = true; } }, 'Keep them'),
      h('button', { class: 'btn danger', id: 'btn-reset-yes', type: 'button', onclick: () => { store.reset(); hub(); } }, 'Erase')));
  page(h('div', { class: 'pagecard' },
    back(hub, 'Scam Lab'),
    h('h2', { text: 'Settings' }),
    tog('set-sound', 'Sound', 'sound'),
    tog('set-music', 'Background music', 'music'),
    tog('set-calm', 'Calmer motion', 'calm'),
    tog('set-big', 'Bigger text', 'big'),
    h('p', { class: 'small', text: 'Settings and progress are saved on this device only.' }),
    h('button', { class: 'btn ghost', id: 'btn-reset', type: 'button', onclick: () => { confirmBox.hidden = false; } }, 'Reset progress'),
    confirmBox));
}

// ---------- about + real help ----------
function about(from = home) {
  setBg('lab_bg', true); setUp(from);
  const src = [...new Map(Object.values(SOURCES).filter((s) => s.checked_on).map((s) => [s.url, s])).values()];
  page(h('div', { class: 'pagecard' },
    back(from, from === home ? 'Scam Lab' : 'Back'),
    h('h2', { text: 'About Scam Lab' }),
    h('p', { text: 'A cosy detective game from the TODDY café. Every case, brand and name is made up. Any match with a real company is by chance. The game never asks for, saves or sends any real details.' }),
    h('h3', { text: 'Privacy' }),
    h('p', { text: 'Your stars, scores and settings are saved in this browser only. Nothing you tap or type leaves your device.' }),
    h('h3', { text: 'Where the lessons come from' }),
    h('ul', { class: 'srcs' }, src.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }), ` · checked ${s.checked_on}`))),
    h('p', { class: 'small', text: 'Education only, not financial advice. Spotted a mistake in a case? Tell us below.' }),
    h('div', { class: 'linkrow' },
      h('a', { class: 'btn dark', href: TELEGRAM, target: '_blank', rel: 'noopener noreferrer' }, 'Report a bug or mistake'),
      h('a', { class: 'btn dark', href: PRIVACY, target: '_blank', rel: 'noopener noreferrer' }, 'Privacy policy')),
    h('h3', { text: 'Credits' }),
    h('p', { class: 'small', text: 'Made by the TODDY team. Characters: Toddy, Milo and Mirage. Game design, code and cases written with Claude.' }),
    h('p', { class: 'small', text: `Version ${VERSION}` })));
}

function help(from = home) {
  setBg('lab_bg', true); setUp(from);
  page(h('div', { class: 'pagecard' },
    back(from, from === home ? 'Scam Lab' : 'Back'),
    h('h2', { text: 'If it happened to you for real' }),
    h('p', { text: 'Scammers fool smart people every day. It isn\'t your fault, and acting quickly helps.' }),
    h('ol', { class: 'steps' },
      h('li', { text: 'Stop. Don\'t send anything more, and stop replying to them.' }),
      h('li', { text: 'If they had your recovery phrase, make a new wallet on a safe device and move what\'s left there.' }),
      h('li', { text: 'Change passwords and turn on two-step login for the accounts involved.' }),
      h('li', { text: 'Never pay anyone who promises to get your money back. That\'s a second scam.' }),
      h('li', { text: 'Report it, and tell someone you trust.' })),
    h('h3', { text: 'In Europe' }),
    h('p', {}, 'Report it to the police in your country. Europol lists the official reporting site for every EU country: ', h('a', { href: 'https://www.europol.europa.eu/report-a-crime/report-cybercrime-online', target: '_blank', rel: 'noopener noreferrer', text: 'europol.europa.eu' }), '. If there is no online option, go to your local police station.'),
    h('h3', { text: 'Everywhere else' }),
    h('p', { text: 'Contact your local police and your country\'s consumer-protection or fraud-reporting service. Also report the account in the app where it contacted you.' }),
    h('p', { class: 'small', text: 'Checked 13 October 2026. Contact details can change; check the official sites.' })));
}

// ---------- boot ----------
async function boot() {
  $('build').textContent = `Beta ${VERSION}`;
  $('toddy').prepend(toddy.el);
  $('btn-hint').addEventListener('click', useHint);
  $('btn-mute').addEventListener('click', () => { store.set('sound', !store.settings.sound); applySettings(); sfx.tap(); });
  $('btn-quit').addEventListener('click', () => { sfx.tap(); quitCase(); });
  applySettings();
  page(h('div', { class: 'loading', role: 'status' }, h('div', { class: 'spinner', 'aria-hidden': 'true' }), 'Opening the case files…'));
  const get = (f) => fetch(`cases/${f}`).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); });
  try {
    CH = await get('chapters.json'); SOURCES = await get('sources.json');
    await Promise.all(CH.chapters.flatMap((ch) => ch.cases.map(async (id, i, all) => { CASES[id] = await get(`${id}.json`); CASES[id].label = `Ch ${ch.n} · Case ${i + 1} of ${all.length}`; })));
  } catch (e) {
    page(h('div', { class: 'pagecard' }, h('h2', { text: 'The case files didn\'t load' }),
      h('p', { text: 'Check your connection and try again. Your progress is safe on this device.' }),
      h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Try again')));
    return;
  }
  setInterval(() => { tick(); rushTick(); }, 1000);
  title();
  setTimeout(preloadToddy, 1500); // Toddy's animations load in the background after the title shows
  // Season page button: /games/scam-lab/?play=daily opens tonight's Daily Quickie (it unlocks after the first case, so new players land on the case files).
  if (/[?&]play=daily\b/.test(location.search)) {
    history.replaceState(history.state, '', location.pathname + location.search.replace(/([?&])play=daily&?/, '$1').replace(/[?&]$/, '') + location.hash);
    if (store.played(ALL()[0])) caseIntro('daily'); else home();
  }
  if (/[?&]qa\b/.test(location.search)) window.__lab = { caseIntro, chapterPage: (n) => chapterPage(CH.chapters.find((c) => c.n === n)), CASES, store, playState, rushState, dailyCase, dayKey, setCalm: (v) => { store.set('calm', v); applySettings(); } };
}
boot();
