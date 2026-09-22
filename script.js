// Navbar scroll effect
window.addEventListener('scroll', 
  function() {
  const navbar = 
    document.getElementById('navbar');
  if (window.scrollY > 50) {
    navbar.style.background = 
      'rgba(5,5,5,0.98)';
    navbar.style.boxShadow = 
      '0 2px 20px rgba(153,69,255,0.3)';
  } else {
    navbar.style.background = 
      'rgba(5,5,5,0.95)';
    navbar.style.boxShadow = 'none';
  }
});

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]')
  .forEach(anchor => {
  anchor.addEventListener('click', 
    function(e) {
    e.preventDefault();
    const target = document.querySelector(
      this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Fade in animation on scroll
const observer = 
  new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 
          'translateY(0)';
      }
    });
  }, { threshold: 0.1 }
);

document.querySelectorAll(
  '.step, .token-card, .phase, .stat'
).forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 
    'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
