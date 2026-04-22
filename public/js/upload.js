/* upload.js – Image upload + OCR page logic */

(function () {
  'use strict';

  let selectedFile = null;

  const dropZone     = document.getElementById('drop-zone');
  const fileInput    = document.getElementById('file-input');
  const previewWrap  = document.getElementById('image-preview-wrap');
  const previewImg   = document.getElementById('image-preview');
  const clearBtn     = document.getElementById('image-clear-btn');
  const analyzeBtn   = document.getElementById('analyze-btn');
  const loadingEl    = document.getElementById('ocr-loading');
  const resultsEl    = document.getElementById('results-section');
  const tokensWrap   = document.getElementById('detected-tokens');
  const resultsCards = document.getElementById('results-cards');
  const rawTextEl    = document.getElementById('raw-text');
  const rawToggle    = document.getElementById('raw-text-toggle');
  const ocrConfEl    = document.getElementById('ocr-confidence');
  const countEl      = document.getElementById('results-count');

  // ── Drop zone ────────────────────────────────────────────

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearFile();
    });
  }

  function handleFile(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'];
    if (!allowed.includes(file.type)) {
      showAlert('upload-alert', 'error', 'Invalid file type. Please upload a JPEG, PNG, WebP, GIF, BMP, or TIFF image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showAlert('upload-alert', 'error', 'File is too large. Maximum size is 10MB.');
      return;
    }

    clearAlert('upload-alert');
    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      dropZone.classList.add('hidden');
      previewWrap.classList.remove('hidden');
      analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    previewImg.src = '';
    dropZone.classList.remove('hidden');
    previewWrap.classList.add('hidden');
    analyzeBtn.disabled = true;
    resultsEl.classList.add('hidden');
    clearAlert('upload-alert');
  }

  // ── Analyze button ────────────────────────────────────────

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', analyzeImage);
  }

  async function analyzeImage() {
    if (!selectedFile) return;

    analyzeBtn.disabled = true;
    loadingEl.classList.remove('hidden');
    resultsEl.classList.add('hidden');
    clearAlert('upload-alert');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'OCR failed');

      renderOCRResults(data);
    } catch (err) {
      showAlert('upload-alert', 'error', err.message);
    } finally {
      analyzeBtn.disabled = false;
      loadingEl.classList.add('hidden');
    }
  }

  function renderOCRResults(data) {
    // OCR confidence
    if (ocrConfEl) {
      ocrConfEl.textContent = `OCR Confidence: ${data.ocrConfidence}%`;
      ocrConfEl.style.color = data.ocrConfidence >= 70 ? 'var(--color-accent)' : 'var(--color-warning)';
    }

    // Detected tokens
    if (tokensWrap) {
      tokensWrap.innerHTML = data.tokens.length
        ? data.tokens.map((t) => `<span class="token" data-token="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')
        : '<span class="text-muted" style="font-size:.85rem">No tokens detected</span>';

      tokensWrap.querySelectorAll('.token').forEach((tok) => {
        tok.addEventListener('click', () => {
          tok.classList.toggle('selected');
          const query = tok.dataset.token;
          // Open search for this token
          window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
        });
      });
    }

    // Raw text toggle
    if (rawTextEl) {
      rawTextEl.textContent = data.rawText || '(empty)';
    }

    if (rawToggle) {
      rawToggle.addEventListener('click', () => {
        const box = document.getElementById('raw-text-box');
        if (box) box.classList.toggle('hidden');
        rawToggle.textContent = box && box.classList.contains('hidden') ? 'Show raw OCR text' : 'Hide raw OCR text';
      });
    }

    // Chip matches
    if (resultsCards) {
      if (!data.matches || data.matches.length === 0) {
        resultsCards.innerHTML = '<div class="alert alert-info">ℹ️ No chip matches found. Try adjusting the image focus or entering the code manually.</div>';
      } else {
        resultsCards.innerHTML = data.matches
          .map((m) => buildChipCard(m.chip, m.confidence, m.matchType, m.token))
          .join('');
        attachChipCardHandlers(resultsCards);
      }

      if (countEl) countEl.textContent = `${data.matches ? data.matches.length : 0} match${data.matches.length !== 1 ? 'es' : ''} found`;
    }

    resultsEl.classList.remove('hidden');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
