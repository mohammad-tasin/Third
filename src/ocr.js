'use strict';

const Tesseract = require('tesseract.js');
const { preprocessForOCR } = require('./preprocess');

// Tesseract scheduler (lazy init, reused across requests)
let scheduler = null;
let workerPool = [];
const POOL_SIZE = 2;

async function getScheduler() {
  if (scheduler) return scheduler;

  scheduler = Tesseract.createScheduler();

  for (let i = 0; i < POOL_SIZE; i++) {
    const worker = await Tesseract.createWorker('eng', 1, {
      // Silence verbose logging
      logger: () => {},
    });
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/',
      preserve_interword_spaces: '0',
    });
    scheduler.addWorker(worker);
    workerPool.push(worker);
  }

  return scheduler;
}

/**
 * Extract text tokens from an image buffer using Tesseract OCR.
 * Returns an array of candidate chip codes (normalized, uppercase).
 *
 * @param {Buffer} imageBuffer - Raw image buffer (JPEG/PNG etc.)
 * @returns {Promise<{tokens: string[], rawText: string, confidence: number}>}
 */
async function extractTextFromImage(imageBuffer) {
  // Preprocess image for better OCR
  let processedBuffer;
  try {
    processedBuffer = await preprocessForOCR(imageBuffer);
  } catch (_) {
    // Fall back to original if preprocessing fails
    processedBuffer = imageBuffer;
  }

  const sched = await getScheduler();
  const { data } = await sched.addJob('recognize', processedBuffer);

  const rawText = data.text || '';
  const confidence = Math.round(data.confidence || 0);

  // Extract candidate tokens: uppercase alphanumeric strings 4+ chars
  const tokens = extractCandidateTokens(rawText);

  return { tokens, rawText, confidence };
}

/**
 * Extract candidate chip code tokens from raw OCR text.
 * Applies heuristics to find likely IC codes.
 */
function extractCandidateTokens(rawText) {
  // Split on whitespace/newlines/commas
  const words = rawText
    .toUpperCase()
    .split(/[\s,;:\n\r\t|]+/)
    .map((w) => w.replace(/[^A-Z0-9\-_/]/g, '').trim())
    .filter((w) => w.length >= 4 && w.length <= 30);

  // Remove pure number-only tokens shorter than 6 chars (likely noise)
  const filtered = words.filter((w) => {
    const isAllDigits = /^\d+$/.test(w);
    return !isAllDigits || w.length >= 6;
  });

  // Deduplicate
  return [...new Set(filtered)];
}

/**
 * Gracefully shut down the Tesseract worker pool.
 */
async function shutdownOCR() {
  if (scheduler) {
    await scheduler.terminate();
    scheduler = null;
    workerPool = [];
  }
}

module.exports = { extractTextFromImage, extractCandidateTokens, shutdownOCR };
