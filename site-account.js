// Puts the account button in the website header (left of "Enter the Night Shift"). Quiet-fails if accounts are off.
(function () {
  'use strict';
  var ui = window.ToddyAccountUI, slot = document.getElementById('site-account-slot');
  if (!ui || !ui.mountSite || !slot) return;
  var nav = slot.parentNode; nav.removeChild(slot);
  ui.mountSite(nav, document.querySelector('.navbar .nav-btn'));
})();
