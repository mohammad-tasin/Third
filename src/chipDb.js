'use strict';

const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

let chips = [];
let fuse = null;

function loadChips() {
  const dbPath = path.join(__dirname, '..', 'data', 'chips.json');
  chips = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  fuse = new Fuse(chips, {
    keys: [
      { name: 'code', weight: 2 },
      { name: 'aliases', weight: 1.5 },
      { name: 'name', weight: 1 },
      { name: 'id', weight: 1.5 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

loadChips();

/**
 * Normalize a chip code string.
 * Removes whitespace, makes uppercase, removes common OCR noise characters.
 */
function normalizeCode(raw) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, '')
    .trim();
}

/**
 * Exact lookup by id or code.
 */
function exactLookup(code) {
  const norm = normalizeCode(code);
  return chips.find(
    (c) =>
      normalizeCode(c.code) === norm ||
      normalizeCode(c.id) === norm ||
      c.aliases.some((a) => normalizeCode(a) === norm)
  ) || null;
}

/**
 * Fuzzy search.
 * Returns array of { chip, score } sorted by score ascending (lower = better).
 */
function fuzzySearch(query, limit = 10) {
  if (!fuse) return [];
  const results = fuse.search(normalizeCode(query), { limit });
  return results.map((r) => ({
    chip: r.item,
    score: r.score,
    confidence: Math.round((1 - r.score) * 100),
  }));
}

/**
 * Search chips by category.
 */
function getByCategory(category) {
  return chips.filter((c) => c.category === category.toLowerCase());
}

/**
 * Get all categories.
 */
function getCategories() {
  const cats = new Set(chips.map((c) => c.category));
  return Array.from(cats);
}

/**
 * Get all chips.
 */
function getAllChips() {
  return chips;
}

module.exports = {
  exactLookup,
  fuzzySearch,
  normalizeCode,
  getByCategory,
  getCategories,
  getAllChips,
};
