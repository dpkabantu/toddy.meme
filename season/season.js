// TODDY Season 1 page. No inline code (strict CSP). Everything shown is set with textContent.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  var pct = function (a, b) { return Math.max(0, Math.min(100, b ? Math.round(100 * a / b) : 0)) + '%'; };
  var ERR = { not_configured: 'Sign-in is not switched on yet on this address.', cancelled: 'Sign-in was cancelled. You can try again any time.', expired: 'That sign-in took too long or was already used. Please try again.', failed: 'Google sign-in did not work this time. Please try again.', rate: 'Too many tries from here. Please wait a few minutes.' };
  var say = function (t, bad) { var m = $('msg'); if (!t) { m.hidden = true; return; } m.textContent = t; m.className = 'msg' + (bad ? ' bad' : ''); m.hidden = false; };

  function api(path) { return fetch(path, { credentials: 'same-origin' }).then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { j.status = r.status; return j; }); }).catch(function () { return { ok: false, error: 'offline' }; }); }
  function bar(a, b) { var w = el('div', 'bar'), i = el('i'); i.style.width = pct(a, b); w.appendChild(i); w.setAttribute('role', 'progressbar'); w.setAttribute('aria-valuemin', '0'); w.setAttribute('aria-valuemax', String(b)); w.setAttribute('aria-valuenow', String(a)); return w; }
  function leftText(iso) { var ms = Date.parse(iso) - Date.now(); if (!(ms > 0)) return 'ending now'; var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000); return h + 'h ' + m + 'm left'; }
  function dayInitial(key) { return 'SMTWTFS'.charAt(new Date(key + 'T12:00:00Z').getUTCDay()); }
  function when(iso) { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function nightLabel(key) { try { return new Date(key + 'T12:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'long', timeZone: 'UTC' }); } catch (e) { return key; } }

  var S = null, P = null;   // public season facts, personal points (null for guests)

  function tonightLine() { $('night-line').textContent = 'Night of ' + nightLabel(S.night.key) + ' · ' + leftText(S.night.endsAt) + ' · a new night starts every day at 6:30 pm India time.'; }

  function renderTonight() {
    var box = $('tg'); box.textContent = '';
    var mine = {}; if (P) P.games.forEach(function (g) { mine[g.id] = g; });
    S.games.forEach(function (g) {
      var card = el('div', 'tg-card'), top = el('div', 'top'), nm = el('span', 'name', g.title);
      if (g.ready) nm.appendChild(el('span', 'tag', 'Season'));
      top.appendChild(nm);
      var m = mine[g.id], done = m && m.playedTonight;
      var state = !g.ready ? 'Joins the Season soon' : done ? 'Done tonight: ' + m.tonightBand + ' medal' : P ? 'Not played tonight' : 'Same challenge for everyone';
      top.appendChild(el('span', 'state' + (done ? ' done' : ''), state));
      card.appendChild(top);
      var a = el('a', 'btn' + (g.ready ? '' : ' alt'));
      if (!g.ready) { a.href = '/games/' + g.id + '/'; a.textContent = 'Play ' + g.title + ' (practice only)'; }
      else if (done && m.tonightBand === 'Gold') { a.href = '/games/' + g.id + '/?play=daily'; a.textContent = 'Top medal reached. Play again for fun'; a.className = 'btn alt'; }
      else if (done) { a.href = '/games/' + g.id + '/?play=daily'; a.textContent = 'Try for a better medal'; }
      else { a.href = '/games/' + g.id + '/?play=daily'; a.textContent = 'Play tonight’s challenge'; }
      card.appendChild(a); box.appendChild(card);
    });
    tonightLine(); $('tonight').hidden = false;
  }

  function renderHow() {
    var r = S.rules, ol = $('how-list'); ol.textContent = '';
    [
      'Every day at 6:30 pm India time a new night starts. Each game has one challenge for the night, the same for everyone.',
      'Play tonight’s challenge. Your best result that night gives you a medal, and the medal gives Season points: Played ' + r.bandPoints[0] + ', Bronze ' + r.bandPoints[1] + ', Silver ' + r.bandPoints[2] + ', Gold ' + r.bandPoints[3] + '.',
      'Play again the same night if you like. Points are only added if you earn a better medal, and then only the difference.',
      'Finish a game each night for +' + r.activeNight + ' (Active night). Play ' + r.consistency5Nights + ' nights in a week for +' + r.consistency5 + ', and all 7 for +' + r.consistency7Extra + ' more.',
      'Play ' + r.allRounderNights + ' nights in every game in a week for the All-Rounder bonus of +' + r.allRounder + '.',
      'One game can give at most ' + r.weeklyCap + ' points a week, so every game counts the same.',
      'Your game score (like 2,002) is separate. It is for your own records. Practice, Story and Free play never give Season points.'
    ].forEach(function (t) { ol.appendChild(el('li', '', t)); });
    $('how').hidden = false;
  }

  function renderMine() {
    var d = P, box = $('dash'); box.textContent = '';
    var s = el('div'); s.appendChild(el('h3', '', 'Your Season so far'));
    var big = el('div', 'big'); big.appendChild(el('b', '', String(d.points.season))); big.appendChild(el('span', '', d.points.pending ? '+ ' + d.points.pending + ' waiting for review' : 'of ' + d.points.seasonMax.toLocaleString('en-US') + ' possible')); s.appendChild(big); box.appendChild(s);
    var k = el('div', 'kpis');
    [[d.points.week, 'points this week'], [d.streak.current, d.streak.current === 1 ? 'night in a row' : 'nights in a row'], [d.streak.weekNights, 'nights this week']].forEach(function (x) { var c = el('div', 'kpi'); c.appendChild(el('b', '', String(x[0]))); c.appendChild(el('span', '', x[1])); k.appendChild(c); });
    box.appendChild(k);
    box.appendChild(el('h3', '', 'Your games this week'));
    var gs = el('div', 'games');
    d.games.forEach(function (g) {
      var card = el('div', 'game'), top = el('div', 'top');
      top.appendChild(el('span', 'name', g.title));
      top.appendChild(el('span', 'state' + (g.playedTonight ? ' done' : ''), !g.ready ? 'Joins the Season soon' : g.playedTonight ? 'Tonight: ' + g.tonightBand : 'Not played tonight'));
      card.appendChild(top); card.appendChild(bar(g.weekPoints, g.weekCap));
      var m = el('div', 'meta'); m.appendChild(el('span', '', g.weekPoints + ' / ' + g.weekCap + ' points this week')); m.appendChild(el('span', '', g.nightsThisWeek + ' night' + (g.nightsThisWeek === 1 ? '' : 's') + ' this week')); card.appendChild(m); gs.appendChild(card);
    });
    box.appendChild(gs);
    box.appendChild(el('h3', '', 'Last 7 nights'));
    var dots = el('div', 'dots'); d.streak.last7.forEach(function (x, i) { var e = el('i', (x.played ? 'on' : '') + (i === 6 ? ' now' : ''), dayInitial(x.night)); e.setAttribute('aria-label', x.night + (x.played ? ': played' : ': not played')); dots.appendChild(e); }); box.appendChild(dots);
    box.appendChild(el('h3', '', 'This week’s goals'));
    d.goals.forEach(function (g) { var w = el('div', 'goal' + (g.done ? ' done' : '')), t = el('div', 'top'); t.appendChild(el('span', '', g.label)); t.appendChild(el('span', '', g.done ? 'done +' + g.reward : '+' + g.reward)); w.appendChild(t); w.appendChild(bar(g.progress, g.target)); box.appendChild(w); });
    box.appendChild(el('h3', '', 'Recent points'));
    if (!d.recent.length) box.appendChild(el('p', 'note', 'Nothing yet. Play tonight’s challenge above while signed in, and your points appear here.'));
    else { var ul = el('ul', 'recent'); d.recent.forEach(function (r) { var li = el('li', r.status === 'pending' ? 'pending' : ''); li.appendChild(el('span', '', when(r.at) + ' · ' + r.label + (r.status === 'pending' ? ' (waiting)' : ''))); li.appendChild(el('b', '', (r.amount > 0 ? '+' : '') + r.amount)); ul.appendChild(li); }); box.appendChild(ul); }
    $('mine').hidden = false;
  }

  function start() {
    Promise.all([api('/api/me'), api('/api/season')]).then(function (rs) {
      var me = rs[0], season = rs[1];
      $('s-loading').hidden = true;
      if (!season || season.ok === false || !season.games) { $('s-off').hidden = false; return; }
      S = season;
      if (me && me.pending) { location.replace('/passport/?step=join'); return; }
      if (S.season && S.season.status !== 'live') $('testbanner').hidden = false;
      var q = new URLSearchParams(location.search).get('e'); if (q && ERR[q]) say(ERR[q], true);
      if (q) history.replaceState(null, '', location.pathname);
      if (me && me.signedIn) {
        $('h-name').textContent = me.username; $('h-id').textContent = me.passportId; $('hello').hidden = false; $('acct').hidden = false;
        api('/api/me/points').then(function (d) { P = d && d.ok ? d : null; renderTonight(); if (P) renderMine(); renderHow(); });
      } else {
        $('signin-card').hidden = false; renderTonight(); renderHow();
        var ua = navigator.userAgent || '';
        if (/Twitter|Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance|Line\/|; wv\)/i.test(ua)) $('inapp').hidden = false;
      }
      setInterval(function () { if (S) tonightLine(); }, 30000);
    });
  }
  $('copylink').addEventListener('click', function () {
    var url = location.origin + location.pathname, b = $('copylink'), done = function () { b.textContent = 'Link copied'; };
    var fallback = function () { try { var t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done(); } catch (e) { b.textContent = url; } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
  });
  start();
})();
