/* browse.js – Browse all chips with filtering */

(function () {
  'use strict';

  const filterBar    = document.getElementById('filter-bar');
  const chipsGrid    = document.getElementById('chips-grid');
  const totalCountEl = document.getElementById('total-count');
  const browseSearch = document.getElementById('browse-search');

  let allChips = [];
  let activeCategory = 'all';
  let searchQuery = '';

  async function loadChips() {
    try {
      const res = await fetch('/api/chips');
      const data = await res.json();
      allChips = data.chips || [];
      buildFilterBar(data.chips);
      renderChips();
    } catch (e) {
      if (chipsGrid) chipsGrid.innerHTML = '<div class="alert alert-error">⚠️ Failed to load chip database.</div>';
    }
  }

  function buildFilterBar(chips) {
    if (!filterBar) return;
    const categories = ['all', ...new Set(chips.map((c) => c.category))];
    const labels = { all: 'All Chips' };
    filterBar.innerHTML = categories.map((cat) => `
      <button class="filter-chip ${cat === 'all' ? 'active' : ''}" data-cat="${escapeHtml(cat)}">
        ${escapeHtml(labels[cat] || getCategoryLabel(cat))}
      </button>`).join('');

    filterBar.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBar.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.cat;
        renderChips();
      });
    });
  }

  function renderChips() {
    if (!chipsGrid) return;
    let filtered = allChips;

    if (activeCategory !== 'all') {
      filtered = filtered.filter((c) => c.category === activeCategory);
    }

    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q) ||
        (c.aliases || []).some((a) => a.toLowerCase().includes(q))
      );
    }

    if (totalCountEl) totalCountEl.textContent = `${filtered.length} chip${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
      chipsGrid.innerHTML = '<div class="alert alert-info">ℹ️ No chips found for this filter.</div>';
      return;
    }

    chipsGrid.innerHTML = filtered.map((c) => buildChipCard(c, null, null)).join('');
    attachChipCardHandlers(chipsGrid);
  }

  if (browseSearch) {
    browseSearch.addEventListener('input', () => {
      searchQuery = browseSearch.value.trim();
      renderChips();
    });
  }

  loadChips();
})();
