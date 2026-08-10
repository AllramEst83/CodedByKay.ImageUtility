/**
 * Main Application Logic & Event Handlers
 */
import { formatBytes, showToast, initTheme, toggleTheme, isCanvasFormatSupported } from './ui.js';
import { loadImageFile, convertImage } from './converter.js';
import { createZipArchive, triggerDownload, getExtensionForMime } from './zip.js';

// Application State
const state = {
  queue: [], // Array of QueueItem objects
  isConverting: false,
  settings: {
    targetFormat: 'image/webp',
    quality: 0.8,
    generateThumb: true,
    thumbPreset: '150x150',
    thumbWidth: 150,
    thumbHeight: 150,
    thumbFit: 'contain'
  }
};

// DOM Elements
let dropzone, fileInput, queueList, emptyState, queueControls;
let targetFormatSelect, qualitySlider, qualityValue, generateThumbCheckbox;
let thumbPresetSelect, thumbWidthInput, thumbHeightInput, thumbFitSelect;
let convertBtn, downloadZipBtn, clearQueueBtn, addMoreBtn, themeToggleBtn;
let progressCard, progressBarInner, progressText;
let previewModal, previewModalTitle, previewModalBody, closeModalBtn;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindDOMElements();
  attachEventListeners();
  renderQueue();
});

function bindDOMElements() {
  dropzone = document.getElementById('dropzone');
  fileInput = document.getElementById('fileInput');
  queueList = document.getElementById('queueList');
  emptyState = document.getElementById('emptyState');
  queueControls = document.getElementById('queueControls');

  targetFormatSelect = document.getElementById('targetFormat');
  qualitySlider = document.getElementById('qualitySlider');
  qualityValue = document.getElementById('qualityValue');
  generateThumbCheckbox = document.getElementById('generateThumb');
  thumbPresetSelect = document.getElementById('thumbPreset');
  thumbWidthInput = document.getElementById('thumbWidth');
  thumbHeightInput = document.getElementById('thumbHeight');
  thumbFitSelect = document.getElementById('thumbFit');

  convertBtn = document.getElementById('convertBtn');
  downloadZipBtn = document.getElementById('downloadZipBtn');
  clearQueueBtn = document.getElementById('clearQueueBtn');
  addMoreBtn = document.getElementById('addMoreBtn');
  themeToggleBtn = document.getElementById('themeToggleBtn');

  progressCard = document.getElementById('progressCard');
  progressBarInner = document.getElementById('progressBarInner');
  progressText = document.getElementById('progressText');

  previewModal = document.getElementById('previewModal');
  previewModalTitle = document.getElementById('previewModalTitle');
  previewModalBody = document.getElementById('previewModalBody');
  closeModalBtn = document.getElementById('closeModalBtn');
}

function attachEventListeners() {
  // Theme Toggle
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Dropzone drag & drop
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(Array.from(e.target.files));
      fileInput.value = ''; // Reset input
    }
  });

  // Controls
  addMoreBtn.addEventListener('click', () => fileInput.click());
  clearQueueBtn.addEventListener('click', clearQueue);

  // Settings
  targetFormatSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    if (!isCanvasFormatSupported(selected)) {
      showToast(`Warning: ${selected.split('/')[1].toUpperCase()} canvas export may not be supported by your browser.`, 'error');
    }
    state.settings.targetFormat = selected;
  });

  qualitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    qualityValue.textContent = `${val}%`;
    state.settings.quality = val / 100;
  });

  generateThumbCheckbox.addEventListener('change', (e) => {
    state.settings.generateThumb = e.target.checked;
    const thumbSettingsGroup = document.getElementById('thumbSettingsGroup');
    if (thumbSettingsGroup) {
      thumbSettingsGroup.style.display = e.target.checked ? 'block' : 'none';
    }
  });

  thumbPresetSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    state.settings.thumbPreset = val;
    if (val !== 'custom') {
      const [w, h] = val.split('x').map(Number);
      thumbWidthInput.value = w;
      thumbHeightInput.value = h;
      state.settings.thumbWidth = w;
      state.settings.thumbHeight = h;
      thumbWidthInput.disabled = true;
      thumbHeightInput.disabled = true;
    } else {
      thumbWidthInput.disabled = false;
      thumbHeightInput.disabled = false;
    }
  });

  thumbWidthInput.addEventListener('input', (e) => {
    state.settings.thumbWidth = parseInt(e.target.value, 10) || 150;
  });

  thumbHeightInput.addEventListener('input', (e) => {
    state.settings.thumbHeight = parseInt(e.target.value, 10) || 150;
  });

  thumbFitSelect.addEventListener('change', (e) => {
    state.settings.thumbFit = e.target.value;
  });

  // Action Buttons
  convertBtn.addEventListener('click', startBatchConversion);
  downloadZipBtn.addEventListener('click', downloadAllAsZip);

  // Modal close
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      previewModal.style.display = 'none';
    });
  }
  if (previewModal) {
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) previewModal.style.display = 'none';
    });
  }
}

