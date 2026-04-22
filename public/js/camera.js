/* camera.js – Live camera scanning page logic */

(function () {
  'use strict';

  const video       = document.getElementById('camera-video');
  const canvas      = document.getElementById('capture-canvas');
  const startBtn    = document.getElementById('camera-start-btn');
  const stopBtn     = document.getElementById('camera-stop-btn');
  const captureBtn  = document.getElementById('camera-capture-btn');
  const flashBtn    = document.getElementById('camera-flash-btn');
  const resultsEl   = document.getElementById('results-section');
  const resultsCards = document.getElementById('results-cards');
  const loadingEl   = document.getElementById('ocr-loading');
  const countEl     = document.getElementById('results-count');
  const capturedImg = document.getElementById('captured-image');
  const cameraStatus = document.getElementById('camera-status');

  let stream = null;
  let autoScanInterval = null;

  // ── Start / Stop camera ───────────────────────────────────

  if (startBtn) {
    startBtn.addEventListener('click', startCamera);
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', stopCamera);
  }

  if (captureBtn) {
    captureBtn.addEventListener('click', captureAndAnalyze);
  }

  if (flashBtn) {
    flashBtn.addEventListener('click', toggleTorch);
  }

  async function startCamera() {
    clearAlert('camera-alert');
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.play();

      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      captureBtn.disabled = false;
      setStatus('Camera active – aim at a chip label and press Capture', 'success');
    } catch (err) {
      let msg = 'Camera access denied.';
      if (err.name === 'NotFoundError') msg = 'No camera found on this device.';
      else if (err.name === 'NotAllowedError') msg = 'Camera permission denied. Please allow camera access.';
      showAlert('camera-alert', 'error', msg);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (autoScanInterval) {
      clearInterval(autoScanInterval);
      autoScanInterval = null;
    }
    video.srcObject = null;
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    captureBtn.disabled = true;
    setStatus('Camera stopped', 'info');
  }

  async function toggleTorch() {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        const settings = track.getSettings();
        await track.applyConstraints({ advanced: [{ torch: !settings.torch }] });
        flashBtn.textContent = settings.torch ? '🔦 Torch Off' : '💡 Torch On';
      } else {
        showAlert('camera-alert', 'info', 'Torch not supported on this device.');
      }
    } catch (_) {
      showAlert('camera-alert', 'info', 'Torch toggle not available.');
    }
  }

  // ── Capture & OCR ─────────────────────────────────────────

  async function captureAndAnalyze() {
    if (!stream || !video.videoWidth) {
      showAlert('camera-alert', 'error', 'Camera not active.');
      return;
    }

    // Draw video frame to canvas
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Show captured frame preview
    if (capturedImg) {
      capturedImg.src = canvas.toDataURL('image/jpeg', 0.92);
      capturedImg.classList.remove('hidden');
    }

    // Convert to blob and send to OCR
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      captureBtn.disabled = true;
      loadingEl.classList.remove('hidden');
      resultsEl.classList.add('hidden');
      clearAlert('camera-alert');

      try {
        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');

        const res = await fetch('/api/ocr', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'OCR failed');

        renderResults(data);
      } catch (err) {
        showAlert('camera-alert', 'error', err.message);
      } finally {
        captureBtn.disabled = false;
        loadingEl.classList.add('hidden');
      }
    }, 'image/jpeg', 0.92);
  }

  function renderResults(data) {
    if (resultsCards) {
      if (!data.matches || data.matches.length === 0) {
        resultsCards.innerHTML = `
          <div class="alert alert-info">
            ℹ️ No chips detected in this frame.
            <br>Tips: Get closer, ensure good lighting, hold steady.
          </div>`;
      } else {
        resultsCards.innerHTML = data.matches
          .map((m) => buildChipCard(m.chip, m.confidence, m.matchType, m.token))
          .join('');
        attachChipCardHandlers(resultsCards);
      }

      if (countEl) {
        const n = data.matches ? data.matches.length : 0;
        countEl.textContent = `${n} match${n !== 1 ? 'es' : ''} found`;
      }
    }

    resultsEl.classList.remove('hidden');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setStatus(msg, type) {
    if (!cameraStatus) return;
    cameraStatus.textContent = msg;
    cameraStatus.className = `text-${type === 'success' ? 'accent' : type === 'error' ? 'danger' : 'muted'}`;
    cameraStatus.style.cssText = type === 'success' ? 'color:var(--color-accent)' : type === 'error' ? 'color:var(--color-danger)' : 'color:var(--color-text-muted)';
  }

  // Stop camera when page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && stream) stopCamera();
  });
})();
