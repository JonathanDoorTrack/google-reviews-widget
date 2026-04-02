(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  // Override any of these via window.GoogleReviewsConfig before the script tag.
  //
  // Example:
  //   <script>
  //     window.GoogleReviewsConfig = {
  //       maxReviews: 6,
  //       minRating: 4,
  //       dateLocale: 'en-AU',
  //     };
  //   </script>
  //   <script src="https://your-app.railway.app/widget.js"></script>

  var cfg = window.GoogleReviewsConfig || {};

  var MAX_REVIEWS = cfg.maxReviews || 0;          // 0 = show all
  var MIN_RATING  = cfg.minRating  || 0;          // 0 = show all ratings
  var DATE_LOCALE = cfg.dateLocale || 'en-AU';
  var CONTAINER_ID = cfg.containerId || 'google-reviews';

  // Auto-detect the server origin from the script src so it works on any domain
  var scriptSrc = (document.currentScript && document.currentScript.src) || '';
  var DEFAULT_ENDPOINT = scriptSrc ? scriptSrc.replace(/\/widget\.js.*$/, '') : '';
  var ENDPOINT = (cfg.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '');

  // ── CSS variables (override via :root or cfg.cssVars) ──────────────────────
  var CSS_VARS = Object.assign({
    '--gr-font-family'    : 'inherit',
    '--gr-columns'        : 'repeat(auto-fill, minmax(280px, 1fr))',
    '--gr-gap'            : '1.25rem',
    '--gr-card-bg'        : '#ffffff',
    '--gr-card-radius'    : '12px',
    '--gr-card-shadow'    : '0 2px 12px rgba(0,0,0,0.08)',
    '--gr-card-padding'   : '1.25rem',
    '--gr-star-color'     : '#f5a623',
    '--gr-star-empty'     : '#d1d5db',
    '--gr-text-color'     : '#111827',
    '--gr-meta-color'     : '#6b7280',
    '--gr-avatar-bg'      : '#e5e7eb',
    '--gr-avatar-color'   : '#374151',
    '--gr-avatar-size'    : '42px',
    '--gr-link-color'     : 'inherit',
  }, cfg.cssVars || {});

  // ── Inject styles ───────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('gr-styles')) return;

    var rootVars = Object.keys(CSS_VARS).map(function (k) {
      return k + ':' + CSS_VARS[k];
    }).join(';');

    var css = [
      '#' + CONTAINER_ID + '{' + rootVars + ';font-family:var(--gr-font-family)}',

      '.gr-grid{display:grid;grid-template-columns:var(--gr-columns);gap:var(--gr-gap);margin:0;padding:0;list-style:none;justify-content:center}',

      '.gr-card{background:var(--gr-card-bg);border-radius:var(--gr-card-radius);box-shadow:var(--gr-card-shadow);padding:var(--gr-card-padding);display:flex;flex-direction:column;gap:.75rem;box-sizing:border-box}',

      '.gr-header{display:flex;align-items:center;gap:.75rem}',

      '.gr-avatar{width:var(--gr-avatar-size);height:var(--gr-avatar-size);border-radius:50%;background:var(--gr-avatar-bg);color:var(--gr-avatar-color);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:.9rem;flex-shrink:0;overflow:hidden}',
      '.gr-avatar img{width:100%;height:100%;object-fit:cover;display:block}',

      '.gr-reviewer{display:flex;flex-direction:column;gap:.1rem;min-width:0}',
      '.gr-name{font-weight:600;font-size:.95rem;color:var(--gr-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.gr-date{font-size:.78rem;color:var(--gr-meta-color)}',

      '.gr-stars{display:flex;gap:2px}',
      '.gr-star{font-size:1rem;line-height:1}',
      '.gr-star.filled{color:var(--gr-star-color)}',
      '.gr-star.empty{color:var(--gr-star-empty)}',

      '.gr-text{font-size:.88rem;color:var(--gr-text-color);line-height:1.55;margin:0;flex:1}',
      '.gr-text.truncated{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}',
      '.gr-read-more{background:none;border:none;padding:0;font-size:.8rem;color:var(--gr-meta-color);cursor:pointer;text-decoration:underline;margin-top:.25rem;align-self:flex-start}',

      '.gr-no-text{font-size:.85rem;color:var(--gr-meta-color);font-style:italic}',

      '.gr-message{padding:1.5rem;text-align:center;color:var(--gr-meta-color);font-size:.9rem}',
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'gr-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function stars(rating) {
    var el = document.createElement('div');
    el.className = 'gr-stars';
    el.setAttribute('aria-label', rating + ' out of 5 stars');
    for (var i = 1; i <= 5; i++) {
      var s = document.createElement('span');
      s.className = 'gr-star ' + (i <= rating ? 'filled' : 'empty');
      s.textContent = '★';
      el.appendChild(s);
    }
    return el;
  }

  function ratingToNumber(val) {
    if (typeof val === 'number') return val;
    var map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    return map[val] || parseInt(val, 10) || 0;
  }

  function formatDate(str) {
    if (!str) return '';
    try {
      return new Date(str).toLocaleDateString(DATE_LOCALE, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return str;
    }
  }

  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
  }

  function avatar(reviewer) {
    var wrapper = document.createElement('div');
    wrapper.className = 'gr-avatar';

    if (reviewer.profilePhotoUrl) {
      var img = document.createElement('img');
      img.src = reviewer.profilePhotoUrl;
      img.alt = reviewer.displayName || '';
      img.onerror = function () {
        wrapper.removeChild(img);
        wrapper.textContent = initials(reviewer.displayName);
      };
      wrapper.appendChild(img);
    } else {
      wrapper.textContent = initials(reviewer.displayName);
    }

    return wrapper;
  }

  // ── Card builder ─────────────────────────────────────────────────────────────

  function buildCard(review) {
    var rating = ratingToNumber(review.rating || review.starRating);
    var name   = review.authorName || (review.reviewer && review.reviewer.displayName) || 'Anonymous';
    var photo  = review.authorPhoto || (review.reviewer && review.reviewer.profilePhotoUrl) || null;
    var text   = review.text || review.comment || '';
    var date   = review.relativeTime || formatDate(review.publishTime || review.updateTime || review.createTime);

    var card = document.createElement('li');
    card.className = 'gr-card';

    // Header: avatar + name + date
    var header = document.createElement('div');
    header.className = 'gr-header';
    header.appendChild(avatar({ displayName: name, profilePhotoUrl: photo }));

    var meta = document.createElement('div');
    meta.className = 'gr-reviewer';

    var nameEl = document.createElement('div');
    nameEl.className = 'gr-name';
    nameEl.textContent = name;

    var dateEl = document.createElement('div');
    dateEl.className = 'gr-date';
    dateEl.textContent = date;

    meta.appendChild(nameEl);
    meta.appendChild(dateEl);
    header.appendChild(meta);
    card.appendChild(header);

    // Stars
    card.appendChild(stars(rating));

    // Review text
    if (text) {
      var LIMIT = 220;
      var p = document.createElement('p');
      p.className = 'gr-text';

      if (text.length > LIMIT) {
        p.className += ' truncated';
        p.textContent = text;
        card.appendChild(p);

        var btn = document.createElement('button');
        btn.className = 'gr-read-more';
        btn.textContent = 'Read more';
        btn.addEventListener('click', function () {
          if (p.classList.contains('truncated')) {
            p.classList.remove('truncated');
            btn.textContent = 'Show less';
          } else {
            p.classList.add('truncated');
            btn.textContent = 'Read more';
          }
        });
        card.appendChild(btn);
      } else {
        p.textContent = text;
        card.appendChild(p);
      }
    } else {
      var noText = document.createElement('p');
      noText.className = 'gr-no-text';
      noText.textContent = 'No written review.';
      card.appendChild(noText);
    }

    return card;
  }

  // ── Message helper ───────────────────────────────────────────────────────────

  function message(container, text) {
    container.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'gr-message';
    p.textContent = text;
    container.appendChild(p);
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  function render(data) {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) {
      console.warn('[google-reviews] No element with id="' + CONTAINER_ID + '" found.');
      return;
    }

    injectStyles();

    var reviews = (data && data.reviews) || [];
    // filter out reviews with no text or rating


    // Filter by minimum rating
    if (MIN_RATING > 0) {
      reviews = reviews.filter(function (r) {
        return ratingToNumber(r.starRating) >= MIN_RATING;
      });
    }

    // Sort newest first
    reviews.sort(function (a, b) {
      return new Date(b.updateTime || b.createTime || 0) - new Date(a.updateTime || a.createTime || 0);
    });

    // Cap results
    if (MAX_REVIEWS > 0) reviews = reviews.slice(0, MAX_REVIEWS);

    if (reviews.length === 0) {
      message(container, 'No reviews to display yet.');
      return;
    }

    var grid = document.createElement('ul');
    grid.className = 'gr-grid';

    reviews.forEach(function (review) {
      grid.appendChild(buildCard(review));
    });

    container.innerHTML = '';
    container.appendChild(grid);
  }

  // ── Fetch & bootstrap ────────────────────────────────────────────────────────

  function init() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    injectStyles();
    message(container, 'Loading reviews…');

    if (!ENDPOINT) {
      message(container, 'Could not determine reviews endpoint. Set window.GoogleReviewsConfig.endpoint.');
      return;
    }

    fetch(ENDPOINT + '/reviews')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(render)
      .catch(function (err) {
        console.error('[google-reviews] Failed to fetch reviews:', err);
        message(container, 'Reviews are temporarily unavailable. Please check back soon.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
