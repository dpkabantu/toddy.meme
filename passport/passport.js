// TODDY Passport page. No inline code (strict CSP). Everything shown is set with textContent.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var show = function (which) { ['s-loading', 's-out', 's-join', 's-in'].forEach(function (id) { $(id).hidden = id !== which; }); };
  var ERR = {
    not_configured: 'Sign-in is not switched on yet on this address.',
    cancelled: 'Sign-in was cancelled. You can try again any time.',
    expired: 'That sign-in took too long or was already used. Please try again.',
    failed: 'Google sign-in did not work this time. Please try again.',
    email: 'Google says this email address is not verified, so we cannot use it.',
    blocked: 'This Passport was removed.',
    rate: 'Too many tries from here. Please wait a few minutes.',
    adult_required: 'Season accounts are for people 18 or older. You can still play every game as a guest.',
    terms_required: 'Please accept the Terms to continue.',
    username_length: 'A username needs 3 to 20 characters.',
    username_characters: 'Use only letters, numbers and _ .',
    username_shape: 'Use at least one letter, and do not start or end with _ .',
    username_not_allowed: 'That name is not available. Please choose another.',
    username_invalid: 'Please type a username.',
    username_taken: 'That name is already taken. Please choose another.',
    username_cooldown: 'You can change your username again on ',
    sign_in_first: 'Please sign in first.',
    already_registered: 'This Google account already has a Passport. Please sign in.',
    forbidden: 'That did not work. Please reload the page and try again.',
    server_error: 'Something went wrong on our side. Please try again in a moment.'
  };
  var say = function (text, bad) { var m = $('msg'); if (!text) { m.hidden = true; return; } m.textContent = text; m.className = 'msg' + (bad ? ' bad' : ''); m.hidden = false; };
  var sayErr = function (code, extra) { say((ERR[code] || ERR.server_error) + (extra || ''), true); };

  function api(method, path, body) {
    var opt = { method: method, credentials: 'same-origin', headers: {} };
    if (method === 'POST') { opt.headers['Content-Type'] = 'application/json'; opt.headers['X-Requested-With'] = 'toddy-passport'; opt.body = JSON.stringify(body || {}); }
    return fetch(path, opt).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'server_error' }; }).then(function (j) { j.status = r.status; return j; }); });
  }

  var ADJ = ['Sleepy', 'Cosy', 'Quiet', 'Golden', 'Midnight', 'Gentle', 'Misty', 'Velvet', 'Amber', 'Starlit'];
  var ANI = ['Otter', 'Fox', 'Owl', 'Panda', 'Moth', 'Hare', 'Finch', 'Lynx', 'Wren', 'Badger'];
  function idea() {
    var r = new Uint32Array(3); crypto.getRandomValues(r);
    return ADJ[r[0] % ADJ.length] + ANI[r[1] % ANI.length] + (100 + r[2] % 900);
  }
  function dateText(iso) { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso; } }

  var terms = '';
  function render(me) {
    say('');
    if (me.signedIn) {
      $('p-id').textContent = me.passportId;
      $('p-name').textContent = me.username;
      $('p-since').textContent = 'Member since ' + dateText(me.joinedAt);
      var c = me.usernameChange || {};
      $('r-note').textContent = c.allowed ? (c.nextAt ? '' : 'You can change your username now. After that, changes are possible once every 30 days, and your old name stays reserved for you for those 30 days.') : 'You can change your username again on ' + dateText(c.nextAt) + '.';
      $('r-go').disabled = !c.allowed; $('r-name').disabled = !c.allowed;
      show('s-in');
    } else if (me.pending) {
      terms = me.termsVersion || '';
      $('hint').textContent = me.emailHint; $('j-ver').textContent = terms;
      if (!$('j-name').value) $('j-name').value = idea();
      show('s-join');
    } else {
      var ok = me.signInAvailable !== false;
      $('signin').hidden = !ok; $('off').hidden = ok;
      show('s-out');
    }
  }
  function load() { return api('GET', '/api/me').then(function (me) { if (me.ok === false) { show('s-out'); $('signin').hidden = true; $('off').hidden = false; return; } render(me); }).catch(function () { show('s-out'); sayErr('server_error'); }); }

  $('j-shuffle').addEventListener('click', function () { $('j-name').value = idea(); });
  $('j-go').addEventListener('click', function () {
    var b = $('j-go'); b.disabled = true;
    api('POST', '/api/signup', { username: $('j-name').value, adult: $('j-adult').checked, terms: $('j-terms').checked ? terms : '' }).then(function (j) {
      b.disabled = false;
      if (j.ok) { location.href = '/season/'; return; }
      if (j.error === 'terms_required' && !$('j-terms').checked) return sayErr('terms_required');
      sayErr(j.error);
      if (j.error === 'sign_in_first' || j.error === 'already_registered') load();
    }).catch(function () { b.disabled = false; sayErr('server_error'); });
  });
  $('r-go').addEventListener('click', function () {
    var b = $('r-go'); b.disabled = true;
    api('POST', '/api/me/username', { username: $('r-name').value }).then(function (j) {
      if (j.ok) { $('r-name').value = ''; load().then(function () { say('Username changed.'); }); return; }
      b.disabled = false;
      sayErr(j.error, j.error === 'username_cooldown' && j.nextAt ? dateText(j.nextAt) + '.' : '');
    }).catch(function () { b.disabled = false; sayErr('server_error'); });
  });
  $('out').addEventListener('click', function () { api('POST', '/api/auth/logout').then(function () { load().then(function () { say('Signed out.'); }); }); });
  $('d-go').addEventListener('click', function () {
    api('POST', '/api/me/delete', { confirm: $('d-word').value.trim() }).then(function (j) {
      if (j.ok) { $('d-word').value = ''; load().then(function () { say('Your Passport was deleted.'); }); } else say(j.error === 'confirm_required' ? 'Type DELETE in capital letters to confirm.' : (ERR[j.error] || ERR.server_error), true);
    }).catch(function () { sayErr('server_error'); });
  });

  // Browsers built into apps (X, Instagram, Facebook, TikTok, LINE, Android WebView) do not share the phone's Google sign-ins.
  // Telegram's own browser cannot be told apart, and it works, so it gets no hint.
  var ua = navigator.userAgent || '';
  if (/Twitter|Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance|Line\/|; wv\)/i.test(ua)) $('inapp').hidden = false;
  $('copylink').addEventListener('click', function () {
    var url = location.origin + location.pathname, b = $('copylink'), done = function () { b.textContent = 'Link copied'; };
    var fallback = function () { try { var t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done(); } catch (e) { b.textContent = url; } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
  });

  load().then(function () {
    var q = new URLSearchParams(location.search), e = q.get('e');
    if (e && ERR[e]) sayErr(e);
    if (e || q.get('step')) history.replaceState(null, '', location.pathname);
  });
})();
