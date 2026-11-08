// Full Moon: best scores (free play, twists, Daily nights) and the Daily streak go into an account; only ever adds. Settings stay local.
(function () {
  'use strict';
  function read() {
    var best = {}, streak = null;
    try {
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^mm\.best\./.test(k)) { var v = parseInt(localStorage.getItem(k), 10); if (v > 0) best[k] = v; } }
      streak = JSON.parse(localStorage.getItem('mmStreak') || 'null');
    } catch (e) { /* storage blocked */ }
    return { best: best, streak: streak && typeof streak.day === 'number' ? { day: streak.day, n: streak.n } : null };
  }
  function later(a, b) { if (!a || !b) return a || b || null; return b.day > a.day || (b.day === a.day && b.n > a.n) ? b : a; }
  window.ToddyAccountUI.mount({
    game: 'full-moon', pillAnchor: '.card', scoreLabel: 'best run', rowSelector: '.links:has([data-act="how"])', chipClass: 'chip',
    read: read,
    scores: function () { var n = new Date(), d = n.getUTCFullYear() * 10000 + (n.getUTCMonth() + 1) * 100 + n.getUTCDate(), v = 0; try { v = parseInt(localStorage.getItem('mm.day.' + d), 10) || 0; } catch (e) { /* storage blocked */ } return v > 0 ? [{ day: d, score: v }] : []; },
    merge: function (l, r) {
      r = r || {}; var best = {}, k;
      for (k in (l.best || {})) best[k] = l.best[k];
      for (k in (r.best || {})) if (/^mm\.best\./.test(k) && Number(r.best[k]) > (best[k] || 0)) best[k] = Number(r.best[k]);
      return { best: best, streak: later(l.streak, r.streak) };
    },
    write: function (m) { try { for (var k in m.best) localStorage.setItem(k, String(m.best[k])); if (m.streak) localStorage.setItem('mmStreak', JSON.stringify(m.streak)); return true; } catch (e) { return false; } },
  });
})();
