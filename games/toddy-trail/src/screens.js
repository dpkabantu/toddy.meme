// TODDY Trail screens: Home, Nights, Levels, Night intro, Result, Pause, Settings, Daily Run, How to play, About.
// Every screen except Home has a clear Back button to the page before it. This file only builds menus; it never touches the game rules.
import { PER_NIGHT, STORY_NIGHTS, nightName, nightTell, nightOf, posInNight, levelOf, isBoss } from './levels.js';
import * as P from './progress.js';
import { ico } from './icons.js';

export const BUILD = 'Test build · 28 Oct 2026';
const SPEEDS = ['Relaxed', 'Normal', 'Quick'], FLOORS = ['random', 'painted', 'plain'], WEATHERS = ['full', 'calm', 'off'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const starText = (n, of = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n));

const HOSTS = { 1: 'milo', 2: 'pip', 3: 'velvet', 4: 'drizzle', 5: 'tilly', 6: 'nova', 7: 'fizz' };
const hostPic = (n) => (HOSTS[n] ? 'assets/trail_host_' + HOSTS[n] + '_v01.webp' : 'assets/trail_outfit_cape_v01.webp');
function pic(name, cls, w, h) { const im = document.createElement('img'); im.src = 'assets/' + name + '.webp'; im.alt = ''; im.className = cls || ''; im.draggable = false; if (w) { im.width = w; im.height = h || w; } return im; }
function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== '') e.textContent = text; return e; }

