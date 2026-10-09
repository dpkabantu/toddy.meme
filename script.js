'use strict';

/* ==========================================
   TODDY.MEME — SITE JAVASCRIPT
   ==========================================
   Everything lives inside one function so nothing
   leaks into the global scope (important once games
   and shared platform scripts are added later).

   Sections
     1.  Navbar state (scrolled style, active link)
     2.  Mobile menu (hamburger)
     3.  Smooth anchor scrolling (accessible)
     4.  Staggered fade-in on scroll
     5.  Back-to-top button
     6.  FAQ accordion
     7.  Sparkle particles
     8.  Scroll progress bar + hero parallax
     9.  Hero video loader + pause control
     10. Image-save deterrent (casual drag/right-click)
   ========================================== */
(function () {

  /* ------------------------------------------
     Shared helpers
     ------------------------------------------ */
  var reducedMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function prefersReducedMotion() {
    return !!reducedMotionQuery.matches;
  }

  /* Run fn at most once per animation frame (keeps scrolling smooth). */
  function rafThrottle(fn) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        fn();
      });
    };
  }

  var navbar = document.getElementById('navbar');
  var scrollTopBtn = document.getElementById('scroll-top-btn');
  var allSections = document.querySelectorAll('section[id]');
  var allNavAs = document.querySelectorAll('.nav-links a');

  /* ------------------------------------------
     1. NAVBAR STATE
     Visual change is a CSS class (.scrolled) instead
     of per-scroll inline styles; see style.css.
     ------------------------------------------ */
  function updateActiveNav() {
    var scrollY = window.pageYOffset;
    var navH = navbar ? navbar.offsetHeight : 80;
    var current = '';

    allSections.forEach(function (sec) {
      if (scrollY >= sec.offsetTop - navH - 50) {
        current = sec.getAttribute('id');
      }
    });

    allNavAs.forEach(function (a) {
      var isCurrent = a.getAttribute('href') === '#' + current;
      a.classList.toggle('active', isCurrent);
      if (isCurrent) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
  }

  function handleScrollTopVisibility() {
    if (!scrollTopBtn) return;
    scrollTopBtn.classList.toggle('show', window.scrollY > 400);
  }

  function handleNavbarScroll() {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
    updateActiveNav();
    handleScrollTopVisibility();
  }

  var onScrollNav = rafThrottle(handleNavbarScroll);
  window.addEventListener('scroll', onScrollNav, { passive: true });
  window.addEventListener('resize', rafThrottle(updateActiveNav), { passive: true });

  /* Correct state on first paint (also when loading at /#faq etc.). */
  handleNavbarScroll();

  /* ------------------------------------------
     2. MOBILE MENU — X animation, Esc, outside
        click and link click close it
     ------------------------------------------ */
  var hamburgerEl = document.getElementById('hamburger');
  var navLinksEl = document.getElementById('nav-links');

  function openMenu() {
    if (!hamburgerEl || !navLinksEl) return;
    navLinksEl.classList.add('open');
    hamburgerEl.classList.add('active');
    hamburgerEl.setAttribute('aria-expanded', 'true');
    hamburgerEl.setAttribute('aria-label', 'Close Menu');
  }

  function closeMenu() {
    if (!hamburgerEl || !navLinksEl) return;
    navLinksEl.classList.remove('open');
    hamburgerEl.classList.remove('active');
    hamburgerEl.setAttribute('aria-expanded', 'false');
    hamburgerEl.setAttribute('aria-label', 'Open Menu');
  }

  if (hamburgerEl && navLinksEl) {
    hamburgerEl.addEventListener('click', function (e) {
      e.stopPropagation();
      if (navLinksEl.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    navLinksEl.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', function (e) {
      if (!navLinksEl.classList.contains('open')) return;
      if (!hamburgerEl.contains(e.target) && !navLinksEl.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!navLinksEl.classList.contains('open')) return;
      closeMenu();
      hamburgerEl.focus(); /* keyboard users land back on the menu button */
    });
  }

  /* ------------------------------------------
     3. SMOOTH ANCHOR SCROLLING
        - offsets for the fixed navbar
        - instant jump when the visitor prefers reduced motion
        - moves keyboard focus to the target section
        - keeps the URL hash shareable (no extra history entries)
     ------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (!href || href === '#') return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();

      var navH = navbar ? navbar.offsetHeight : 80;
      var top = target.getBoundingClientRect().top + window.pageYOffset - navH;
      window.scrollTo({
        top: top,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });

      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      try { target.focus({ preventScroll: true }); } catch (err) { /* old browser */ }

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', href);
      }
    });
  });

  /* ------------------------------------------
     4. STAGGERED FADE-IN ON SCROLL
     ------------------------------------------ */
  var fadeItems = document.querySelectorAll(
    '.step, .token-card, .phase, .stat, ' +
    '.trust-badge, .why-item, .faq-item, ' +
    '.about-body, .official-links'
  );

  if ('IntersectionObserver' in window && !prefersReducedMotion()) {
    var fadeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, idx) {
          if (entry.isIntersecting) {
            window.setTimeout(function () {
              entry.target.classList.add('visible');
              fadeObserver.unobserve(entry.target);
            }, idx * 70);
          }
        });
      },
      { threshold: 0.08 }
    );

    fadeItems.forEach(function (el) {
      el.classList.add('td-fade');
      fadeObserver.observe(el);
    });
  }
  /* Without IntersectionObserver, or with reduced motion, items are simply
     shown: nothing gets the hidden .td-fade class in the first place. */

  /* ------------------------------------------
     5. BACK-TO-TOP BUTTON
     ------------------------------------------ */
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    });
  }

  /* ------------------------------------------
     6. FAQ ACCORDION
        One open at a time. The questions are real
        <button>s, so Enter and Space already work
        natively (no extra key handler needed — the
        old one could double-toggle in some browsers).
     ------------------------------------------ */
  var faqItems = document.querySelectorAll('.faq-item');

  function setFaq(item, open) {
    var btn = item.querySelector('.faq-question');
    var answer = item.querySelector('.faq-answer');
    if (!btn || !answer) return;
    item.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    answer.style.maxHeight = open ? answer.scrollHeight + 'px' : '0px';
  }

  faqItems.forEach(function (item) {
    var btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var willOpen = !item.classList.contains('open');
      faqItems.forEach(function (other) {
        if (other !== item) setFaq(other, false);
      });
      setFaq(item, willOpen);
    });
  });

  /* Keep an open answer the right height if the window is resized. */
  window.addEventListener('resize', rafThrottle(function () {
    faqItems.forEach(function (item) {
      if (item.classList.contains('open')) setFaq(item, true);
    });
  }), { passive: true });

  /* ------------------------------------------
     7. SPARKLE PARTICLES
        Decorative canvas behind the content. Skipped
        entirely for reduced-motion visitors and paused
        while the tab is hidden.
     ------------------------------------------ */
  (function initSparkles() {
    var canvas = document.getElementById('sparkle-canvas');
    if (!canvas || prefersReducedMotion()) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var W = 0, H = 0;
    var TOTAL = window.innerWidth <= 768 ? 24 : 60;
    var pts = [];
    var raf = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function mkPt(atBottom) {
      return {
        x: Math.random() * W,
        y: atBottom ? H + 4 : Math.random() * H,
        r: Math.random() * 2.2 + 0.6,
        vx: (Math.random() - 0.5) * 0.38,
        vy: -(Math.random() * 0.6 + 0.18),
        o: Math.random() * 0.6 + 0.12,
        d: Math.random() * 0.0025 + 0.001,
        gold: Math.random() > 0.5
      };
    }

    function seed() {
      pts.length = 0;
      for (var i = 0; i < TOTAL; i++) pts.push(mkPt(false));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        p.x += p.vx;
        p.y += p.vy;
        p.o -= p.d;

        if (p.o <= 0 || p.y < -8) {
          pts[j] = mkPt(true);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold
          ? 'rgba(255,215,0,' + p.o + ')'
          : 'rgba(139,92,246,' + p.o + ')';
        ctx.fill();
      }

      raf = window.requestAnimationFrame(draw);
    }

    function start() {
      if (!raf) raf = window.requestAnimationFrame(draw);
    }

    function stop() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    }

    resize();
    seed();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { start(); }
    });
    start();
  })();

  /* ------------------------------------------
     8. SCROLL PROGRESS BAR + HERO PARALLAX
     ------------------------------------------ */
  (function initScrollEffects() {
    var bar = document.querySelector('#scroll-progress span');
    var bg = document.querySelector('.hero-bg');

    var update = rafThrottle(function () {
      if (bar) {
        var d = document.documentElement;
        var m = d.scrollHeight - window.innerHeight;
        var pct = m > 0 ? Math.min(100, Math.max(0, window.scrollY / m * 100)) : 0;
        bar.style.width = pct + '%';
      }
      if (bg && !prefersReducedMotion() && window.innerWidth > 768) {
        bg.style.transform =
          'translate3d(0,' + Math.min(window.scrollY, window.innerHeight) * 0.035 + 'px,0)';
      }
    });

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  })();

  /* ------------------------------------------
     9. HERO VIDEO LOADER + PAUSE CONTROL
        - loads ONLY the video that fits the screen
        - waits until the page has finished loading, so the
          poster image, text and fonts are never held up by video
        - no video for reduced-motion or Data Saver
          visitors: the poster image stays instead
        - visible pause/play button (WCAG 2.2.2)
     ------------------------------------------ */
  (function initHeroVideo() {
    var vids = document.querySelectorAll('.hero-bg-video');
    if (!vids.length) return;

    var toggle = document.getElementById('hero-motion-toggle');
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    var saveData = conn.saveData === true;
    var mobileQuery = window.matchMedia('(max-width: 768px)');
    var userPaused = false;
    var started = false;

    if (prefersReducedMotion() || saveData) return;

    function activeVideo() {
      return document.querySelector(
        mobileQuery.matches ? '.hero-bg-video-mobile' : '.hero-bg-video-desktop'
      );
    }

    function loadSources(v) {
      if (v.getAttribute('data-loaded')) return;
      v.setAttribute('data-loaded', '1');
      var base = v.getAttribute('data-src-base');
      var formats = (v.getAttribute('data-formats') || 'mp4').split(',');
      formats.forEach(function (f) {
        var s = document.createElement('source');
        s.src = base + '.' + f;
        s.type = f === 'webm' ? 'video/webm' : 'video/mp4';
        v.appendChild(s);
      });
      v.load();
    }

    function playVideo(v) {
      if (userPaused) return;
      loadSources(v);
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked: poster stays */ });
    }

    function syncToggle(isPlaying) {
      if (!toggle) return;
      toggle.hidden = false;
      toggle.classList.toggle('is-paused', !isPlaying);
      toggle.setAttribute('aria-pressed', isPlaying ? 'false' : 'true');
      toggle.setAttribute(
        'aria-label',
        isPlaying ? 'Pause background video' : 'Play background video'
      );
    }

    vids.forEach(function (v) {
      v.addEventListener('playing', function () {
        if (v === activeVideo()) syncToggle(true);
      });
    });

    var observer = null;
    function observeActive() {
      if (!('IntersectionObserver' in window)) { playVideo(activeVideo()); return; }
      if (observer) observer.disconnect();
      var current = activeVideo();
      vids.forEach(function (v) { if (v !== current) v.pause(); });
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { playVideo(e.target); } else { e.target.pause(); }
        });
      }, { threshold: 0.05 });
      observer.observe(current);
    }

    function start() {
      if (started) return;
      started = true;
      observeActive();
      var onChange = function () { if (started) observeActive(); };
      if (mobileQuery.addEventListener) {
        mobileQuery.addEventListener('change', onChange);
      } else if (mobileQuery.addListener) {
        mobileQuery.addListener(onChange);
      }
    }

    if (toggle) {
      toggle.addEventListener('click', function () {
        var v = activeVideo();
        if (!v) return;
        if (userPaused) {
          userPaused = false;
          playVideo(v);
        } else {
          userPaused = true;
          v.pause();
          syncToggle(false);
        }
      });
    }

    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start);
    }
  })();

  /* ------------------------------------------
     10. IMAGE-SAVE DETERRENT
         Blocks casual right-click / drag / select on images.
         (This only deters casual saving — anything shown in a
         browser can still be captured — and it never affects
         links, buttons or keyboard use.)
     ------------------------------------------ */
  (function initImageProtection() {
    function isImageTarget(target) {
      return target && target.closest && target.closest('img');
    }
    ['contextmenu', 'dragstart', 'selectstart'].forEach(function (type) {
      document.addEventListener(type, function (e) {
        if (isImageTarget(e.target)) e.preventDefault();
      }, true);
    });
  })();

})();
