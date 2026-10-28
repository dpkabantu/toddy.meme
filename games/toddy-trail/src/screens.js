// TODDY Trail screens: Home, Nights, Levels, Night intro, Result, Pause, Settings, Daily Run, How to play, About.
// Every screen except Home has a clear Back button to the page before it. This file only builds menus; it never touches the game rules.
import { PER_NIGHT, STORY_NIGHTS, nightName, nightTell, nightOf, posInNight, levelOf, isBoss } from './levels.js';
import * as P from './progress.js';

export const BUILD = 'Test build · 28 Oct 2026';
const SPEEDS = ['Relaxed', 'Normal', 'Quick'], FLOORS = ['random', 'painted', 'plain'], WEATHERS = ['full', 'calm', 'off'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const starText = (n, of = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n));

function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== '') e.textContent = text; return e; }

// g: { overlay, begin(L, daily|null), resume(), restart(), apply(), fs: { can(), on(), toggle() }, exit(), click() }
export function createScreens(g) {
  const o = g.overlay;
  const open = (card) => { o.textContent = ''; o.hidden = false; o.append(card); const c = card.querySelector('.btn'); if (c && c.focus) { try { c.focus({ preventScroll: true }); } catch (_) { /* optional */ } } };
  const btn = (text, fn, alt) => { const b = mk('button', 'btn' + (alt ? ' alt' : ''), text); b.type = 'button'; b.addEventListener('click', () => { g.click(); fn(); }); return b; };
  const back = (text, fn) => { const b = btn('‹ ' + text, fn, true); b.classList.add('back'); return b; };
  const S = {};

  S.home = () => {
    g.menuMusic();
    const card = mk('div', 'card'), nx = P.nextLevel(), stars = P.totalStars(), sk = P.currentStreak();
    card.append(mk('h1', '', 'TODDY Trail'), mk('p', 'sub', 'Serve every drink before the lanterns go out.'));
    card.append(mk('p', 'chips', '★ ' + stars + (sk ? '   ·   Daily streak ' + sk : '')));
    const night = nightOf(nx);
    card.append(btn((P.highestCleared() === 0 ? 'Play' : 'Continue') + ' · Night ' + night + ' · Level ' + posInNight(nx), () => g.begin(nx, null)));
    card.append(btn('Nights & levels', S.nights, true), btn('Daily Run' + (P.todaysDaily().state.done.every(Boolean) ? '  ✓' : ''), S.daily, true), btn('How to play', () => S.how(S.home), true), btn('Settings', () => S.settings(S.home), true), btn('About', () => S.about(S.home), true), btn('Exit to Games', g.exit, true));
    open(card);
  };

  S.nights = () => {
    const card = mk('div', 'card'), unlocked = P.nightsUnlocked();
    card.append(mk('h1', '', 'Nights'), mk('p', 'sub', '10 levels in every night. The last one is a boss.'));
    for (let n = 1; n <= STORY_NIGHTS; n++) {
      const ok = n <= unlocked || P.settings().unlockAll, b = btn((ok ? '' : '🔒 ') + 'Night ' + n + ' · ' + nightName(n) + '   ★ ' + P.nightStars(n) + '/' + PER_NIGHT * 3, () => S.levels(n), true);
      if (!ok) { b.disabled = true; b.classList.add('locked'); } card.append(b);
    }
    const eok = 8 <= unlocked || P.settings().unlockAll, e = btn((eok ? '' : '🔒 ') + 'Endless Nights · Night 8 and on', () => S.levels(Math.max(8, unlocked)), true);
    if (!eok) { e.disabled = true; e.classList.add('locked'); } card.append(e, back('Home', S.home)); open(card);
  };

  S.levels = (n) => {
    const card = mk('div', 'card'), unlocked = P.nightsUnlocked(), anyOpen = P.settings().unlockAll;
    card.append(mk('h1', '', 'Night ' + n), mk('p', 'sub', nightName(n) + '   ★ ' + P.nightStars(n) + '/' + PER_NIGHT * 3));
    const grid = mk('div', 'lvgrid');
    for (let p = 1; p <= PER_NIGHT; p++) {
      const L = levelOf(n, p), ok = P.isUnlocked(L), b = mk('button', 'lv' + (ok ? '' : ' locked') + (isBoss(L) ? ' boss' : ''));
      b.type = 'button'; b.append(mk('span', 'num', ok ? String(p) : '🔒'), mk('span', 'st', ok ? starText(P.starsOf(L)) : ''));
      if (isBoss(L)) b.append(mk('span', 'tag', 'Boss'));
      b.setAttribute('aria-label', 'Night ' + n + ' level ' + p + (ok ? ', ' + P.starsOf(L) + ' stars' : ', locked'));
      if (ok) b.addEventListener('click', () => { g.click(); g.begin(L, null); }); else b.disabled = true; grid.append(b);
    }
    card.append(grid);
    const row = mk('div', 'row2'), next = btn('Night ' + (n + 1) + ' ›', () => S.levels(n + 1), true);
    if (n + 1 > unlocked && !anyOpen) next.disabled = true;
    row.append(n > 1 ? btn('‹ Night ' + (n - 1), () => S.levels(n - 1), true) : mk('span'), next);
    card.append(row, back('Nights', S.nights)); open(card);
  };

  S.intro = (L, daily) => {   // the picture story before the first level of a night
    const n = nightOf(L), card = mk('div', 'card'), v = document.createElement('video');
    if (n <= STORY_NIGHTS) { v.src = 'assets/trail_intro_n' + n + '_v01.mp4'; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.className = 'intro'; card.append(v); }
    card.append(mk('h1', '', 'Night ' + n + ' · ' + nightName(n)), mk('p', '', nightTell(n)));
    card.append(btn('Start', () => { P.markIntro(n); g.start(L, daily); }), back('Levels', () => S.levels(n))); open(card);
    if (n <= STORY_NIGHTS) { const pl = v.play(); if (pl && pl.catch) pl.catch(() => {}); }
  };

  // info: { L, daily (index or null), stars, score, served, of, seconds, spills, rec: { newBest, first }, dailyDone }
  S.result = (info) => {
    const card = mk('div', 'card'), n = nightOf(info.L);
    card.append(mk('h1', '', info.stars === 3 ? 'Perfect!' : info.stars === 2 ? 'All served!' : info.stars === 1 ? 'Level cleared' : 'Lanterns out'));
    const bs = mk('div', 'bigstars'); for (let i = 0; i < 3; i++) bs.append(mk('span', i < info.stars ? 'on' : 'off', '★')); bs.setAttribute('aria-label', info.stars + ' of 3 stars');
    card.append(bs, mk('div', 'big', String(info.score)));
    card.append(mk('p', '', 'Served ' + info.served + ' of ' + info.of + ' · ' + info.seconds + ' s · cups lost ' + info.spills));
    if (info.rec && info.rec.newBest && info.stars > 0) card.append(mk('p', 'good', 'New best!'));
    if (info.stars === 0) card.append(mk('p', '', 'Serve at least ' + Math.ceil(info.of * 0.6) + ' for the first star.'));
    if (info.dailyDone) card.append(mk('p', 'good', 'Daily Run complete · streak ' + P.currentStreak()));
    if (info.daily !== null) {
      const nx = info.daily + 1, plan = P.todaysDaily().plan;
      if (info.stars > 0 && nx < 3) card.append(btn('Daily level ' + (nx + 1), () => g.begin(plan.levels[nx], nx)));
      card.append(btn('Retry', () => g.restart(), info.stars > 0 && nx < 3), back('Daily Run', S.daily));
    } else {
      if (info.stars > 0) card.append(btn('Next level · Night ' + nightOf(info.L + 1) + ' · ' + posInNight(info.L + 1), () => g.begin(info.L + 1, null)));
      card.append(btn('Retry', () => g.restart(), info.stars > 0), back('Night ' + n + ' levels', () => S.levels(n)));
    }
    card.append(btn('Home', S.home, true)); open(card);
  };

  S.pause = (info) => {
    const card = mk('div', 'card');
    card.append(mk('h1', '', 'Paused'), mk('p', 'sub', info.title));
    card.append(btn('Resume', () => g.resume()), btn('Restart level', () => g.restart(), true), btn('Settings', () => S.settings(() => S.pause(info)), true), btn('How to play', () => S.how(() => S.pause(info)), true));
    card.append(btn(info.daily !== null ? 'Leave to Daily Run' : 'Leave to levels', () => { g.leave(); info.daily !== null ? S.daily() : S.levels(nightOf(info.L)); }, true), btn('Home', () => { g.leave(); S.home(); }, true)); open(card);
  };

  S.settings = (backFn) => {
    const card = mk('div', 'card'), set = P.settings();
    card.append(mk('h1', '', 'Settings'));
    const toggle = (label, get, set1, fmt) => { const b = btn(label + ': ' + fmt(get()), () => { set1(); b.textContent = label + ': ' + fmt(get()); g.apply(); }, true); return b; };
    const cycle = (k, list) => () => { P.setSetting(k, list[(list.indexOf(set[k]) + 1) % list.length]); };
    card.append(
      toggle('Music', () => set.music, () => P.setSetting('music', !set.music), (v) => (v ? 'On' : 'Off')),
      toggle('Sound effects', () => set.sfx, () => P.setSetting('sfx', !set.sfx), (v) => (v ? 'On' : 'Off')),
      toggle('Walking speed', () => set.speed, cycle('speed', SPEEDS), (v) => v),
      toggle('Floors', () => set.floors, cycle('floors', FLOORS), (v) => (v === 'random' ? 'Random' : v === 'painted' ? 'Painted only' : 'Plain only')),
      toggle('Weather', () => set.weather, cycle('weather', WEATHERS), (v) => (v === 'full' ? 'Rain, wind, lightning' : v === 'calm' ? 'Rain and wind only' : 'Off')),
    );
    if (g.fs.can()) card.append(btn(g.fs.on() ? 'Exit full screen' : 'Full screen', () => { g.fs.toggle(); setTimeout(() => S.settings(backFn), 350); }, true));
    else card.append(mk('p', 'tip', 'Full screen: on iPhone use Share › Add to Home Screen, then open TODDY from your home screen.'));
    card.append(toggle('Unlock every level (testing)', () => set.unlockAll, () => P.setSetting('unlockAll', !set.unlockAll), (v) => (v ? 'On' : 'Off')));
    const rs = btn('Reset all progress', () => { if (rs.dataset.sure) { P.resetAll(); g.apply(); S.settings(backFn); } else { rs.dataset.sure = '1'; rs.textContent = 'Tap again to erase stars and streak'; } }, true); rs.classList.add('danger');
    card.append(rs, back('Back', backFn)); open(card);
  };

  S.how = (backFn) => {
    const card = mk('div', 'card left');
    card.append(mk('h1', '', 'How to play'));
    const ol = mk('ol', 'how');
    for (const t of [
      'Tap anywhere on the floor. Toddy walks there by himself, around things, and across corners.',
      'The glowing drink above a visitor is who to serve next. Walk into their golden square to hand over the cup at the front of your line.',
      'Wrong drink? They sigh and keep waiting. Step on a golden ring to brew a new cup.',
      'Tables, carts, puddles, shutters and Nox the thief are in the way. Bumping into things can spill a cup.',
      'Serve before the lanterns go out. ★ 60% of the visitors · ★★ everyone · ★★★ everyone and no cup lost.',
      'Every night has 10 levels. The tenth is a boss. Each level is a little harder than the last, and after Night 7 the nights never end.',
    ]) ol.append(mk('li', '', t));
    card.append(ol, back('Back', backFn)); open(card);
  };

  S.about = (backFn) => {
    const card = mk('div', 'card');
    card.append(mk('h1', '', 'About'), mk('p', '', 'TODDY Trail is a small café game from toddy.meme. Toddy, the café cat, brings drinks to his visitors before the lanterns go out.'));
    card.append(mk('p', '', 'No account and no wallet needed. Your stars are saved on this device only.'), mk('p', '', 'The music and sounds are made live in your browser.'), mk('p', 'tip', BUILD), back('Back', backFn)); open(card);
  };

  S.daily = () => {
    const { plan, state, streak } = P.todaysDaily(), card = mk('div', 'card');
    card.append(mk('h1', '', 'Daily Run'), mk('p', 'sub', plan.key + ' · the same for everyone · new run at midnight UTC'), mk('p', 'chips', streak ? 'Streak ' + streak + (streak === 1 ? ' day' : ' days') : 'Finish all 3 levels to start a streak'));
    plan.levels.forEach((L, i) => {
      const done = state.done[i], b = btn('Level ' + (i + 1) + ' of 3' + (isBoss(L) ? ' · Boss' : '') + '   ' + (done ? starText(state.stars[i]) : 'not played'), () => g.begin(L, i), true);
      card.append(b);
    });
    card.append(mk('h2', '', 'Today\'s goals'));
    for (const gl of plan.goals) { const c = state.goals[gl.id] || 0, row = mk('div', 'goal' + (c >= gl.target ? ' done' : '')); row.append(mk('span', '', gl.text), mk('b', '', c >= gl.target ? '✓' : c + '/' + gl.target)); card.append(row); }
    card.append(back('Home', S.home)); open(card);
  };

  S.message = (text) => { const c = mk('div', 'card', text); open(c); };
  return S;
}
