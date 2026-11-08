// Scam Lab: what goes into an account and how two saves are merged (only ever adds). Settings stay on the device.
(function () {
  'use strict';
  var KEY = 'toddy.scamlab.v2';
  function raw() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function pick(d) { return { stars: d.stars || {}, best: d.best || {}, rules: d.rules || [], daily: d.daily || {}, howto: !!d.howto }; }
  function maxMap(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) if (Number(b[k]) > (o[k] || 0)) o[k] = Number(b[k]); return o; }
  window.ToddyAccountUI.mount({
    game: 'scam-lab', rowSelector: '.title-nav', chipClass: 'chip',
    read: function () { return pick(raw()); },
    merge: function (l, r) {
      r = pick(r || {});
      var rules = (l.rules || []).slice(), seen = {}; rules.forEach(function (x) { seen[x && x.text] = 1; });
      (r.rules || []).forEach(function (x) { if (x && x.text && !seen[x.text]) { rules.push(x); seen[x.text] = 1; } });
      var daily = {}, k; for (k in r.daily) daily[k] = r.daily[k]; for (k in l.daily) daily[k] = l.daily[k];
      return { stars: maxMap(l.stars, r.stars), best: maxMap(l.best, r.best), rules: rules, daily: daily, howto: !!(l.howto || r.howto) };
    },
    write: function (m) { var d = raw(); d.stars = m.stars; d.best = m.best; d.rules = m.rules; d.daily = m.daily; d.howto = m.howto; try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } },
  });
})();
