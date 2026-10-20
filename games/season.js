// TODDY Season helper shared by the games. No inline code (strict CSP), same-origin only.
// Guests (not signed in) play exactly as before: nothing is sent. Signed-in players get their daily runs checked by the server.
(function () {
  'use strict';
  var H = 3600000, meP = null, runs = {};
  // The TODDY night starts at 13:00 UTC (18:30 India time). Same rule as the server (server/clock.js).
  function nightDate() { return new Date(Date.now() - 13 * H); }
  function night() { return nightDate().toISOString().slice(0, 10); }
  function post(path, body) {
    return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'toddy-passport' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }, function () { return { ok: false, error: 'server_error' }; }); })
      .catch(function () { return { ok: false, error: 'offline' }; });
  }
  function signedIn() {
    if (!meP) meP = fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { return !!(j && j.signedIn); }).catch(function () { return false; });
    return meP;
  }
  function start(game) {
    runs[game] = signedIn().then(function (yes) { return yes ? post('/api/run/start', { game: game, night: night() }) : { ok: false, guest: true }; });
    return runs[game];
  }
  // payload: what the game recorded (Moon Brew: { log }, Full Moon: { drops, endTick, score }). Resolves to the server's answer, or null for guests.
  function finish(game, payload) {
    var p = runs[game]; runs[game] = null;
    if (!p) return Promise.resolve(null);
    return p.then(function (s) {
      if (!s || s.guest) return null;
      if (!s.ok) return s;
      if (!s.runId) return { ok: true, counted: false, reason: 'already_counted' };
      var body = { runId: s.runId }; Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });
      return post('/api/run/finish', body);
    });
  }
  var MSG = {
    clock_off: 'Your device clock looks off, so this run cannot earn Season points.',
    rate: 'Too many runs in a short time. Season points will work again soon.',
    season_closed: 'The Season is not open right now.',
    too_fast: 'This run could not be confirmed, so it earned no Season points.',
    night_over: 'The night ended before this run finished, so it earned no Season points.',
    run_not_found: 'This run was already sent.'
  };
  // Text for the result screen. Returns { text, link } or null when nothing should be shown.
  function describe(res) {
    if (!res) return null;
    if (res.ok === false) { if (res.error === 'offline' || res.error === 'not_configured' || res.error === 'sign_in_first') return null; return { text: MSG[res.error] || 'This run could not be confirmed, so it earned no Season points.' }; }
    if (res.counted) {
      var items = res.points.items || [], one = items.length === 1;
      var parts = items.map(function (x) { return one ? x.label : x.label + ' +' + x.amount; });
      return { text: 'Season points: +' + res.points.total + (res.held ? ' (waiting for review)' : '') + ' \u00b7 ' + parts.join(' \u00b7 '), link: true };
    }
    if (res.reason === 'already_counted') return { text: 'You already reached the top level for this game tonight. Season points for it are done until the next night.', link: true };
    if (res.reason === 'not_better') return { text: 'Season points for this game tonight are already counted. A better result would add the difference.', link: true };
    if (res.reason === 'points_paused') return { text: 'Season points are paused right now. Your run was kept.' };
    return null;
  }
  // Puts the text into an element (textContent only). Adds a link to the Passport when asked.
  function show(el, res) {
    if (!el) return;
    var d = describe(res); if (!d) { el.hidden = true; return; }
    el.textContent = d.text + ' ';
    if (d.link) { var a = document.createElement('a'); a.href = '/passport/'; a.textContent = 'See your Passport'; el.appendChild(a); }
    el.hidden = false;
  }
  function guestHint(el) {
    if (!el) return; signedIn().then(function (yes) { if (yes) return; el.textContent = 'Playing as a guest. '; var a = document.createElement('a'); a.href = '/passport/'; a.textContent = 'Sign in to Passport to earn Season points.'; el.appendChild(a); el.hidden = false; });
  }
  window.ToddySeason = { night: night, nightDate: nightDate, start: start, finish: finish, describe: describe, show: show, guestHint: guestHint, signedIn: signedIn };
})();
