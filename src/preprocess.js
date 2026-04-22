'use strict';

const sharp = require('sharp');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff']);

/**
 * Preprocess an image buffer for better OCR accuracy.
 * Steps: resize, greyscale, sharpen, normalize contrast, invert if dark background.
 *
 * @param {Buffer} inputBuffer - Raw image buffer
 * @param {object} options
 * @param {boolean} options.invertIfDark - Auto-invert for dark-on-light OCR
 * @returns {Promise<Buffer>} Processed PNG buffer
 */
async function preprocessForOCR(inputBuffer, options = {}) {
  const { invertIfDark = true } = options;

  let image = sharp(inputBuffer);
  const metadata = await image.metadata();

  // Resize to optimal width for OCR (max 2000px wide, keep aspect)
  const targetWidth = Math.min(metadata.width || 1200, 2000);
  image = sharp(inputBuffer)
    .resize({ width: targetWidth, withoutEnlargement: false })
    .greyscale()
    .normalize()
    .sharpen({ sigma: 1.5 });

  if (invertIfDark) {
    // Get stats to check if image is predominantly dark
    const statsBuffer = await image.clone().toBuffer();
    const stats = await sharp(statsBuffer).stats();
    const mean = stats.channels[0] ? stats.channels[0].mean : 128;

    // If mean brightness < 80, assume dark background → invert
    if (mean < 80) {
      image = image.negate();
    }
  }

  return image.png().toBuffer();
}

/**
 * Validate an uploaded file buffer and mimetype.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @throws {Error} if invalid
 */
function validateImage(buffer, mimetype) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file');
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File too large (max 10MB)');
  }
  if (!ALLOWED_MIME.has(mimetype)) {
    throw new Error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, BMP, TIFF');
  }
}

module.exports = { preprocessForOCR, validateImage };
