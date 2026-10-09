'use strict';

/* ==========================================
   TODDY.MEME — COMPLETE JAVASCRIPT
   ==========================================
   CHANGE from previous version:
   fadeItems selector updated to include
   '.about-body' (renamed from '.about-text'
   in latest index.html restructure).
   ALL OTHER FUNCTIONS IDENTICAL.
   ========================================== */

/* ------------------------------------------
   1. NAVBAR SCROLL EFFECT
   ------------------------------------------ */
var navbar = document.getElementById('navbar');

function handleNavbarScroll() {
  if (!navbar) return;
  if (window.scrollY > 50) {
    navbar.style.background =
      'rgba(5,5,5,0.98)';
    navbar.style.boxShadow =
      '0 2px 20px rgba(139,92,246,0.3)';
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
window.addEventListener('resize', updateActiveNav, { passive: true });

/* ------------------------------------------
   2. HAMBURGER — X anim + ESC +
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
   3. SMOOTH SCROLL — with navbar offset
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
   4. ACTIVE NAV LINK ON SCROLL
   ------------------------------------------ */
var allSections =
  document.querySelectorAll('section[id]');
var allNavAs =
  document.querySelectorAll('.nav-links a');

function updateActiveNav() {
  var scrollY  = window.pageYOffset;
  var navH     = navbar
    ? navbar.offsetHeight : 80;
  var current  = '';

  allSections.forEach(function (sec) {
    if (scrollY >=
        sec.offsetTop - navH - 50) {
      current = sec.getAttribute('id');
    }
  });

  allNavAs.forEach(function (a) {
    a.classList.remove('active');
    a.removeAttribute('aria-current');
    if (a.getAttribute('href') ===
        '#' + current) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

/* Set the correct active navigation state on first paint. */
handleNavbarScroll();

/* ------------------------------------------
   5. STAGGERED FADE-IN ON SCROLL
   CHANGE: Added '.about-body' to selector.
   .about-body is the renamed container
   (was .about-text) in the latest index.html
   where the h2 heading was moved above
   the grid for correct mobile order.
   ------------------------------------------ */
var fadeItems = document.querySelectorAll(
  '.step, .token-card, .phase, .stat, ' +
  '.trust-badge, .why-item, .faq-item, ' +
  '.about-body'
);

var fadeObserver = null;

if ('IntersectionObserver' in window) {
  fadeObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry, idx) {
        if (entry.isIntersecting) {
          setTimeout(function () {
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
} else {
  fadeItems.forEach(function (el) {
    el.classList.add('visible');
  });
}

/* ------------------------------------------
   6. SCROLL TO TOP BUTTON
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
  scrollTopBtn.addEventListener(
    'click', function () {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
}

/* ------------------------------------------
   7. FAQ ACCORDION
   One open at a time. Keyboard accessible.
   ------------------------------------------ */
var faqItems =
  document.querySelectorAll('.faq-item');

faqItems.forEach(function (item) {
  var btn =
    item.querySelector('.faq-question');
  var answer =
    item.querySelector('.faq-answer');
  if (!btn || !answer) return;

  btn.addEventListener('click',
    function () {
      var isOpen =
        item.classList.contains('open');

      /* Close all other items first */
      faqItems.forEach(function (other) {
        if (other !== item) {
          other.classList.remove('open');
          var otherBtn =
            other.querySelector('.faq-question');
          var otherAnswer =
            other.querySelector('.faq-answer');
          if (otherBtn) {
            otherBtn.setAttribute('aria-expanded', 'false');
          }
          if (otherAnswer) {
            otherAnswer.style.maxHeight = '0px';
          }
        }
      });

      /* Toggle this item */
      if (isOpen) {
        item.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = '0px';
      } else {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });

  /* Keyboard: Enter or Space */
  btn.addEventListener('keydown',
    function (e) {
      if (e.key === 'Enter' ||
          e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
});

/* ------------------------------------------
   8. SPARKLE PARTICLES
   Canvas is outside .hero — body child.
   Fixed position covers full page.
   z-index:2 — behind all sections (z:3)
   but above background.
   ------------------------------------------ */
(function initSparkles() {
  var canvas = document.getElementById('sparkle-canvas');
  if (!canvas) return;

  var motionOK = !(
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  if (!motionOK) return;

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
    if (document.hidden) {
      raf = requestAnimationFrame(draw);
      return;
    }

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

    raf = requestAnimationFrame(draw);
  }

  resize();
  seed();
  window.addEventListener('resize', resize, { passive: true });
  raf = requestAnimationFrame(draw);
})();

/* ================= TODDY PREMIUM INTERACTIONS ================= */
(function(){
  var bar=document.querySelector('#scroll-progress span');
  function progress(){if(!bar)return;var d=document.documentElement,m=d.scrollHeight-innerHeight;bar.style.width=(m>0?Math.min(100,Math.max(0,scrollY/m*100)):0)+'%'}
  addEventListener('scroll',progress,{passive:true});addEventListener('resize',progress,{passive:true});progress();
  var reduced=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bg=document.querySelector('.hero-bg');
  if(bg&&!reduced&&innerWidth>768){var busy=false;addEventListener('scroll',function(){if(busy)return;busy=true;requestAnimationFrame(function(){bg.style.transform='translate3d(0,'+Math.min(scrollY,innerHeight)*.035+'px,0)';busy=false})},{passive:true})}
  var vids=document.querySelectorAll('.hero-bg-video');
  if ('IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function(es) {
      es.forEach(function(e) {
        var v = e.target;
        if (e.isIntersecting) {
          var p = v.play();
          if (p && p.catch) p.catch(function(){});
        } else {
          v.pause();
        }
      });
    }, { threshold: .05 });
    vids.forEach(function(v) { vo.observe(v); });
  } else {
    vids.forEach(function(v) {
      var p = v.play();
      if (p && p.catch) p.catch(function(){});
    });
  }
})();