// g: { overlay, begin(L, daily|null), resume(), restart(), apply(), fs: { can(), on(), toggle() }, exit(), click() }
export function createScreens(g) {
  const o = g.overlay;
  const open = (card) => { o.textContent = ''; o.hidden = false; o.classList.toggle('homebg', card.classList.contains('home')); o.append(card); const c = card.querySelector('.btn'); if (c && c.focus && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) { try { c.focus({ preventScroll: true }); } catch (_) { /* optional */ } } };
  const btn = (text, fn, alt) => { const b = mk('button', 'btn' + (alt ? ' alt' : ''), text); b.type = 'button'; b.addEventListener('click', () => { g.click(); fn(); }); return b; };
  const back = (text, fn) => { const b = btn('‹ ' + text, fn, true); b.classList.add('back'); return b; };
  const S = {};

  const pill = (text, fn) => { const b = mk('button', 'pill', text); b.type = 'button'; b.addEventListener('click', () => { g.click(); fn(b); }); return b; };
  const bigBtn = (title, sub, fn) => { const b = mk('button', 'bigbtn'); b.type = 'button'; b.append(mk('span', 't', title), mk('small', '', sub)); b.addEventListener('click', () => { g.click(); fn(); }); return b; };
  const DRINKS = ['moon', 'star', 'crescent', 'sun', 'heart', 'snow', 'bolt'];

  const round = (icon, label, on, fn) => { const b = mk('button', 'round' + (on ? '' : ' off')); b.type = 'button'; b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', String(!!on)); b.append(ico(icon)); b.addEventListener('click', () => { g.click(); const v = fn(b); if (v !== undefined) { b.classList.toggle('off', !v); b.setAttribute('aria-pressed', String(!!v)); } }); return b; };
  const orn = () => { const d = mk('div', 'orn'); d.append(mk('i')); d.setAttribute('aria-hidden', 'true'); return d; };

  S.home = () => {
    g.menuMusic();
    const card = mk('div', 'card home'), nx = P.nextLevel(), set = P.settings(), sk = P.currentStreak(), daily = P.todaysDaily();
    const title = mk('h1', 'title'); title.append(mk('span', 'a', 'Toddy'), mk('span', 'b', 'Trail'));
    const mascot = mk('div', 'mascot'); mascot.setAttribute('aria-hidden', 'true'); mascot.append(mk('span', 'wave'));
    const play = mk('button', 'btn play'); play.type = 'button'; play.append(mk('span', 't', 'Play'), mk('small', '', nightName(nightOf(nx)) + ' · Level ' + posInNight(nx)));
    play.addEventListener('click', () => { g.click(); S.levels(nightOf(nx)); });
    const day = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const dDone = daily.state.done.every(Boolean);
    const dbtn = bigBtn('Daily Run' + (dDone ? '  ✓' : ''), dDone ? 'Done today · streak ' + sk : day + (sk ? ' · streak ' + sk : ' · same for everyone'), S.daily);
    const rounds = mk('div', 'rounds');
    rounds.append(round('sound', 'Sound effects', set.sfx, () => { P.setSetting('sfx', !set.sfx); g.apply(); return set.sfx; }), round('music', 'Music', set.music, () => { P.setSetting('music', !set.music); g.apply(); return set.music; }));
    if (g.fs.can()) { const fsb = round('expand', 'Full screen', g.fs.on(), () => { g.fs.toggle(); setTimeout(() => { fsb.classList.toggle('off', !g.fs.on()); fsb.setAttribute('aria-pressed', String(!!g.fs.on())); }, 400); }); fsb.classList.remove('off'); rounds.append(fsb); }
    { const nc = P.myCards(); const gb = round('gift', 'Gift cards', true, () => { S.cards(S.home); }); gb.classList.remove('off'); if (nc.nights.length + nc.days.length) { const c = mk('i', 'badge', String(nc.nights.length + nc.days.length)); gb.append(c); } rounds.append(gb); }
    const links = mk('div', 'pills3'); links.append(pill('How to play', () => S.how(S.home)), pill('Settings', () => S.settings(S.home)), pill('About', () => S.about(S.home)));
    const ex = mk('button', 'link'); ex.type = 'button'; ex.append(ico('exit'), document.createTextNode(' Exit to Games')); ex.addEventListener('click', () => { g.click(); g.exit(); });
    card.append(pic('trail_emblem_v01', 'emblem', 120, 120), title, orn(), mk('p', 'tagline', 'Tap to guide Toddy. Serve every drink before the lanterns go out.'), mascot, play, dbtn, rounds, orn(), links, ex);
    open(card);
  };

  S.levels = (n) => {   // "Choose a level": night tabs, the host's card, ten levels (each opens when the one before has at least 1 star)
    g.menuMusic();
    const card = mk('div', 'card levels'), unlocked = P.nightsUnlocked(), anyOpen = P.settings().unlockAll;
    const head = mk('div', 'lhead'), bk = mk('button', 'iback'); bk.type = 'button'; bk.append(ico('back')); bk.setAttribute('aria-label', 'Back'); bk.addEventListener('click', () => { g.click(); S.home(); });
    const ts = mk('span', 'lstars'); ts.append(pic('trail_icon_star_v01', '', 20), document.createTextNode(' ' + P.totalStars())); ts.setAttribute('aria-label', P.totalStars() + ' stars in total');
    head.append(bk, mk('h1', '', 'Choose a Level'), ts); card.append(head);
    const tabs = mk('div', 'tabs'), T = Math.max(8, unlocked + 1);
    for (let k = 1; k <= T; k++) {
      const ok = k <= unlocked || anyOpen, t = mk('button', 'tab' + (k === n ? ' on' : '') + (ok ? '' : ' locked')); t.type = 'button';
      if (!ok) t.append(pic('trail_icon_lock_v01', 'tl', 16)); t.append(document.createTextNode(nightName(k)));
      if (ok) t.addEventListener('click', () => { g.click(); S.levels(k); }); else { t.disabled = true; t.setAttribute('aria-label', nightName(k) + ', locked'); } tabs.append(t);
    }
    card.append(tabs);
    const got = P.nightStars(n), all = PER_NIGHT * 3;
    const info = mk('div', 'ninfo'), txt = mk('div', 'ntxt'), bar = mk('div', 'pbar'), fill = mk('i'); fill.style.width = Math.round((got / all) * 100) + '%'; bar.append(fill); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', got + ' of ' + all + ' stars');
    txt.append(mk('div', 'k', (n > STORY_NIGHTS ? 'ENDLESS · No. ' : 'No. ') + n), mk('div', 'nm', nightName(n)), orn(), bar, mk('small', '', got + ' / ' + all + ' stars'));
    info.append(pic(hostPic(n).slice(7, -5), 'host', 180, 180), txt); card.append(info, mk('p', 'ntell', nightTell(n)));
    const grid = mk('div', 'lvgrid');
    for (let p = 1; p <= PER_NIGHT; p++) {
      const L = levelOf(n, p), ok = P.isUnlocked(L), sc = P.starsOf(L), b = mk('button', 'lv' + (ok ? '' : ' locked') + (isBoss(L) ? ' boss' : '') + (ok && !sc && (L === 1 || P.starsOf(L - 1) > 0) ? ' now' : ''));
      b.type = 'button'; b.append(mk('span', 'num', String(p)));
      const row = mk('span', 'st'); if (!ok) row.append(pic('trail_icon_lock_v01', 'lk', 20)); else if (isBoss(L) && !sc) row.append(pic('trail_icon_crown_v01', 'lk', 22)); else for (let i = 0; i < 3; i++) row.append(pic(i < sc ? 'trail_icon_star_v01' : 'trail_icon_star_off_v01', 's' + (i < sc ? ' on' : ' off'), 14));
      b.append(row);
      if (isBoss(L) && sc && ok) b.append(pic('trail_icon_crown_v01', 'crown', 18));
      b.setAttribute('aria-label', nightName(n) + ' level ' + p + (isBoss(L) ? ', boss' : '') + (ok ? ', ' + sc + ' stars' : ', locked'));
      if (ok) b.addEventListener('click', () => { g.click(); g.begin(L, null); }); else b.disabled = true; grid.append(b);
    }
    const hint = mk('p', 'nexthint', 'Serving 60% opens the next level. Finish all 10 levels to win this night\'s gift card.');
    const home = mk('button', 'btn alt homebtn'); home.type = 'button'; home.append(ico('home'), document.createTextNode(' Home')); home.addEventListener('click', () => { g.click(); S.home(); });
    card.append(grid, hint, home); open(card);
    const on = tabs.querySelector('.on'); if (on && on.scrollIntoView) { try { on.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (_) { /* optional */ } }
  };

  S.intro = (L, daily) => {   // the picture story before the first level of a night
    const n = nightOf(L), card = mk('div', 'card'), v = document.createElement('video');
    if (n <= STORY_NIGHTS) { v.src = 'assets/trail_intro_n' + n + '_v01.mp4'; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.className = 'intro'; card.append(v); }
    card.append(mk('h1', '', nightName(n)), mk('p', '', nightTell(n)));
    card.append(btn('Start', () => { P.markIntro(n); g.start(L, daily); }), back('Levels', () => S.levels(n))); open(card);
    if (n <= STORY_NIGHTS) { const pl = v.play(); if (pl && pl.catch) pl.catch(() => {}); }
  };

  // info: { L, daily (index or null), stars, score, served, of, seconds, spills, rec: { newBest, first }, dailyDone }
  S.result = (info) => {
    const card = mk('div', 'card'), n = nightOf(info.L);
    card.classList.add('result', info.stars ? 'won' : 'lost');
    const bs = mk('div', 'bigstars'); for (let i = 0; i < 3; i++) bs.append(pic(i < info.stars ? 'trail_icon_star_v01' : 'trail_icon_star_off_v01', i < info.stars ? 'on' : 'off', 64)); bs.setAttribute('role', 'img'); bs.setAttribute('aria-label', info.stars + ' of 3 stars');
    card.append(bs, pic(info.stars ? 'trail_card_cleared_v01' : 'trail_card_tryagain_v01', 'rpic', 120), mk('h1', '', info.stars === 3 ? 'Perfect!' : info.stars === 2 ? 'All served!' : info.stars === 1 ? 'Level cleared' : 'Lanterns out'));
    const big = mk('div', 'big', '0'); card.append(big);
    { const t0 = performance.now(), end = info.score, calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; const tick = (now) => { const k = calm ? 1 : Math.min(1, (now - t0) / 800); big.textContent = String(Math.round(end * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }   // the score counts up
    card.append(mk('p', '', 'Served ' + info.served + ' of ' + info.of + ' · ' + info.seconds + ' s · cups lost ' + info.spills));
    if (info.rec && info.rec.newBest && info.stars > 0) card.append(mk('p', 'good', 'New best!'));
    if (info.stars === 0) card.append(mk('p', '', 'Serve at least ' + Math.ceil(info.of * 0.6) + ' for the first star.'));
    if (info.dailyDone) card.append(mk('p', 'good', 'Daily Run complete · streak ' + P.currentStreak()));
    const row = mk('div', 'row2');
    if (info.daily !== null) {
      const nx = info.daily + 1, plan = P.todaysDaily().plan;
      if (info.stars > 0 && nx < 3) card.append(btn('Daily level ' + (nx + 1), () => g.begin(plan.levels[nx], nx)));
      row.append(btn('Retry', () => g.restart(), info.stars > 0 && nx < 3), btn('Daily Run', S.daily, true));
    } else {
      if (info.stars > 0) card.append(btn('Next · ' + nightName(nightOf(info.L + 1)) + ' · Level ' + posInNight(info.L + 1), () => g.begin(info.L + 1, null)));
      row.append(btn('Retry', () => g.restart(), info.stars > 0), btn('Levels', () => S.levels(n), true));
    }
    card.append(row);
    { const h = mk('button', 'link'); h.type = 'button'; h.append(ico('home'), document.createTextNode(' Home')); h.addEventListener('click', () => { g.click(); S.home(); }); card.append(h); } open(card);
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
      toggle('Lighting and shake', () => set.lighting, () => P.setSetting('lighting', !set.lighting), (v) => (v ? 'On' : 'Off')),
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
    card.append(mk('p', 'sub', 'Finish all 3 levels to win today\'s gift card.'), mk('h2', '', 'Today\'s goals'));
    for (const gl of plan.goals) { const c = state.goals[gl.id] || 0, row = mk('div', 'goal' + (c >= gl.target ? ' done' : '')); row.append(mk('span', '', gl.text), mk('b', '', c >= gl.target ? '✓' : c + '/' + gl.target)); card.append(row); }
    card.append(back('Home', S.home)); open(card);
  };

  // ---- gift cards: one for every night with all ten levels cleared, one for every Daily Run finished ----
  const nightCard = (n, small) => {
    const c = mk('div', 'gift' + (small ? ' small' : '')), im = pic('trail_gift_n' + (((n - 1) % 7) + 1) + '_v01', 'art'); if (n > 7) im.style.filter = 'hue-rotate(' + (((n - 8) % 6) * 28 + 20) + 'deg) saturate(1.05)';
    c.append(im, pic('trail_icon_medal_v01', 'stamp'), mk('span', 'cap', nightName(n))); return c;
  };
  const dayCard = (key, small) => {
    const c = mk('div', 'gift day' + (small ? ' small' : '')), d = new Date(key + 'T00:00:00Z');
    c.append(pic('trail_icon_daily_v01', 'dico'), mk('b', '', 'Daily Run'), mk('span', 'dt', d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })), pic('trail_icon_flame_v01', 'fl', 26)); return c;
  };
  S.gift = (gift, next) => {
    const card = mk('div', 'card giftcard'), tile = gift.kind === 'night' ? nightCard(gift.n) : dayCard(gift.key);
    card.append(mk('h1', '', 'Gift card won!'), tile, mk('p', '', gift.kind === 'night' ? 'You finished every level of ' + nightName(gift.n) + '.' : 'You finished today\'s Daily Run.'), btn('Collect', next), btn('My gift cards', () => S.cards(() => next()), true)); open(card);
  };
  S.cards = (backFn) => {
    const card = mk('div', 'card cards'), mine = P.myCards();
    card.append(mk('h1', '', 'Gift cards'), mk('p', 'sub', mine.nights.length + ' night' + (mine.nights.length === 1 ? '' : 's') + ' · ' + mine.days.length + ' daily'));
    const grid = mk('div', 'giftgrid');
    const top = Math.max(STORY_NIGHTS, ...mine.nights);
    for (let n = 1; n <= top; n++) { const got = mine.nights.includes(n); if (got) grid.append(nightCard(n, true)); else if (n <= STORY_NIGHTS) { const l = mk('div', 'gift small locked'); l.append(pic('trail_icon_lock_v01', 'lk', 34), mk('span', 'cap', nightName(n))); grid.append(l); } }
    for (const k of mine.days.slice(0, 12)) grid.append(dayCard(k, true));
    card.append(grid, mk('p', 'tip', 'Finish all 10 levels of a night, or all 3 Daily Run levels, to win a card.'), back('Back', backFn)); open(card);
  };

  S.message = (text) => { const c = mk('div', 'card', text); open(c); };
  return S;
}