/**
 * Handle addition of new files into queue
 * @param {File[]} files 
 */
function handleFilesAdded(files) {
  const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

  let addedCount = 0;

  files.forEach((file) => {
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    const isValidType = validMimes.includes(file.type) || validExtensions.includes(fileExt);

    if (!isValidType) {
      showToast(`Skipped non-image file: ${file.name}`, 'error');
      return;
    }

    const item = {
      id: 'img_' + Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'image/' + fileExt.replace('.', ''),
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      dimensions: null
    };

    // Asynchronously fetch image dimensions
    loadImageFile(file)
      .then(({ width, height }) => {
        item.dimensions = { width, height };
        renderQueueItem(item);
      })
      .catch((err) => {
        console.warn('Could not read dimensions:', err);
      });

    state.queue.push(item);
    addedCount++;
  });

  if (addedCount > 0) {
    showToast(`Added ${addedCount} image(s) to queue`, 'success');
    renderQueue();
  }
}

/**
 * Render complete queue UI
 */
function renderQueue() {
  const count = state.queue.length;
  const countBadge = document.getElementById('queueCountBadge');
  if (countBadge) countBadge.textContent = `${count} File${count === 1 ? '' : 's'}`;

  if (count === 0) {
    emptyState.style.display = 'block';
    queueList.style.display = 'none';
    queueControls.style.display = 'none';
    convertBtn.disabled = true;
    downloadZipBtn.disabled = true;
    progressCard.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  queueList.style.display = 'flex';
  queueControls.style.display = 'flex';
  convertBtn.disabled = state.isConverting;
  
  const hasCompleted = state.queue.some(i => i.status === 'completed');
  downloadZipBtn.disabled = !hasCompleted;

  queueList.innerHTML = '';
  state.queue.forEach(item => {
    queueList.appendChild(createQueueItemElement(item));
  });
}

/**
 * Render single item element update without full list re-render
 * @param {Object} item 
 */
function renderQueueItem(item) {
  const existingEl = document.getElementById(item.id);
  if (existingEl) {
    const newEl = createQueueItemElement(item);
    existingEl.replaceWith(newEl);
  }
}

/**
 * Create DOM element for a queue item
 * @param {Object} item 
 */
function createQueueItemElement(item) {
  const card = document.createElement('div');
  card.id = item.id;
  card.className = 'queue-item';

  // Thumbnail image container
  const thumbBox = document.createElement('div');
  thumbBox.className = 'item-thumb-box';
  thumbBox.title = 'Click to inspect preview';
  thumbBox.style.cursor = 'pointer';

  const img = document.createElement('img');
  img.src = item.previewUrl;
  img.alt = item.name;
  thumbBox.appendChild(img);
  thumbBox.onclick = () => openPreviewModal(item);

  // Item details
  const details = document.createElement('div');
  details.className = 'item-details';

  const nameEl = document.createElement('div');
  nameEl.className = 'item-name';
  nameEl.textContent = item.name;
  nameEl.title = item.name;

  const metaEl = document.createElement('div');
  metaEl.className = 'item-meta';

  const sizeBadge = document.createElement('span');
  sizeBadge.className = 'badge';
  sizeBadge.textContent = formatBytes(item.size);
  metaEl.appendChild(sizeBadge);

  if (item.dimensions) {
    const dimBadge = document.createElement('span');
    dimBadge.className = 'badge';
    dimBadge.textContent = `${item.dimensions.width}×${item.dimensions.height}`;
    metaEl.appendChild(dimBadge);
  }

  // Status Badge
  const statusBadge = document.createElement('span');
  statusBadge.className = `status-badge status-${item.status}`;
  statusBadge.textContent = item.status.toUpperCase();
  metaEl.appendChild(statusBadge);

  // Conversion Size Savings
  if (item.status === 'completed' && item.convertedSize) {
    const diff = item.convertedSize - item.size;
    const pct = Math.round((diff / item.size) * 100);
    const savingsBadge = document.createElement('span');
    savingsBadge.className = `savings-badge ${pct <= 0 ? 'savings-good' : 'savings-warn'}`;
    savingsBadge.textContent = pct <= 0 ? `${pct}% (${formatBytes(item.convertedSize)})` : `+${pct}% (${formatBytes(item.convertedSize)})`;
    metaEl.appendChild(savingsBadge);
  }

  details.appendChild(nameEl);
  details.appendChild(metaEl);

  // Actions (Remove or Individual Download)
  const actions = document.createElement('div');
  actions.className = 'queue-item-actions';

  if (item.status === 'completed') {
    const dlBtn = document.createElement('button');
    dlBtn.className = 'brutal-btn btn-sm btn-lime';
    dlBtn.innerHTML = '⬇️ Image';
    dlBtn.title = 'Download converted image';
    dlBtn.onclick = () => {
      const ext = getExtensionForMime(state.settings.targetFormat);
      const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
      triggerDownload(item.convertedBlob, `${baseName}_converted${ext}`);
    };
    actions.appendChild(dlBtn);

    if (item.thumbnailBlob) {
      const dlThumbBtn = document.createElement('button');
      dlThumbBtn.className = 'brutal-btn btn-sm btn-yellow';
      dlThumbBtn.innerHTML = '🖼️ Thumb';
      dlThumbBtn.title = 'Download thumbnail preview';
      dlThumbBtn.onclick = () => {
        const ext = getExtensionForMime(state.settings.targetFormat);
        const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        triggerDownload(item.thumbnailBlob, `thumb_${baseName}${ext}`);
      };
      actions.appendChild(dlThumbBtn);
    }
  }

  const removeBtn = document.createElement('button');
  removeBtn.className = 'brutal-btn btn-sm btn-pink';
  removeBtn.innerHTML = '🗑️';
  removeBtn.title = 'Remove from queue';
  removeBtn.disabled = state.isConverting;
  removeBtn.onclick = () => removeItem(item.id);
  actions.appendChild(removeBtn);

  card.appendChild(thumbBox);
  card.appendChild(details);
  card.appendChild(actions);

  return card;
}

/**
 * Remove an item from the queue
 * @param {string} id 
 */
function removeItem(id) {
  const index = state.queue.findIndex(i => i.id === id);
  if (index !== -1) {
    const item = state.queue[index];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
    if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
    state.queue.splice(index, 1);
    renderQueue();
    showToast('Removed item from queue', 'info');
  }
}

/**
 * Clear entire queue
 */
function clearQueue() {
  state.queue.forEach(item => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
    if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
  });
  state.queue = [];
  renderQueue();
  showToast('Queue cleared', 'info');
}

