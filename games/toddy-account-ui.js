// TODDY account panel + progress sync for games that keep their own save (Scam Lab, Full Moon).
// A game adds one small adapter file that says where its save lives and how two saves are merged.
// Everything quiet-fails: if the accounts service is off, nothing appears and the game plays exactly as before.
(function () {
  'use strict';
  var A = window.ToddyAccount; if (!A) return;
  var cfg = null, me = null, lastPushed = '', backdrop = null, sentScores = {};
  function el(tag, props) { var e = document.createElement(tag); if (props) for (var k in props) e[k] = props[k]; for (var i = 2; i < arguments.length; i++) e.append(arguments[i]); return e; }
  function stamp(d) { return JSON.stringify(d); }

  // ----- panel -----
  function close() { if (backdrop) backdrop.hidden = true; }
  function open() {
    if (!backdrop) {
      backdrop = el('div', { className: 'ta-back', hidden: true });
      backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      document.body.append(backdrop);
    }
    backdrop.hidden = false; render();
  }
  function render() {
    A.me(true).then(function (m) {
      me = m; backdrop.textContent = '';
      var card = el('div', { className: 'ta-card', role: 'dialog', 'aria-label': 'Account' }); backdrop.append(card);
      card.append(el('h3', { textContent: 'Account' }));
      var done = el('button', { className: 'ta-btn', type: 'button', textContent: 'Close' }); done.addEventListener('click', close);
      var lb = el('button', { className: 'ta-btn', type: 'button', textContent: 'Leaderboard' }); lb.addEventListener('click', function () { board('daily'); });
      if (m.unavailable) { card.append(el('small', { textContent: 'Sign-in is not available right now. You can keep playing as a guest.' }), done); return; }
      if (!m.signedIn) {
        card.append(el('small', { textContent: 'Optional. Keep your progress on every device. We store your email, name and a nickname you choose. Other players only ever see the nickname.' }),
          el('small', {}, el('a', { href: 'https://toddy.meme/privacy.html', target: '_blank', rel: 'noopener noreferrer', textContent: 'What we store' })),
          el('a', { className: 'ta-btn go', href: A.signInUrl(cfg.game), textContent: 'Continue with Google' }), lb, done);
        return;
      }
      var nick = el('input', { type: 'text', maxLength: 16, value: m.nickname || '', placeholder: 'Pick a nickname', autocomplete: 'off' });
      var msg = el('small', { role: 'status' });
      var save = el('button', { className: 'ta-btn', type: 'button', textContent: 'Save nickname' });
      save.addEventListener('click', function () { A.setProfile({ nickname: nick.value }).then(function (r) { msg.textContent = r.ok ? 'Saved.' : (r.error || 'Could not save.'); }); });
      var boards = el('input', { type: 'checkbox', checked: m.showOnBoards });
      boards.addEventListener('change', function () { A.setProfile({ showOnBoards: boards.checked }); });
      var out = el('button', { className: 'ta-btn', type: 'button', textContent: 'Sign out' });
      out.addEventListener('click', function () { A.signOut().then(render); });
      var del = el('button', { className: 'ta-btn', type: 'button', textContent: 'Delete my data' });
      del.addEventListener('click', function () { if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Tap again to delete everything'; return; } A.deleteAccount().then(render); });
      card.append(el('b', { textContent: m.needsNickname ? 'Welcome! Pick a nickname' : 'Signed in' }), nick, save, el('label', { className: 'ta-row' }, boards, el('small', { textContent: 'Show me on leaderboards' })), msg, lb, out, del, done);
    });
  }

  // ----- leaderboard (Daily / Weekly / Monthly, top 10 + your own rank) -----
  function board(period) {
    backdrop.textContent = '';
    var card = el('div', { className: 'ta-card', role: 'dialog', 'aria-label': 'Leaderboard' }); backdrop.append(card);
    card.append(el('h3', { textContent: 'Leaderboard' }));
    var tabs = el('div', { className: 'ta-tabs' });
    ['daily', 'weekly', 'monthly'].forEach(function (p) {
      var t = el('button', { className: 'ta-tab' + (p === period ? ' on' : ''), type: 'button', textContent: p.charAt(0).toUpperCase() + p.slice(1) }); t.setAttribute('aria-pressed', p === period ? 'true' : 'false');
      t.addEventListener('click', function () { board(p); }); tabs.append(t);
    });
    var list = el('div', { className: 'ta-list', textContent: 'Loading...' });
    var back = el('button', { className: 'ta-btn', type: 'button', textContent: 'Back' }); back.addEventListener('click', render);
    card.append(tabs, list, el('small', { textContent: 'Daily results only, the same puzzle for everyone. Saved scores, not yet verified.' }), back);
    A.leaderboard(cfg.game, period).then(function (d) {
      list.textContent = '';
      if (!d) { list.textContent = 'The leaderboard is not available right now.'; return; }
      if (!d.entries.length) list.append(el('small', { textContent: 'No scores yet for this period. Sign in, pick a nickname and play today\u2019s Daily to be first.' }));
      d.entries.slice(0, 10).forEach(function (e) { list.append(row(e.rank, e.nickname, e.score, e.you)); });
      if (d.you && d.you.rank > 10) list.append(row(d.you.rank, 'You', d.you.score, true));
    });
  }
  function row(rank, name, score, you) {
    return el('div', { className: 'ta-line' + (you ? ' you' : '') }, el('span', { className: 'ta-rank', textContent: String(rank) }), el('span', { className: 'ta-name', textContent: name }), el('span', { className: 'ta-score', textContent: Number(score).toLocaleString('en-US') }));
  }

  // ----- the "Account" chip, added to every matching button row (the games redraw their menus, so we keep watching) -----
  function addChips() {
    var rows = document.querySelectorAll(cfg.rowSelector);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].querySelector('[data-ta-chip]')) continue;
      var b = el('button', { className: cfg.chipClass || 'chip', type: 'button', textContent: 'Account' }); b.setAttribute('data-ta-chip', '1');
      b.addEventListener('click', open);
      rows[i].append(b);
    }
  }

  // ----- progress sync -----
  function push() {
    if (!me || !me.signedIn) return;
    var data = cfg.read(), s = stamp(data);
    if (s === lastPushed) return;
    A.push(cfg.game, data).then(function (ok) { if (ok) lastPushed = s; });
  }
  // Daily results the game has saved are sent once to the leaderboard (the server keeps the best of each day).
  function sendScores() {
    if (!me || !me.signedIn || !cfg.dailyScores) return;
    cfg.dailyScores().forEach(function (d) {
      var k = d.day + ':' + d.score; if (sentScores[k]) return; sentScores[k] = 1;
      A.submitScore(cfg.game, d.day, d.score).then(function (ok) { if (!ok) delete sentScores[k]; });
    });
  }
  function syncNow() {
    return A.me(true).then(function (m) {
      me = m; if (!m.signedIn) return;
      return A.pull(cfg.game).then(function (remote) {
        if (remote === undefined) return;
        var local = cfg.read(), merged = cfg.merge(local, remote);
        if (stamp(merged) !== stamp(local) && cfg.write(merged)) { location.reload(); return; }
        if (remote === null || stamp(merged) !== stamp(remote)) { lastPushed = ''; push(); } else lastPushed = stamp(merged);
      });
    });
  }

  window.ToddyAccountUI = {
    mount: function (config) {
      cfg = config;
      A.me().then(function (m) {
        if (m.unavailable) return; // service off: no chip, no sync
        addChips();
        new MutationObserver(addChips).observe(document.body, { childList: true, subtree: true });
        var q = /^\?signin=(ok|cancelled|failed|expired)$/.exec(location.search);
        if (q) history.replaceState(null, '', location.pathname);
        syncNow().then(function () { sendScores(); if (q) open(); });
        setInterval(function () { push(); sendScores(); }, 20000);
        document.addEventListener('visibilitychange', function () { if (document.hidden) { push(); sendScores(); } });
        window.addEventListener('pagehide', function () { push(); sendScores(); });
      });
    },
  };
})();
