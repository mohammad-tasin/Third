/* search.js – Manual code search page logic */

(function () {
  'use strict';

  const searchInput  = document.getElementById('search-input');
  const searchBtn    = document.getElementById('search-btn');
  const resultsCards = document.getElementById('results-cards');
  const resultsEl    = document.getElementById('results-section');
  const countEl      = document.getElementById('results-count');
  const loadingEl    = document.getElementById('search-loading');

  // Pre-fill from URL ?q=
  const urlParams = new URLSearchParams(window.location.search);
  const preQuery  = urlParams.get('q') || '';
  if (preQuery && searchInput) {
    searchInput.value = preQuery;
    performSearch(preQuery);
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => performSearch(searchInput.value));
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch(searchInput.value);
    });
  }

  async function performSearch(query) {
    query = (query || '').trim();
    if (!query || query.length < 2) {
      showAlert('search-alert', 'info', 'Please enter at least 2 characters to search.');
      return;
    }

    clearAlert('search-alert');
    loadingEl.classList.remove('hidden');
    resultsEl.classList.add('hidden');
    searchBtn.disabled = true;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Search failed');

      renderSearchResults(data);

      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set('q', query);
      window.history.replaceState({}, '', url);
    } catch (err) {
      showAlert('search-alert', 'error', err.message);
    } finally {
      loadingEl.classList.add('hidden');
      searchBtn.disabled = false;
    }
  }

  function renderSearchResults(data) {
    const results = data.results || [];

    if (results.length === 0) {
      resultsCards.innerHTML = `
        <div class="alert alert-info">
          ℹ️ No results for "<strong>${escapeHtml(data.query)}</strong>".
          <br>Try a shorter code, part number, or manufacturer name.
        </div>`;
    } else {
      resultsCards.innerHTML = results
        .map((r) => buildChipCard(r.chip, r.confidence, r.matchType))
        .join('');
      attachChipCardHandlers(resultsCards);
    }

    if (countEl) {
      countEl.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for "${data.query}"`;
    }

    resultsEl.classList.remove('hidden');
  }
})();
