'use strict';

/* ==========================================
   TODDY.MEME — LINKS PAGE JAVASCRIPT
   Moved out of linktree.html (a strict
   Content-Security-Policy forbids inline
   scripts). Behaviour is unchanged except that
   the sparkles now also stop for visitors who
   prefer reduced motion and while the tab is
   hidden.
   ========================================== */
(function () {

  /* ---- Sparkle particles — matching main site ---- */
  (function initSparkles() {
    var canvas = document.getElementById('lt-canvas');
    if (!canvas) return;
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var W, H, raf = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    var pts = [];
    var TOTAL = window.innerWidth <= 600 ? 18 : 50;

    function mkPt() {
      return {
        x: Math.random() * W,
        y: H + 4,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(Math.random() * 0.55 + 0.15),
        o: Math.random() * 0.55 + 0.1,
        d: Math.random() * 0.0022 + 0.001,
        gold: Math.random() > 0.5
      };
    }

    /* Seed across full page height */
    for (var i = 0; i < TOTAL; i++) {
      var p = mkPt();
      p.y = Math.random() * H;
      pts.push(p);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var j = 0; j < pts.length; j++) {
        var q = pts[j];
        q.x += q.vx;
        q.y += q.vy;
        q.o -= q.d;
        if (q.o <= 0 || q.y < -8) {
          pts[j] = mkPt();
          continue;
        }
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fillStyle = q.gold
          ? 'rgba(255,215,0,' + q.o + ')'
          : 'rgba(139,92,246,' + q.o + ')';
        ctx.fill();
      }
      raf = window.requestAnimationFrame(draw);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = window.requestAnimationFrame(draw);
      }
    });
    raf = window.requestAnimationFrame(draw);
  })();

  /* ---- Image-save deterrent (casual drag / right-click only) ---- */
  function isImageTarget(target) {
    return target && target.closest && target.closest('img');
  }
  ['contextmenu', 'dragstart', 'selectstart'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (isImageTarget(e.target)) e.preventDefault();
    }, true);
  });

})();
