/* ============================================
   SIGMA ALUTECH - Products Page
   ============================================ */

(function() {
  'use strict';

  var productsData = null;
  var activeCategory = 'all';

  // ---- Load and render products ----
  fetch('data/products.json')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      productsData = data;
      buildFilters(data.categories);
      renderProducts(data.categories, 'all');

      // Check URL hash for category
      var hash = window.location.hash.replace('#', '');
      if (hash && data.categories.some(function(c) { return c.id === hash; })) {
        setActiveFilter(hash);
      }
    })
    .catch(function(err) {
      console.error('Failed to load products:', err);
    });

  // ---- Build category filter buttons ----
  function buildFilters(categories) {
    var container = document.getElementById('productFilters');
    if (!container) return;

    categories.forEach(function(cat) {
      var btn = document.createElement('button');
      btn.className = 'filter-btn';
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
    renderProducts(productsData.categories, categoryId);
    // Update hash without scroll
    history.replaceState(null, '', categoryId === 'all' ? 'products.html' : '#' + categoryId);
  }

  // ---- Render product cards ----
  function renderProducts(categories, filterCategory) {
    var grid = document.getElementById('productsGrid');
    var noResults = document.getElementById('noResults');
    if (!grid) return;

    grid.innerHTML = '';
    var count = 0;

    categories.forEach(function(category) {
      if (filterCategory !== 'all' && category.id !== filterCategory) return;

      category.products.forEach(function(product) {
        count++;
        var card = document.createElement('div');
        card.className = 'card';
        card.addEventListener('click', function() {
          openProductModal(product, category.name);
        });

        var imgSrc = product.images && product.images.length > 0 ? product.images[0] : '';
        var topologyLabel = product.topology.replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });

        card.innerHTML =
          '<img class="card__image" src="' + imgSrc + '" alt="' + product.name + '" loading="lazy" ' +
          'onerror="this.style.background=\'linear-gradient(135deg, var(--bg-card), var(--bg-secondary))\'; this.style.minHeight=\'200px\'; this.alt=\'Image coming soon\';">' +
          '<div class="card__body">' +
            '<span class="card__badge">' + topologyLabel + '</span>' +
            '<h3 class="card__title">' + product.name + '</h3>' +
            '<p class="card__text">' + product.tagline + '</p>' +
            '<div class="product-card__features">' +
              product.finishes.slice(0, 3).map(function(f) {
                return '<span class="product-card__feature-tag">' + f + '</span>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="card__footer">' +
            '<span class="card__link">View Details <span class="arrow">&rarr;</span></span>' +
            (product.video ? '<span style="font-size:var(--fs-xs); color:var(--text-muted);">&#9654; Video</span>' : '') +
          '</div>';

        grid.appendChild(card);
      });
    });

    if (noResults) {
      noResults.style.display = count === 0 ? 'block' : 'none';
    }
  }

  // ---- Product Modal ----
  var modal = document.getElementById('productModal');
  var backdrop = document.getElementById('productModalBackdrop');
  var closeBtn = document.getElementById('productModalClose');

  function openProductModal(product, categoryName) {
    if (!modal) return;

    // Main image
    var mainImg = document.getElementById('modalMainImage');
    if (product.images && product.images.length > 0) {
      mainImg.src = product.images[0];
      mainImg.onerror = function() {
        this.style.background = 'var(--bg-card)';
        this.style.minHeight = '300px';
      };
    }
    mainImg.alt = product.name;

    // Gallery thumbnails
    var gallery = document.getElementById('modalGallery');
    gallery.innerHTML = '';
    if (product.images && product.images.length > 1) {
      product.images.forEach(function(img, i) {
        var thumb = document.createElement('img');
        thumb.className = 'modal__gallery-thumb' + (i === 0 ? ' active' : '');
        thumb.src = img;
        thumb.alt = product.name + ' - Image ' + (i + 1);
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
    var tags = document.getElementById('modalTags');
    var topologyLabel = product.topology.replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
    tags.innerHTML =
      '<span class="modal__tag">' + categoryName + '</span>' +
      '<span class="modal__tag">' + topologyLabel + '</span>' +
      '<span class="modal__tag">' + product.series + '</span>';

    // Title & description
    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalDescription').textContent = product.description;

    // Features
    var featureList = document.getElementById('modalFeatures');
    featureList.innerHTML = product.features.map(function(f) {
      return '<li>' + f + '</li>';
    }).join('');

    // Specifications
    var specsTable = document.getElementById('modalSpecs');
    specsTable.innerHTML = '';
    if (product.specifications) {
      Object.keys(product.specifications).forEach(function(key) {
        var row = specsTable.insertRow();
        row.innerHTML = '<td>' + key + '</td><td>' + product.specifications[key] + '</td>';
      });
    }

    // Finishes
    var finishes = document.getElementById('modalFinishes');
    finishes.innerHTML = product.finishes.map(function(f) {
      return '<span class="finish-swatch">' + f + '</span>';
    }).join('');

    // Video
    var videoContainer = document.getElementById('modalVideoContainer');
    if (product.video) {
      videoContainer.innerHTML =
        '<h4 style="margin-top: var(--space-xl); margin-bottom: var(--space-sm); color: var(--gold-primary); font-size: var(--fs-small); text-transform: uppercase; letter-spacing: var(--ls-wider);">Product Video</h4>' +
        '<div class="video-container"><iframe src="' + product.video + '" allowfullscreen loading="lazy"></iframe></div>';
    } else {
      videoContainer.innerHTML = '';
    }

    // Show modal
    modal.classList.add('open');
    backdrop.classList.add('open');
    document.body.classList.add('no-scroll');
    modal.scrollTop = 0;
  }

  function closeProductModal() {
    if (!modal) return;
    modal.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeProductModal);
  if (backdrop) backdrop.addEventListener('click', closeProductModal);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeProductModal();
  });

  // Listen for hash changes
  window.addEventListener('hashchange', function() {
    var hash = window.location.hash.replace('#', '');
    if (hash && productsData && productsData.categories.some(function(c) { return c.id === hash; })) {
      setActiveFilter(hash);
    }
  });

})();
