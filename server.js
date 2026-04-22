'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { extractTextFromImage } = require('./src/ocr');
const { validateImage } = require('./src/preprocess');
const { exactLookup, fuzzySearch, getByCategory, getCategories, getAllChips, normalizeCode } = require('./src/chipDb');

const app = express();
const PORT = process.env.PORT || 3000;

// ────────────────────────────────────────────────────────────
// Security middleware
// ────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cors({ origin: false })); // Same-origin only
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ────────────────────────────────────────────────────────────
// Rate limiting
// ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached. Try again later.' },
});

app.use('/api/', apiLimiter);
app.use('/api/ocr', uploadLimiter);

// ────────────────────────────────────────────────────────────
// Multer – store uploads in memory, max 10MB
// ────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});

// ────────────────────────────────────────────────────────────
// Static files
// ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ────────────────────────────────────────────────────────────
// API Routes
// ────────────────────────────────────────────────────────────

/**
 * POST /api/ocr
 * Upload an image, run OCR, return detected tokens + chip matches.
 */
app.post('/api/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    validateImage(req.file.buffer, req.file.mimetype);

    const { tokens, rawText, confidence: ocrConfidence } = await extractTextFromImage(req.file.buffer);

    // For each token, try exact then fuzzy match
    const matches = [];
    const seen = new Set();

    for (const token of tokens) {
      const exact = exactLookup(token);
      if (exact && !seen.has(exact.id)) {
        seen.add(exact.id);
        matches.push({ chip: exact, confidence: 100, matchType: 'exact', token });
        continue;
      }

      const fuzzy = fuzzySearch(token, 3);
      for (const f of fuzzy) {
        if (!seen.has(f.chip.id) && f.confidence >= 60) {
          seen.add(f.chip.id);
          matches.push({ chip: f.chip, confidence: f.confidence, matchType: 'fuzzy', token });
        }
      }
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    return res.json({
      requestId: uuidv4(),
      ocrConfidence,
      tokens,
      rawText: rawText.substring(0, 2000), // Truncate for response size
      matches: matches.slice(0, 20),
    });
  } catch (err) {
    const status = err.message.includes('Invalid') || err.message.includes('too large') ? 400 : 500;
    return res.status(status).json({ error: err.message });
  }
});

/**
 * GET /api/search?q=<query>&limit=<n>
 * Manual text search for chip codes.
 */
app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').toString().trim().substring(0, 100);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters.' });
  }

  // Try exact first
  const exact = exactLookup(query);
  if (exact) {
    return res.json({
      query,
      results: [{ chip: exact, confidence: 100, matchType: 'exact' }],
    });
  }

  const fuzzy = fuzzySearch(query, limit);
  return res.json({
    query,
    results: fuzzy.map((f) => ({ chip: f.chip, confidence: f.confidence, matchType: 'fuzzy' })),
  });
});

/**
 * GET /api/chip/:id
 * Get a specific chip by ID or code.
 */
app.get('/api/chip/:id', (req, res) => {
  const id = (req.params.id || '').toString().trim().substring(0, 100);
  const chip = exactLookup(id);
  if (!chip) {
    return res.status(404).json({ error: 'Chip not found.' });
  }
  return res.json({ chip });
});

/**
 * GET /api/categories
 * List all chip categories.
 */
app.get('/api/categories', (_req, res) => {
  res.json({ categories: getCategories() });
});

/**
 * GET /api/chips?category=<cat>
 * List chips, optionally filtered by category.
 */
app.get('/api/chips', (req, res) => {
  const category = (req.query.category || '').toString().trim().toLowerCase();
  const chips = category ? getByCategory(category) : getAllChips();
  res.json({ total: chips.length, chips });
});

// ────────────────────────────────────────────────────────────
// SPA fallback – serve index.html for unknown routes
// ────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ────────────────────────────────────────────────────────────
// Error handler
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

// ────────────────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`Mobile IC Identifier running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

module.exports = app;
