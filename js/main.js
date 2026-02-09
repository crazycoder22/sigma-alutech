/* ============================================
   SIGMA ALUTECH - Main JavaScript
   ============================================ */

(function() {
  'use strict';

  // ---- Navigation scroll effect ----
  const nav = document.getElementById('nav');
  if (nav && !nav.classList.contains('scrolled')) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // ---- Mobile menu ----
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileOverlay = document.getElementById('mobileOverlay');

  function toggleMobileMenu() {
    const isOpen = mobileMenu.classList.contains('open');
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
    mobileOverlay.classList.toggle('open');
    document.body.classList.toggle('no-scroll', !isOpen);
  }

  function closeMobileMenu() {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    mobileOverlay.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  if (hamburger) {
    hamburger.addEventListener('click', toggleMobileMenu);
  }
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
  }

  // Close mobile menu when clicking a link
  document.querySelectorAll('.nav__mobile-link').forEach(function(link) {
    link.addEventListener('click', closeMobileMenu);
  });

  // ---- Hero slider ----
  const slides = document.querySelectorAll('.hero__slide');
  if (slides.length > 1) {
    let currentSlide = 0;
    setInterval(function() {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 5000);
  }

  // ---- Scroll reveal animations ----
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(function(el) {
      revealObserver.observe(el);
    });
  } else {
    // Fallback: show all elements
    revealElements.forEach(function(el) {
      el.classList.add('visible');
    });
  }

  // ---- Featured projects on homepage ----
  var featuredGrid = document.getElementById('featuredProjectsGrid');
  if (featuredGrid) {
    fetch('data/projects.json')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var featured = data.projects.filter(function(p) { return p.featured; }).slice(0, 6);
        var categoryMap = {};
        data.categories.forEach(function(c) { categoryMap[c.id] = c.name; });

        featured.forEach(function(project) {
          var card = document.createElement('div');
          card.className = 'project-card reveal visible';
          card.innerHTML =
            '<img class="project-card__image" src="' + project.thumbnail + '" alt="' + project.name + '" loading="lazy" onerror="this.style.background=\'var(--bg-card)\'; this.style.minHeight=\'200px\'; this.alt=\'Image coming soon\';">' +
            '<div class="project-card__overlay">' +
              '<div class="project-card__category">' + (categoryMap[project.category] || project.category) + '</div>' +
              '<div class="project-card__name">' + project.name + '</div>' +
              '<div class="project-card__meta">' + project.location + ' &bull; ' + project.year + '</div>' +
            '</div>';
          featuredGrid.appendChild(card);
        });
      })
      .catch(function(err) {
        console.log('Could not load featured projects:', err.message);
      });
  }

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

})();