/**
 * Start batch processing all items in queue
 */
async function startBatchConversion() {
  if (state.queue.length === 0 || state.isConverting) return;

  state.isConverting = true;
  convertBtn.disabled = true;
  downloadZipBtn.disabled = true;
  clearQueueBtn.disabled = true;
  addMoreBtn.disabled = true;

  progressCard.style.display = 'block';
  progressBarInner.style.width = '0%';
  progressText.textContent = `0 / ${state.queue.length} converted (0%)`;

  let completedCount = 0;

  for (let i = 0; i < state.queue.length; i++) {
    const item = state.queue[i];
    item.status = 'processing';
    renderQueueItem(item);

    try {
      const { img } = await loadImageFile(item.file);
      const res = await convertImage(img, {
        targetFormat: state.settings.targetFormat,
        quality: state.settings.quality,
        generateThumb: state.settings.generateThumb,
        thumbWidth: state.settings.thumbWidth,
        thumbHeight: state.settings.thumbHeight,
        thumbFit: state.settings.thumbFit
      });

      item.convertedBlob = res.convertedBlob;
      item.convertedSize = res.convertedSize;
      item.convertedWidth = res.convertedWidth;
      item.convertedHeight = res.convertedHeight;
      item.convertedUrl = URL.createObjectURL(res.convertedBlob);

      if (res.thumbnailBlob) {
        item.thumbnailBlob = res.thumbnailBlob;
        item.thumbnailSize = res.thumbnailSize;
        item.thumbWidth = res.thumbWidth;
        item.thumbHeight = res.thumbHeight;
        item.thumbnailUrl = URL.createObjectURL(res.thumbnailBlob);
      }

      item.status = 'completed';
    } catch (err) {
      console.error(`Error converting ${item.name}:`, err);
      item.status = 'error';
      item.errorMessage = err.message || 'Conversion failed';
      showToast(`Error converting ${item.name}`, 'error');
    }

    completedCount++;
    const percent = Math.round((completedCount / state.queue.length) * 100);
    progressBarInner.style.width = `${percent}%`;
    progressText.textContent = `${completedCount} / ${state.queue.length} converted (${percent}%)`;
    renderQueueItem(item);
  }

  state.isConverting = false;
  convertBtn.disabled = false;
  clearQueueBtn.disabled = false;
  addMoreBtn.disabled = false;
  downloadZipBtn.disabled = false;

  showToast(`Batch conversion complete! ${completedCount} images processed.`, 'success');
}

