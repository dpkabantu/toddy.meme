// TODDY account helper, shared by every game (same file in each game folder). Plain script, no packages, no inline code.
// Talks only to our own /api/*. If the accounts service is off or unreachable, every call quietly answers "not signed in",
// so guest play never depends on it. Exposes window.ToddyAccount.
(function () {
  'use strict';
  var ANON_KEY = 'toddy_anon';
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function anonId() {
    var id = safe(function () { return localStorage.getItem(ANON_KEY); }, null);
    if (id && /^[A-Za-z0-9_-]{16,64}$/.test(id)) return id;
    var a = new Uint8Array(18); crypto.getRandomValues(a);
    id = btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    safe(function () { localStorage.setItem(ANON_KEY, id); });
    return id;
  }
  function call(method, path, body) {
    var opt = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(path, opt).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; }, function () { return { status: r.status, body: null }; });
    }).catch(function () { return { status: 0, body: null }; });
  }
  var cached = null;
  var api = {
    anonId: anonId,
    me: function (force) {
      if (cached && !force) return cached;
      cached = call('GET', '/api/me').then(function (r) {
        return r.status === 200 && r.body ? r.body : { signedIn: false, unavailable: true };
      });
      return cached;
    },
    signInUrl: function (game) { return '/api/auth/google/start?anon=' + encodeURIComponent(anonId()) + '&return=' + encodeURIComponent('/games/' + game + '/'); },
    setProfile: function (changes) { cached = null; return call('POST', '/api/me/profile', changes).then(function (r) { return { ok: r.status === 200, error: r.body && r.body.error }; }); },
    signOut: function () { cached = null; return call('POST', '/api/logout', {}).then(function (r) { return r.status === 200; }); },
    deleteAccount: function () { cached = null; return call('POST', '/api/me/delete', {}).then(function (r) { return r.status === 200; }); },
    pull: function (game) { return call('GET', '/api/progress/' + game).then(function (r) { return r.status === 200 && r.body ? r.body.data : undefined; }); },
    submitScore: function (game, day, score) { return call('POST', '/api/score', { game: game, day: day, score: score }).then(function (r) { return r.status === 200; }); },
    leaderboard: function (game, period) { return call('GET', '/api/leaderboard/' + game + '?period=' + period).then(function (r) { return r.status === 200 ? r.body : null; }); },
    push: function (game, data) { return call('PUT', '/api/progress/' + game, { data: data }).then(function (r) { return r.status === 200; }); },
  };
  window.ToddyAccount = api;
})();
