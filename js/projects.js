/* ============================================
   SIGMA ALUTECH - Projects Page
   ============================================ */

(function() {
  'use strict';

  var projectsData = null;
  var activeCategory = 'all';
  var lightboxImages = [];
  var lightboxIndex = 0;

  // ---- Load and render projects ----
  fetch('data/projects.json')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      projectsData = data;
      buildFilters(data.categories);
      renderProjects(data.projects, 'all');
    })
    .catch(function(err) {
      console.error('Failed to load projects:', err);
    });

  // ---- Build category filter buttons ----
  function buildFilters(categories) {
    var container = document.getElementById('projectFilters');
    if (!container) return;

    categories.forEach(function(cat) {
      var btn = document.createElement('button');
      btn.className = 'filter-btn' + (cat.id === 'all' ? ' active' : '');
      btn.dataset.category = cat.id;
      btn.textContent = cat.name;
      btn.addEventListener('click', function() {
        setActiveFilter(cat.id);
      });
      container.appendChild(btn);
    });
  }

  function setActiveFilter(categoryId) {
    activeCategory = categoryId;
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.category === categoryId);
    });
    renderProjects(projectsData.projects, categoryId);
  }

  // ---- Render project cards ----
  function renderProjects(projects, filterCategory) {
    var grid = document.getElementById('projectsGrid');
    var noResults = document.getElementById('noResults');
    if (!grid) return;

    grid.innerHTML = '';
    var count = 0;

    var categoryMap = {};
    projectsData.categories.forEach(function(c) { categoryMap[c.id] = c.name; });

    // Sort by year descending
    var sorted = projects.slice().sort(function(a, b) { return b.year - a.year; });

    sorted.forEach(function(project) {
      if (filterCategory !== 'all' && project.category !== filterCategory) return;
      count++;

      var card = document.createElement('div');
      card.className = 'project-card';
      card.addEventListener('click', function() {
        openProjectModal(project, categoryMap);
      });

      card.innerHTML =
        '<img class="project-card__image" src="' + project.thumbnail + '" alt="' + project.name + '" loading="lazy" ' +
        'onerror="this.style.background=\'linear-gradient(135deg, var(--bg-card), var(--bg-secondary))\'; this.style.minHeight=\'200px\';">' +
        '<div class="project-card__overlay">' +
          '<div class="project-card__category">' + project.type + '</div>' +
          '<div class="project-card__name">' + project.name + '</div>' +
          '<div class="project-card__meta">' + project.location + ' &bull; ' + project.year + '</div>' +
        '</div>';

      grid.appendChild(card);
    });

    if (noResults) {
      noResults.style.display = count === 0 ? 'block' : 'none';
    }
  }

  // ---- Project Modal ----
  var modal = document.getElementById('projectModal');
  var backdrop = document.getElementById('projectModalBackdrop');
  var closeBtn = document.getElementById('projectModalClose');

  function openProjectModal(project, categoryMap) {
    if (!modal) return;

    // Main image
    var mainImg = document.getElementById('projModalMainImage');
    var firstImage = project.images && project.images.length > 0 ? project.images[0] : project.thumbnail;
    mainImg.src = firstImage;
    mainImg.alt = project.name;
    mainImg.onerror = function() {
      this.src = project.thumbnail;
      this.onerror = function() {
        this.style.background = 'var(--bg-card)';
        this.style.minHeight = '300px';
      };
    };

    // Make main image clickable for lightbox
    mainImg.style.cursor = 'pointer';
    mainImg.onclick = function() {
      lightboxImages = project.images && project.images.length > 0 ? project.images : [project.thumbnail];
      var clickedIndex = lightboxImages.indexOf(mainImg.src);
      openLightbox(clickedIndex >= 0 ? clickedIndex : 0);
    };

    // Gallery thumbnails
    var gallery = document.getElementById('projModalGallery');
    gallery.innerHTML = '';
    if (project.images && project.images.length > 1) {
      project.images.forEach(function(img, i) {
        var thumb = document.createElement('img');
        thumb.className = 'modal__gallery-thumb' + (i === 0 ? ' active' : '');
        thumb.src = img;
        thumb.alt = project.name + ' - Image ' + (i + 1);
        thumb.loading = 'lazy';
        thumb.onerror = function() { this.style.display = 'none'; };
        thumb.addEventListener('click', function() {
          mainImg.src = img;
          gallery.querySelectorAll('.modal__gallery-thumb').forEach(function(t) {
            t.classList.remove('active');
          });
          thumb.classList.add('active');
        });
        gallery.appendChild(thumb);
      });
    }

    // Tags
    var tags = document.getElementById('projModalTags');
    var tagHtml = '<span class="modal__tag">' + (categoryMap[project.category] || project.category) + '</span>';
    if (project.productsUsed) {
      project.productsUsed.forEach(function(p) {
        tagHtml += '<span class="modal__tag">' + p.charAt(0).toUpperCase() + p.slice(1) + '</span>';
      });
    }
    tags.innerHTML = tagHtml;

    // Title & description
    document.getElementById('projModalTitle').textContent = project.name;
    document.getElementById('projModalDescription').textContent = project.description;

    // Details
    var details = document.getElementById('projModalDetails');
    var detailsHtml = '';

    if (project.location) {
      detailsHtml += '<div><div class="modal__detail-label">Location</div><div class="modal__detail-value">' + project.location + '</div></div>';
    }
    if (project.year) {
      detailsHtml += '<div><div class="modal__detail-label">Year</div><div class="modal__detail-value">' + project.year + '</div></div>';
    }
    if (project.type) {
      detailsHtml += '<div><div class="modal__detail-label">Project Type</div><div class="modal__detail-value">' + project.type + '</div></div>';
    }
    if (project.architect) {
      detailsHtml += '<div><div class="modal__detail-label">Architect</div><div class="modal__detail-value">' + project.architect + '</div></div>';
    }
    details.innerHTML = detailsHtml;

    // Video
    var videoContainer = document.getElementById('projModalVideoContainer');
    if (project.video) {
      videoContainer.innerHTML =
        '<h4 style="margin-top: var(--space-xl); margin-bottom: var(--space-sm); color: var(--gold-primary); font-size: var(--fs-small); text-transform: uppercase; letter-spacing: var(--ls-wider);">Project Video</h4>' +
        '<div class="video-container"><iframe src="' + project.video + '" allowfullscreen loading="lazy"></iframe></div>';
    } else {
      videoContainer.innerHTML = '';
    }

    // Show modal
    modal.classList.add('open');
    backdrop.classList.add('open');
    document.body.classList.add('no-scroll');
    modal.scrollTop = 0;
  }

  function closeProjectModal() {
    if (!modal) return;
    modal.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeProjectModal);
  if (backdrop) backdrop.addEventListener('click', closeProjectModal);

  // ---- Lightbox ----
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImage');
  var lightboxCounter = document.getElementById('lightboxCounter');

  function openLightbox(index) {
    if (!lightbox || lightboxImages.length === 0) return;
    lightboxIndex = index;
    updateLightbox();
    lightbox.classList.add('open');
    // Close the project modal behind
    closeProjectModal();
    document.body.classList.add('no-scroll');
  }

  function updateLightbox() {
    lightboxImg.src = lightboxImages[lightboxIndex];
    lightboxImg.alt = 'Project image ' + (lightboxIndex + 1);
    lightboxCounter.textContent = (lightboxIndex + 1) + ' / ' + lightboxImages.length;
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  var lightboxCloseBtn = document.getElementById('lightboxClose');
  var lightboxPrev = document.getElementById('lightboxPrev');
  var lightboxNext = document.getElementById('lightboxNext');

  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
  if (lightboxPrev) {
    lightboxPrev.addEventListener('click', function() {
      lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
      updateLightbox();
    });
  }
  if (lightboxNext) {
    lightboxNext.addEventListener('click', function() {
      lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
      updateLightbox();
    });
  }

  if (lightbox) {
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (lightbox && lightbox.classList.contains('open')) {
        closeLightbox();
      } else {
        closeProjectModal();
      }
    }
    if (lightbox && lightbox.classList.contains('open')) {
      if (e.key === 'ArrowLeft') {
        lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
        updateLightbox();
      }
      if (e.key === 'ArrowRight') {
        lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
        updateLightbox();
      }
    }
  });

})();