/**
 * Create and trigger download of all images as a structured ZIP
 */
async function downloadAllAsZip() {
  const completedItems = state.queue.filter(i => i.status === 'completed');

  if (completedItems.length === 0) {
    showToast('No converted images available for download.', 'error');
    return;
  }

  downloadZipBtn.disabled = true;
  downloadZipBtn.textContent = '📦 Archiving ZIP...';

  try {
    const zipBlob = await createZipArchive(
      completedItems.map(item => ({
        originalName: item.name,
        convertedBlob: item.convertedBlob,
        thumbnailBlob: item.thumbnailBlob,
        targetFormat: state.settings.targetFormat
      })),
      (percent) => {
        downloadZipBtn.textContent = `📦 Archiving (${percent}%)...`;
      }
    );

    const now = new Date().toISOString().split('T')[0];
    triggerDownload(zipBlob, `CodedByKay_Images_${now}.zip`);
    showToast('ZIP archive downloaded successfully!', 'success');
  } catch (err) {
    console.error('Failed to create ZIP:', err);
    showToast('Failed to generate ZIP file', 'error');
  } finally {
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = '📦 Download ZIP';
  }
}

/**
 * Open image preview modal
 * @param {Object} item 
 */
function openPreviewModal(item) {
  if (!previewModal) return;

  previewModalTitle.textContent = item.name;
  previewModalBody.innerHTML = '';

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
  grid.style.gap = '1rem';

  // Original Card
  const origCard = document.createElement('div');
  origCard.className = 'brutal-card';
  origCard.style.padding = '0.75rem';
  origCard.innerHTML = `
    <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem;">ORIGINAL</h4>
    <div style="background: var(--bg-primary); border: 2px solid var(--border-color); height: 180px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
      <img src="${item.previewUrl}" alt="Original" style="max-width: 100%; max-height: 100%; object-fit: contain;">
    </div>
    <p style="font-family: var(--font-mono); font-size: 0.8rem; margin-top: 0.5rem;">Size: ${formatBytes(item.size)}</p>
    <p style="font-family: var(--font-mono); font-size: 0.8rem;">Dimensions: ${item.dimensions ? `${item.dimensions.width}×${item.dimensions.height}` : 'N/A'}</p>
  `;
  grid.appendChild(origCard);

  // Converted Card (if available)
  if (item.status === 'completed' && item.convertedUrl) {
    const convCard = document.createElement('div');
    convCard.className = 'brutal-card';
    convCard.style.padding = '0.75rem';
    const ext = getExtensionForMime(state.settings.targetFormat).replace('.', '').toUpperCase();
    convCard.innerHTML = `
      <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem;">CONVERTED (${ext})</h4>
      <div style="background: var(--bg-primary); border: 2px solid var(--border-color); height: 180px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <img src="${item.convertedUrl}" alt="Converted" style="max-width: 100%; max-height: 100%; object-fit: contain;">
      </div>
      <p style="font-family: var(--font-mono); font-size: 0.8rem; margin-top: 0.5rem;">Size: ${formatBytes(item.convertedSize)}</p>
      <p style="font-family: var(--font-mono); font-size: 0.8rem;">Dimensions: ${item.convertedWidth}×${item.convertedHeight}</p>
    `;
    grid.appendChild(convCard);
  }

  // Thumbnail Card (if available)
  if (item.status === 'completed' && item.thumbnailUrl) {
    const thumbCard = document.createElement('div');
    thumbCard.className = 'brutal-card';
    thumbCard.style.padding = '0.75rem';
    thumbCard.innerHTML = `
      <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem;">THUMBNAIL</h4>
      <div style="background: var(--bg-primary); border: 2px solid var(--border-color); height: 180px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <img src="${item.thumbnailUrl}" alt="Thumbnail" style="max-width: 100%; max-height: 100%; object-fit: contain;">
      </div>
      <p style="font-family: var(--font-mono); font-size: 0.8rem; margin-top: 0.5rem;">Size: ${formatBytes(item.thumbnailSize)}</p>
      <p style="font-family: var(--font-mono); font-size: 0.8rem;">Dimensions: ${item.thumbWidth}×${item.thumbHeight}</p>
    `;
    grid.appendChild(thumbCard);
  }

  previewModalBody.appendChild(grid);
  previewModal.style.display = 'flex';
}
