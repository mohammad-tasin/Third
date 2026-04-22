/* shared.js – utilities used across all pages */

const CATEGORY_LABEL = {
  cpu: 'CPU/SoC',
  emmc: 'Storage',
  pmic: 'PMIC',
  rf: 'RF IC',
  audio: 'Audio IC',
  charging: 'Charging IC',
  connectivity: 'Wi-Fi / BT',
  display: 'Display Driver',
  touch: 'Touch IC',
  sensor: 'Sensor',
  camera: 'Camera Sensor',
  nfc: 'NFC IC',
  usb: 'USB-C IC',
  security: 'Secure Element',
  biometrics: 'Fingerprint',
  mcu: 'MCU',
};

function getCategoryLabel(cat) {
  return CATEGORY_LABEL[cat] || cat;
}

function getBadgeClass(cat) {
  return `badge badge-${cat || 'sensor'}`;
}

/** Build the chip card HTML */
function buildChipCard(chip, confidence, matchType, token) {
  const confClass = confidence >= 85 ? 'confidence-high' : confidence >= 60 ? 'confidence-mid' : 'confidence-low';
  const showConf = confidence !== undefined && confidence !== null;
  const matchLabel = matchType === 'exact' ? '✓ Exact match' : `≈ Fuzzy match (token: ${token || ''})`;

  return `
    <div class="chip-card" data-chip-id="${escapeHtml(chip.id)}" role="button" tabindex="0"
         aria-label="View details for ${escapeHtml(chip.name)}">
      <div class="chip-card-header">
        <div>
          <div class="chip-name">${escapeHtml(chip.name)}</div>
          <div class="chip-badges mt-16">
            <span class="${getBadgeClass(chip.category)}">${escapeHtml(getCategoryLabel(chip.category))}</span>
            <span class="badge" style="background:rgba(255,255,255,0.05);color:var(--color-text-muted)">${escapeHtml(chip.manufacturer)}</span>
            ${chip.releaseYear ? `<span class="badge" style="background:rgba(255,255,255,0.05);color:var(--color-text-muted)">${chip.releaseYear}</span>` : ''}
          </div>
        </div>
        <span class="chip-code">${escapeHtml(chip.code)}</span>
      </div>
      <p class="chip-description">${escapeHtml(chip.description)}</p>
      ${showConf ? `
      <div class="confidence-bar-wrap ${confClass}" style="margin-top:12px">
        <div class="confidence-label">
          <span>${matchLabel}</span>
          <span>${confidence}%</span>
        </div>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width:${confidence}%"></div>
        </div>
      </div>` : ''}
    </div>`;
}

/** Build detailed chip modal content */
function buildChipModal(chip) {
  const details = [
    { key: 'Code', value: chip.code },
    { key: 'Manufacturer', value: chip.manufacturer },
    { key: 'Type', value: chip.type },
    { key: 'Category', value: getCategoryLabel(chip.category) },
    chip.process ? { key: 'Process', value: chip.process } : null,
    chip.cores ? { key: 'CPU Cores', value: chip.cores } : null,
    chip.gpu ? { key: 'GPU', value: chip.gpu } : null,
    chip.modem ? { key: 'Modem', value: chip.modem } : null,
    chip.capacity ? { key: 'Capacity', value: chip.capacity } : null,
    chip.interface ? { key: 'Interface', value: chip.interface } : null,
    chip.speed ? { key: 'Speed', value: chip.speed } : null,
    chip.voltage ? { key: 'Voltage', value: chip.voltage } : null,
    chip.maxRam ? { key: 'Max RAM', value: chip.maxRam } : null,
    chip.maxStorage ? { key: 'Max Storage', value: chip.maxStorage } : null,
    chip.releaseYear ? { key: 'Release Year', value: chip.releaseYear } : null,
  ].filter(Boolean);

  const detailGrid = details.map((d) => `
    <div class="detail-item">
      <div class="detail-key">${escapeHtml(d.key)}</div>
      <div class="detail-value">${escapeHtml(String(d.value))}</div>
    </div>`).join('');

  const specs = chip.specs || {};
  const specRows = Object.entries(specs).map(([k, v]) => `
    <tr>
      <td>${escapeHtml(toTitleCase(k))}</td>
      <td>${escapeHtml(String(v))}</td>
    </tr>`).join('');

  const aliases = (chip.aliases || []).filter((a) => a !== chip.code);

  const phones = (chip.compatiblePhones || []).map((p) => `
    <span class="phone-tag">${escapeHtml(p)}</span>`).join('');

  return `
    <div class="modal-header">
      <div>
        <div class="modal-title">${escapeHtml(chip.name)}</div>
        <div class="modal-subtitle">${escapeHtml(chip.manufacturer)} · ${escapeHtml(getCategoryLabel(chip.category))}</div>
      </div>
      <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
    </div>
    <div class="modal-body">
      <div class="chip-badges mb-0" style="margin-bottom:16px">
        <span class="${getBadgeClass(chip.category)}">${escapeHtml(getCategoryLabel(chip.category))}</span>
        <span class="chip-code">${escapeHtml(chip.code)}</span>
        ${aliases.map((a) => `<span class="chip-code" style="opacity:0.65">${escapeHtml(a)}</span>`).join('')}
      </div>

      <p style="margin-bottom:20px;color:var(--color-text-muted);font-size:.9rem">${escapeHtml(chip.description)}</p>

      <div class="detail-grid">${detailGrid}</div>

      ${specRows ? `
      <div class="card-title" style="margin-top:20px">⚙️ Technical Specifications</div>
      <table class="specs-table"><tbody>${specRows}</tbody></table>` : ''}

      ${phones ? `
      <div class="card-title" style="margin-top:20px">📱 Compatible Phones</div>
      <div class="phones-list">${phones}</div>` : ''}
    </div>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toTitleCase(str) {
  return str.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

/** Modal management */
function openModal(chip) {
  const overlay = document.getElementById('chip-modal');
  const content = document.getElementById('chip-modal-content');
  if (!overlay || !content) return;
  content.innerHTML = buildChipModal(chip);
  overlay.classList.add('open');
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', onModalKey);
}

function closeModal() {
  const overlay = document.getElementById('chip-modal');
  if (overlay) overlay.classList.remove('open');
  document.removeEventListener('keydown', onModalKey);
}

function onModalKey(e) {
  if (e.key === 'Escape') closeModal();
}

/** Attach click/keyboard handler to chip cards */
function attachChipCardHandlers(container) {
  container.querySelectorAll('.chip-card[data-chip-id]').forEach((card) => {
    function handler() {
      const id = card.dataset.chipId;
      fetchChipDetail(id);
    }
    card.addEventListener('click', handler);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

async function fetchChipDetail(id) {
  try {
    const res = await fetch(`/api/chip/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Chip not found');
    const { chip } = await res.json();
    openModal(chip);
  } catch (e) {
    showAlert('chip-alert', 'error', 'Could not load chip details: ' + e.message);
  }
}

function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  el.innerHTML = `<div class="alert alert-${type}">${icon} ${escapeHtml(message)}</div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}

/** Set active nav link based on current path */
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.navbar-nav a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === path || (path === '/' && a.getAttribute('href') === '/'));
  });
}

document.addEventListener('DOMContentLoaded', setActiveNav);
