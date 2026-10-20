// TODDY Season helper shared by the games. No inline code (strict CSP), same-origin only.
// Guests (not signed in) play exactly as before: nothing is sent. Signed-in players get their daily runs checked by the server.
(function () {
  'use strict';
  var H = 3600000, meP = null, runs = {};
  // The TODDY night starts at 13:00 UTC. Same rule as the server (server/clock.js).
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
  // opts (optional): { mode: 'weekly', mission: id } for a weekly mission. Nothing is sent for guests.
  function istDate(iso) { try { return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  // The player's missions from the server (signed in), or null for guests / when the server does not answer.
  var missionsP = null;
  function missions() {
    if (!missionsP) missionsP = signedIn().then(function (yes) { return yes ? fetch('/api/me/points', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j.missions : null; }) : null; }).catch(function () { return null; });
    return missionsP;
  }
  function start(game, opts) {
    var body = { game: game, night: night() }; Object.keys(opts || {}).forEach(function (k) { body[k] = opts[k]; });
    runs[game] = signedIn().then(function (yes) { return yes ? post('/api/run/start', body) : { ok: false, guest: true }; });
    return runs[game];
  }
  // payload: what the game recorded (Moon Brew: { log }, Full Moon: { drops, endTick, score }). Resolves to the server's answer, or null for guests.
  function finish(game, payload) {
    var p = runs[game]; runs[game] = null;
    if (!p) return Promise.resolve(null);
    return p.then(function (s) {
      if (!s || s.guest) return null;
      if (!s.ok) return s;
      if (!s.runId) return { ok: true, counted: false, reason: 'already_counted', mission: s.mission ? s.mission.id : undefined };
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
    run_not_found: 'This run was already sent.',
    tray_order: 'Trays go in order: clear the tray before this one first.'
  };
  // Text for the result screen. Returns { text, link } or null when nothing should be shown.
  function describe(res) {
    if (!res) return null;
    if (res.ok === false && res.error === 'mission_locked') return { text: 'This mission opens for Season points on ' + istDate(res.opensAt) + '. Until then, playing it is practice.', link: true };
    if (res.ok === false && res.error === 'daily_not_open') return { text: 'This game\u2019s daily challenge counts for Season points from week ' + res.fromWeek + '. This week it has its launch mission instead. This run is practice.', link: true };
    if (res.ok === false) { if (res.error === 'offline' || res.error === 'not_configured' || res.error === 'sign_in_first' || res.error === 'mission_not_found' || res.error === 'case_not_in_mission') return null; return { text: MSG[res.error] || 'This run could not be confirmed, so it earned no Season points.' }; }
    if (res.mission) {
      var brew = String(res.mission).indexOf('moon-brew') === 0, unit = brew ? 'trays' : 'cases';
      var nightP = res.progress && res.progress.night ? ' \u00b7 Night ' + res.progress.night + ': ' + res.progress.nightDone + ' of ' + res.progress.nightOf + ' trays' : '';
      var label = res.progress ? (brew ? 'Season Nights' : 'Chapter mission') : 'Weekly Challenge', prog = nightP || (res.progress ? ' \u00b7 ' + res.progress.cases + ' of ' + res.progress.of + ' ' + unit : '');
      if (res.counted) { var mi = res.points.items || []; return { text: label + ' points: +' + res.points.total + (res.held ? ' (waiting for review)' : '') + ' \u00b7 ' + mi.map(function (x) { return x.label + ' +' + x.amount; }).join(' \u00b7 ') + prog + '.', link: true }; }
      if (res.progress && res.progress.night && res.reason !== 'points_paused') return { text: 'Tray counted. Night ' + res.progress.night + ': ' + res.progress.nightDone + ' of ' + res.progress.nightOf + ' trays. Points come every 5 trays.', link: true };
      if (res.progress && res.reason !== 'points_paused') return { text: 'Case counted for the chapter mission: ' + res.progress.cases + ' of ' + res.progress.of + ' ' + unit + ' done.', link: true };
      if (res.reason === 'below_stage' || res.reason === 'not_better' || res.reason === 'already_counted') return { text: 'This try did not reach a new stage, so the mission points stay as they are.', link: true };
      if (res.reason === 'points_paused') return { text: 'Season points are paused right now. Your run was kept.' };
      return null;
    }
    if (res.counted) {
      var items = res.points.items || [], one = items.length === 1;
      var parts = items.map(function (x) { return one ? x.label : x.label + ' +' + x.amount; });
      return { text: 'Season points: +' + res.points.total + (res.held ? ' (waiting for review)' : '') + ' \u00b7 ' + parts.join(' \u00b7 ') + '. Your medal for the night sets these points, not your score.', link: true };
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
    if (d.link) { var a = document.createElement('a'); a.href = '/season/'; a.textContent = 'See your Season page'; el.appendChild(a); }
    el.hidden = false;
  }
  function guestHint(el) {
    if (!el) return; signedIn().then(function (yes) { if (yes) return; el.textContent = 'Playing as a guest. '; var a = document.createElement('a'); a.href = '/season/'; a.textContent = 'Sign in on the Season page to earn Season points.'; el.appendChild(a); el.hidden = false; });
  }
  window.ToddySeason = { missions: missions, istDate: istDate, night: night, nightDate: nightDate, start: start, finish: finish, describe: describe, show: show, guestHint: guestHint, signedIn: signedIn };
})();
