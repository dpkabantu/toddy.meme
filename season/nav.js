// Menu link on the main page: "Sign in" before sign-in, the player's name after. Hidden if the Season server does not answer.
(function () {
  'use strict';
  var li = document.getElementById('nav-season'); if (!li) return;
  var a = li.querySelector('a');
  fetch('/api/me', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || j.ok === false) return;
      if (j.signedIn) a.textContent = j.username + ' \u00b7 Season 1';
      else if (j.pending) { a.textContent = 'Finish joining'; a.href = '/passport/?step=join'; }
      else if (j.signInAvailable === false) return;
      else a.textContent = 'Season 1 \u00b7 Sign in';
      li.hidden = false;
    })
    .catch(function () { /* leave it hidden */ });
})();
