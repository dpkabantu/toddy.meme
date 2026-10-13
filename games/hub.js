'use strict';
/* ==========================================
   /games/ page behaviour (progressive: the page works without this file)
   - "New" badges and "New this week" row expire by date
   - filter buttons (appear at 6+ games)
   - search box (appears at 20+ games)
   - "Show more games" (12 at a time, appears at 13+ games)
   The cards themselves are generated from games/catalog.json by
   tools/build-games.mjs; this file never adds or removes games.
   ========================================== */
(function () {
  var d = new Date();
  var today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);

  /* 1. Expire "New" badges; drop cards from the "New this week" row once they are no longer new. */
  document.querySelectorAll('.game-tag[data-new-until]').forEach(function (el) {
    if (today > el.getAttribute('data-new-until')) el.classList.add('is-expired');
  });
  var newRow = document.querySelector('[data-row="games-new"]');
  if (newRow) {
    var anyNew = false;
    newRow.querySelectorAll('.game-card').forEach(function (card) {
      var tag = card.querySelector('.game-tag.is-new');
      var fresh = tag && !tag.classList.contains('is-expired');
      if (!fresh) card.hidden = true; else anyNew = true;
    });
    if (!anyNew) newRow.hidden = true;
  }

  /* 2. Filters, search and "Show more" on the full grid. */
  var grid = document.getElementById('games-grid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.game-card'));
  var pageSize = parseInt(grid.getAttribute('data-page-size'), 10) || 12;
  var quick = parseInt(grid.getAttribute('data-quick'), 10) || 3;
  var moreBtn = document.getElementById('games-more');
  var empty = document.getElementById('games-empty');
  var status = document.getElementById('games-status');
  var search = document.getElementById('games-search');
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll('.games-filter'));
  var filter = 'all';
  var shown = pageSize;

  function matches(card) {
    var ok = true;
    if (filter === 'daily') ok = card.getAttribute('data-daily') === 'true';
    else if (filter === 'quick') ok = Number(card.getAttribute('data-minutes')) <= quick;
    else if (filter.indexOf('category:') === 0) ok = card.getAttribute('data-category') === filter.slice(9);
    var q = search ? search.value.trim().toLowerCase() : '';
    if (ok && q) ok = (card.getAttribute('data-search') || '').indexOf(q) !== -1;
    return ok;
  }

  function render(announce) {
    var matching = cards.filter(matches);
    cards.forEach(function (c) { c.hidden = true; });
    matching.slice(0, shown).forEach(function (c) { c.hidden = false; });
    var left = matching.length - Math.min(shown, matching.length);
    if (moreBtn) {
      moreBtn.hidden = left <= 0;
      moreBtn.textContent = 'Show more games (' + left + ' more)';
    }
    if (empty) empty.hidden = matching.length > 0;
    if (status && announce) status.textContent = matching.length + (matching.length === 1 ? ' game' : ' games') + ' shown';
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filter = btn.getAttribute('data-filter');
      filterBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      shown = pageSize;
      render(true);
    });
  });
  if (search) search.addEventListener('input', function () { shown = pageSize; render(true); });
  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      var firstNew = shown;
      shown += pageSize;
      render(true);
      /* Move keyboard focus to the first newly shown game. */
      var visible = cards.filter(function (c) { return !c.hidden; });
      if (visible[firstNew]) visible[firstNew].focus();
    });
  }
  render(false);
})();
