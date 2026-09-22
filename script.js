/* ==========================================
   TODDY.MEME — COMPLETE JAVASCRIPT
   Clean single file — no duplicates
   ========================================== */

'use strict';

/* ------------------------------------------
   1. NAVBAR SCROLL EFFECT — PRESERVED
   ------------------------------------------ */
var navbar = document.getElementById('navbar');

function handleNavbarScroll() {
  if (!navbar) return;
  if (window.scrollY > 50) {
    navbar.style.background =
      'rgba(5,5,5,0.98)';
    navbar.style.boxShadow =
      '0 2px 20px rgba(153,69,255,0.3)';
    navbar.style.borderBottomColor =
      'rgba(201,168,76,0.5)';
  } else {
    navbar.style.background =
      'rgba(5,5,5,0.95)';
    navbar.style.boxShadow = 'none';
    navbar.style.borderBottomColor =
      'rgba(201,168,76,0.3)';
  }
  updateActiveNav();
  handleScrollTopVisibility();
}

window.addEventListener(
  'scroll', handleNavbarScroll,
  { passive: true }
);

/* ------------------------------------------
   2. HAMBURGER — FIXED: X anim + ESC +
      outside-click + link-click close
   ------------------------------------------ */
var hamburgerEl =
  document.getElementById('hamburger');
var navLinksEl =
  document.getElementById('nav-links');

function openMenu() {
  if (!hamburgerEl || !navLinksEl) return;
  navLinksEl.classList.add('open');
  hamburgerEl.classList.add('active');
  hamburgerEl.setAttribute(
    'aria-expanded', 'true');
  hamburgerEl.setAttribute(
    'aria-label', 'Close Menu');
}

function closeMenu() {
  if (!hamburgerEl || !navLinksEl) return;
  navLinksEl.classList.remove('open');
  hamburgerEl.classList.remove('active');
  hamburgerEl.setAttribute(
    'aria-expanded', 'false');
  hamburgerEl.setAttribute(
    'aria-label', 'Open Menu');
}

if (hamburgerEl && navLinksEl) {

  hamburgerEl.addEventListener('click',
    function (e) {
      e.stopPropagation();
      navLinksEl.classList.contains('open')
        ? closeMenu()
        : openMenu();
    });

  navLinksEl.querySelectorAll('a')
    .forEach(function (link) {
      link.addEventListener(
        'click', closeMenu);
    });

  document.addEventListener('click',
    function (e) {
      if (!navLinksEl.classList
          .contains('open')) return;
      if (!hamburgerEl.contains(e.target) &&
          !navLinksEl.contains(e.target)) {
        closeMenu();
      }
    });

  document.addEventListener('keydown',
    function (e) {
      if (e.key === 'Escape') closeMenu();
    });
}

/* ------------------------------------------
   3. SMOOTH SCROLL — PRESERVED + offset fix
   ------------------------------------------ */
document.querySelectorAll('a[href^="#"]')
  .forEach(function (anchor) {
    anchor.addEventListener('click',
      function (e) {
        var href = this.getAttribute('href');
        if (!href || href === '#') return;
        var target =
          document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        var navH = navbar
          ? navbar.offsetHeight : 80;
        var top =
          target.getBoundingClientRect().top +
          window.pageYOffset - navH;
        window.scrollTo({
          top: top,
          behavior: 'smooth'
        });
      });
  });

/* ------------------------------------------
   4. ACTIVE NAV LINK ON SCROLL — NEW
   ------------------------------------------ */
var allSections =
  document.querySelectorAll('section[id]');
var allNavAs =
  document.querySelectorAll('.nav-links a');

function updateActiveNav() {
  var scrollY = window.pageYOffset;
  var navH = navbar
    ? navbar.offsetHeight : 80;
  var current = '';

  allSections.forEach(function (sec) {
    var top = sec.offsetTop - navH - 50;
    if (scrollY >= top) {
      current = sec.getAttribute('id');
    }
  });

  allNavAs.forEach(function (a) {
    a.classList.remove('active');
    if (a.getAttribute('href') ===
        '#' + current) {
      a.classList.add('active');
    }
  });
}

/* ------------------------------------------
   5. FADE-IN ON SCROLL — PRESERVED +
      staggered delay added
   ------------------------------------------ */
var fadeItems = document.querySelectorAll(
  '.step, .token-card, .phase, .stat'
);

var fadeObserver = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry, idx) {
      if (entry.isIntersecting) {
        var delay = idx * 80;
        setTimeout(function () {
          entry.target.classList
            .add('visible');
          fadeObserver.unobserve(entry.target);
        }, delay);
      }
    });
  },
  { threshold: 0.1 }
);

fadeItems.forEach(function (el) {
  el.classList.add('td-fade');
  fadeObserver.observe(el);
});

/* ------------------------------------------
   6. SCROLL TO TOP BUTTON — NEW
   ------------------------------------------ */
var scrollTopBtn =
  document.getElementById('scroll-top-btn');

function handleScrollTopVisibility() {
  if (!scrollTopBtn) return;
  if (window.scrollY > 400) {
    scrollTopBtn.classList.add('show');
  } else {
    scrollTopBtn.classList.remove('show');
  }
}

if (scrollTopBtn) {
  scrollTopBtn.addEventListener('click',
    function () {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
}

/* ------------------------------------------
   7. COPY CA + TOAST — NEW
   ------------------------------------------ */
var copyBtn =
  document.getElementById('copy-btn');
var caTextEl =
  document.getElementById('ca-text');
var toastEl =
  document.getElementById('toast');
var toastTimer = null;

function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toastEl.classList.remove('show');
  }, 2600);
}

if (copyBtn && caTextEl) {
  copyBtn.addEventListener('click',
    function () {
      var txt =
        caTextEl.textContent.trim();
      if (/tba/i.test(txt)) {
        showToast('🌙 CA drops at launch!');
        return;
      }
      if (navigator.clipboard &&
          navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt)
          .then(function () {
            showToast('✅ CA copied!');
          })
          .catch(function () {
            legacyCopy(txt);
          });
      } else {
        legacyCopy(txt);
      }
    });
}

function legacyCopy(text) {
  var ta =
    document.createElement('textarea');
  ta.value = text;
  ta.style.cssText =
    'position:fixed;opacity:0;top:0;';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('✅ CA copied!');
  } catch (e) {
    showToast('⚠️ Copy failed');
  }
  document.body.removeChild(ta);
}

/* ------------------------------------------
   8. GOLD + PURPLE SPARKLE PARTICLES — NEW
      Single canvas, clean code
      (Removed duplicate inline versions)
   ------------------------------------------ */
(function initSparkles() {
  var canvas =
    document.getElementById('sparkle-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener(
    'resize', resize, { passive: true });

  var TOTAL = 60;
  var pts = [];

  function mkPt(atBottom) {
    return {
      x:  Math.random() * W,
      y:  atBottom
          ? H + 4
          : Math.random() * H,
      r:  Math.random() * 2.2 + 0.6,
      vx: (Math.random() - 0.5) * 0.38,
      vy: -(Math.random() * 0.6 + 0.18),
      o:  Math.random() * 0.6 + 0.12,
      d:  Math.random() * 0.0025 + 0.001,
      gold: Math.random() > 0.5
    };
  }

  for (var i = 0; i < TOTAL; i++) {
    pts.push(mkPt(false));
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
      ctx.arc(
        p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.gold
        ? 'rgba(255,215,0,' + p.o + ')'
        : 'rgba(153,69,255,' + p.o + ')';
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  draw();
})();
