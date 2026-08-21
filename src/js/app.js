/**
 * Main Application Logic & Event Handlers
 * Handles both image conversion and video compression workflows.
 */
import { formatBytes, showToast, initTheme, toggleTheme, isCanvasFormatSupported } from './ui.js';
import { loadImageFile, convertImage } from './converter.js';
import { createZipArchive, triggerDownload, getExtensionForMime } from './zip.js';
import { compressVideo, isVideoFile, getFFmpeg } from './videoConverter.js';
import { openVideoThumbnailScrubber } from './videoThumbnail.js';

// Application State
const state = {
  queue: [],         // Array of QueueItem objects (image or video)
  isConverting: false,
  activeTab: 'image', // 'image' | 'video'
  settings: {
    // Image settings
    targetFormat: 'image/webp',
    quality: 0.8,
    generateThumb: true,
    thumbPreset: '150x150',
    thumbWidth: 150,
    thumbHeight: 150,
    thumbFit: 'contain',
    // Video settings
    videoTargetFormat: 'video/mp4',
    videoCrf: 23,
    videoPreset: 'fast',
    videoGenerateThumb: true,
  }
};

// DOM Elements — image tab
let dropzone, fileInput, queueList, emptyState, queueControls;
let targetFormatSelect, qualitySlider, qualityValue, generateThumbCheckbox;
let thumbPresetSelect, thumbWidthInput, thumbHeightInput, thumbFitSelect;
let convertBtn, downloadZipBtn, clearQueueBtn, addMoreBtn, themeToggleBtn;
let progressCard, progressBarInner, progressText;
let previewModal, previewModalTitle, previewModalBody, closeModalBtn;

// DOM Elements — tabs
let tabImageBtn, tabVideoBtn, imageTabPanel, videoTabPanel;

// DOM Elements — video tab
let videoDropzone, videoFileInput, videoTargetFormatSelect;
let videoCrfSlider, videoCrfValue, videoPresetSelect;
let videoGenerateThumbCheckbox;
let videoConvertBtn, videoDownloadZipBtn, videoClearQueueBtn, videoAddMoreBtn;
let videoQueueList, videoEmptyState, videoQueueControls, videoProgressCard;
let videoProgressBarInner, videoProgressText, videoProgressLog;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindDOMElements();
  attachEventListeners();
  renderQueue();
  renderVideoQueue();
});

function bindDOMElements() {
  // Tabs
  tabImageBtn = document.getElementById('tabImageBtn');
  tabVideoBtn = document.getElementById('tabVideoBtn');
  imageTabPanel = document.getElementById('imageTabPanel');
  videoTabPanel = document.getElementById('videoTabPanel');

  // Image tab elements
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

  // Video tab elements
  videoDropzone = document.getElementById('videoDropzone');
  videoFileInput = document.getElementById('videoFileInput');
  videoQueueList = document.getElementById('videoQueueList');
  videoEmptyState = document.getElementById('videoEmptyState');
  videoQueueControls = document.getElementById('videoQueueControls');
  videoTargetFormatSelect = document.getElementById('videoTargetFormat');
  videoCrfSlider = document.getElementById('videoCrfSlider');
  videoCrfValue = document.getElementById('videoCrfValue');
  videoPresetSelect = document.getElementById('videoPreset');
  videoGenerateThumbCheckbox = document.getElementById('videoGenerateThumb');
  videoConvertBtn = document.getElementById('videoConvertBtn');
  videoDownloadZipBtn = document.getElementById('videoDownloadZipBtn');
  videoClearQueueBtn = document.getElementById('videoClearQueueBtn');
  videoAddMoreBtn = document.getElementById('videoAddMoreBtn');
  videoProgressCard = document.getElementById('videoProgressCard');
  videoProgressBarInner = document.getElementById('videoProgressBarInner');
  videoProgressText = document.getElementById('videoProgressText');
  videoProgressLog = document.getElementById('videoProgressLog');
}

function attachEventListeners() {
  // ── Theme ──────────────────────────────────────────────────────────────
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // ── Tab switching ──────────────────────────────────────────────────────
  if (tabImageBtn) {
    tabImageBtn.addEventListener('click', () => switchTab('image'));
  }
  if (tabVideoBtn) {
    tabVideoBtn.addEventListener('click', () => switchTab('video'));
  }

  // ── Image dropzone ─────────────────────────────────────────────────────
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files?.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files?.length > 0) {
      handleFilesAdded(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  addMoreBtn.addEventListener('click', () => fileInput.click());
  clearQueueBtn.addEventListener('click', clearQueue);

  // Image settings
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

  // ── Video dropzone ─────────────────────────────────────────────────────
  if (videoDropzone) {
    videoDropzone.addEventListener('click', () => videoFileInput.click());
    videoDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      videoDropzone.classList.add('dragover');
    });
    videoDropzone.addEventListener('dragleave', () => videoDropzone.classList.remove('dragover'));
    videoDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      videoDropzone.classList.remove('dragover');
      if (e.dataTransfer.files?.length > 0) {
        handleVideoFilesAdded(Array.from(e.dataTransfer.files));
      }
    });

    videoFileInput.addEventListener('change', (e) => {
      if (e.target.files?.length > 0) {
        handleVideoFilesAdded(Array.from(e.target.files));
        videoFileInput.value = '';
      }
    });

    videoAddMoreBtn.addEventListener('click', () => videoFileInput.click());
    videoClearQueueBtn.addEventListener('click', clearVideoQueue);

    // Video settings
    videoTargetFormatSelect.addEventListener('change', (e) => {
      state.settings.videoTargetFormat = e.target.value;
    });

    videoCrfSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      videoCrfValue.textContent = String(val);
      state.settings.videoCrf = val;
    });

    videoPresetSelect.addEventListener('change', (e) => {
      state.settings.videoPreset = e.target.value;
    });

    videoGenerateThumbCheckbox.addEventListener('change', (e) => {
      state.settings.videoGenerateThumb = e.target.checked;
    });

    videoConvertBtn.addEventListener('click', startVideoBatchCompression);
    videoDownloadZipBtn.addEventListener('click', downloadVideosAsZip);
  }
}

// ── Tab Management ─────────────────────────────────────────────────────────

function switchTab(tab) {
  state.activeTab = tab;

  if (tabImageBtn && tabVideoBtn) {
    tabImageBtn.classList.toggle('tab-active', tab === 'image');
    tabVideoBtn.classList.toggle('tab-active', tab === 'video');
  }

  if (imageTabPanel && videoTabPanel) {
    imageTabPanel.style.display = tab === 'image' ? 'contents' : 'none';
    videoTabPanel.style.display = tab === 'video' ? 'contents' : 'none';
  }
}

// ── Image Queue ────────────────────────────────────────────────────────────

/**
 * Handle addition of new image files into queue
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
      itemType: 'image',
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
 * Render complete image queue UI
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
 * Create DOM element for an image queue item
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
 * Remove an item from the image queue
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
 * Clear entire image queue
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
 * Start batch processing all image items in queue
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
        targetFormat: state.settings.targetFormat,
        itemType: 'image'
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

// ── Video Queue ────────────────────────────────────────────────────────────

/** Video-specific queue */
const videoQueue = [];
let isVideoConverting = false;

/**
 * Handle addition of video files to the video queue
 * @param {File[]} files
 */
function handleVideoFilesAdded(files) {
  let addedCount = 0;

  files.forEach((file) => {
    if (!isVideoFile(file)) {
      showToast(`Skipped unsupported file: ${file.name}`, 'error');
      return;
    }

    const item = {
      id: 'vid_' + Math.random().toString(36).substr(2, 9),
      itemType: 'video',
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'video/mp4',
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      thumbnailBlob: null,
      thumbnailUrl: null,
      convertedBlob: null,
      convertedSize: null,
    };

    videoQueue.push(item);
    addedCount++;
  });

  if (addedCount > 0) {
    showToast(`Added ${addedCount} video(s) to queue`, 'success');
    renderVideoQueue();
  }
}

/**
 * Render the video queue UI
 */
function renderVideoQueue() {
  const count = videoQueue.length;
  const countBadge = document.getElementById('videoQueueCountBadge');
  if (countBadge) countBadge.textContent = `${count} File${count === 1 ? '' : 's'}`;

  if (count === 0) {
    if (videoEmptyState) videoEmptyState.style.display = 'block';
    if (videoQueueList) videoQueueList.style.display = 'none';
    if (videoQueueControls) videoQueueControls.style.display = 'none';
    if (videoConvertBtn) videoConvertBtn.disabled = true;
    if (videoDownloadZipBtn) videoDownloadZipBtn.disabled = true;
    if (videoProgressCard) videoProgressCard.style.display = 'none';
    return;
  }

  if (videoEmptyState) videoEmptyState.style.display = 'none';
  if (videoQueueList) videoQueueList.style.display = 'flex';
  if (videoQueueControls) videoQueueControls.style.display = 'flex';
  if (videoConvertBtn) videoConvertBtn.disabled = isVideoConverting;

  const hasCompleted = videoQueue.some(i => i.status === 'completed');
  if (videoDownloadZipBtn) videoDownloadZipBtn.disabled = !hasCompleted;

  if (videoQueueList) {
    videoQueueList.innerHTML = '';
    videoQueue.forEach(item => {
      videoQueueList.appendChild(createVideoQueueItemElement(item));
    });
  }
}

/**
 * Re-render a single video queue item
 * @param {Object} item
 */
function renderVideoQueueItem(item) {
  const existingEl = document.getElementById(item.id);
  if (existingEl) {
    const newEl = createVideoQueueItemElement(item);
    existingEl.replaceWith(newEl);
  }
}

/**
 * Create DOM element for a video queue item
 * @param {Object} item
 */
function createVideoQueueItemElement(item) {
  const card = document.createElement('div');
  card.id = item.id;
  card.className = 'queue-item';

  // Video preview / thumbnail box
  const thumbBox = document.createElement('div');
  thumbBox.className = 'item-thumb-box video-thumb-box';
  thumbBox.style.cursor = 'pointer';
  thumbBox.title = 'Click to pick thumbnail frame';

  if (item.thumbnailUrl) {
    const img = document.createElement('img');
    img.src = item.thumbnailUrl;
    img.alt = 'Thumbnail';
    thumbBox.appendChild(img);
  } else {
    thumbBox.innerHTML = `<span style="font-size:1.8rem;">🎬</span>`;
  }

  thumbBox.onclick = () => openVideoScrubber(item);

  // Details
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

  // Type badge
  const typeBadge = document.createElement('span');
  typeBadge.className = 'badge';
  typeBadge.style.background = 'var(--accent-purple)';
  typeBadge.style.color = '#fff';
  typeBadge.textContent = item.name.split('.').pop().toUpperCase();
  metaEl.appendChild(typeBadge);

  const statusBadge = document.createElement('span');
  statusBadge.className = `status-badge status-${item.status}`;
  statusBadge.textContent = item.status.toUpperCase();
  metaEl.appendChild(statusBadge);

  if (item.status === 'completed' && item.convertedSize) {
    const diff = item.convertedSize - item.size;
    const pct = Math.round((diff / item.size) * 100);
    const savingsBadge = document.createElement('span');
    savingsBadge.className = `savings-badge ${pct <= 0 ? 'savings-good' : 'savings-warn'}`;
    savingsBadge.textContent = pct <= 0 ? `${pct}% (${formatBytes(item.convertedSize)})` : `+${pct}% (${formatBytes(item.convertedSize)})`;
    metaEl.appendChild(savingsBadge);
  }

  if (item.thumbnailUrl) {
    const thumbNote = document.createElement('span');
    thumbNote.className = 'badge';
    thumbNote.style.background = 'var(--accent-cyan)';
    thumbNote.style.color = '#000';
    thumbNote.textContent = '📸 Thumb set';
    metaEl.appendChild(thumbNote);
  }

  details.appendChild(nameEl);
  details.appendChild(metaEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'queue-item-actions';

  // Thumbnail pick button
  const pickThumbBtn = document.createElement('button');
  pickThumbBtn.className = 'brutal-btn btn-sm btn-cyan';
  pickThumbBtn.innerHTML = '🎞️ Thumb';
  pickThumbBtn.title = 'Pick a thumbnail frame';
  pickThumbBtn.disabled = isVideoConverting;
  pickThumbBtn.onclick = () => openVideoScrubber(item);
  actions.appendChild(pickThumbBtn);

  if (item.status === 'completed') {
    const dlBtn = document.createElement('button');
    dlBtn.className = 'brutal-btn btn-sm btn-lime';
    dlBtn.innerHTML = '⬇️ Video';
    dlBtn.title = 'Download compressed video';
    dlBtn.onclick = () => {
      const ext = getExtensionForMime(state.settings.videoTargetFormat);
      const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
      triggerDownload(item.convertedBlob, `${baseName}_compressed${ext}`);
    };
    actions.appendChild(dlBtn);

    if (item.thumbnailBlob) {
      const dlThumbBtn = document.createElement('button');
      dlThumbBtn.className = 'brutal-btn btn-sm btn-yellow';
      dlThumbBtn.innerHTML = '🖼️ Thumb';
      dlThumbBtn.title = 'Download thumbnail';
      dlThumbBtn.onclick = () => {
        const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        triggerDownload(item.thumbnailBlob, `thumb_${baseName}.png`);
      };
      actions.appendChild(dlThumbBtn);
    }
  }

  const removeBtn = document.createElement('button');
  removeBtn.className = 'brutal-btn btn-sm btn-pink';
  removeBtn.innerHTML = '🗑️';
  removeBtn.title = 'Remove from queue';
  removeBtn.disabled = isVideoConverting;
  removeBtn.onclick = () => removeVideoItem(item.id);
  actions.appendChild(removeBtn);

  card.appendChild(thumbBox);
  card.appendChild(details);
  card.appendChild(actions);

  return card;
}

/**
 * Open the video thumbnail scrubber for an item
 * @param {Object} item
 */
async function openVideoScrubber(item) {
  const blob = await openVideoThumbnailScrubber(item.file, item.name);
  if (blob) {
    if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
    item.thumbnailBlob = blob;
    item.thumbnailUrl = URL.createObjectURL(blob);
    showToast(`Thumbnail set for "${item.name}"`, 'success');
    renderVideoQueueItem(item);
  }
}

/**
 * Remove a video item from the queue
 * @param {string} id
 */
function removeVideoItem(id) {
  const index = videoQueue.findIndex(i => i.id === id);
  if (index !== -1) {
    const item = videoQueue[index];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
    videoQueue.splice(index, 1);
    renderVideoQueue();
    showToast('Removed video from queue', 'info');
  }
}

/**
 * Clear all videos from the queue
 */
function clearVideoQueue() {
  videoQueue.forEach(item => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
  });
  videoQueue.length = 0;
  renderVideoQueue();
  showToast('Video queue cleared', 'info');
}

/**
 * Start batch video compression
 */
async function startVideoBatchCompression() {
  if (videoQueue.length === 0 || isVideoConverting) return;

  isVideoConverting = true;
  videoConvertBtn.disabled = true;
  videoDownloadZipBtn.disabled = true;
  videoClearQueueBtn.disabled = true;
  videoAddMoreBtn.disabled = true;

  videoProgressCard.style.display = 'block';
  videoProgressBarInner.style.width = '0%';
  videoProgressText.textContent = `Loading FFmpeg WASM...`;
  videoProgressLog.textContent = '';

  try {
    // Pre-load FFmpeg with log callback
    await getFFmpeg((msg) => {
      if (videoProgressLog) {
        videoProgressLog.textContent = msg;
      }
    });
  } catch (err) {
    showToast('Failed to load FFmpeg WASM. Check your internet connection.', 'error');
    isVideoConverting = false;
    videoConvertBtn.disabled = false;
    videoClearQueueBtn.disabled = false;
    videoAddMoreBtn.disabled = false;
    return;
  }

  let completedCount = 0;
  const total = videoQueue.length;

  for (let i = 0; i < total; i++) {
    const item = videoQueue[i];
    item.status = 'processing';
    renderVideoQueueItem(item);
    videoProgressText.textContent = `Processing ${i + 1} / ${total}: ${item.name}`;

    try {
      const result = await compressVideo(item.file, {
        targetFormat: state.settings.videoTargetFormat,
        crf: state.settings.videoCrf,
        preset: state.settings.videoPreset,
        onProgress: (pct) => {
          const overallPct = Math.round(((i + pct / 100) / total) * 100);
          videoProgressBarInner.style.width = `${overallPct}%`;
          videoProgressText.textContent = `${i + 1}/${total}: ${item.name} — ${pct}%`;
        },
        onLog: (msg) => {
          if (videoProgressLog) videoProgressLog.textContent = msg;
        }
      });

      item.convertedBlob = result.blob;
      item.convertedSize = result.size;
      item.status = 'completed';
      completedCount++;
    } catch (err) {
      console.error(`Error compressing ${item.name}:`, err);
      item.status = 'error';
      item.errorMessage = err.message || 'Compression failed';
      showToast(`Error compressing ${item.name}`, 'error');
    }

    renderVideoQueueItem(item);
  }

  const overallPct = Math.round((completedCount / total) * 100);
  videoProgressBarInner.style.width = `${overallPct}%`;
  videoProgressText.textContent = `Done: ${completedCount} / ${total} compressed`;
  videoProgressLog.textContent = '';

  isVideoConverting = false;
  videoConvertBtn.disabled = false;
  videoClearQueueBtn.disabled = false;
  videoAddMoreBtn.disabled = false;
  videoDownloadZipBtn.disabled = false;

  showToast(`Video compression complete! ${completedCount}/${total} done.`, 'success');
}

/**
 * Download all compressed videos (+ thumbnails) as a ZIP
 */
async function downloadVideosAsZip() {
  const completedItems = videoQueue.filter(i => i.status === 'completed');

  if (completedItems.length === 0) {
    showToast('No compressed videos available for download.', 'error');
    return;
  }

  videoDownloadZipBtn.disabled = true;
  videoDownloadZipBtn.textContent = '📦 Archiving ZIP...';

  try {
    const zipBlob = await createZipArchive(
      completedItems.map(item => ({
        originalName: item.name,
        convertedBlob: item.convertedBlob,
        thumbnailBlob: item.thumbnailBlob,
        targetFormat: state.settings.videoTargetFormat,
        itemType: 'video'
      })),
      (percent) => {
        videoDownloadZipBtn.textContent = `📦 Archiving (${percent}%)...`;
      }
    );

    const now = new Date().toISOString().split('T')[0];
    triggerDownload(zipBlob, `CodedByKay_Videos_${now}.zip`);
    showToast('Video ZIP downloaded successfully!', 'success');
  } catch (err) {
    console.error('Failed to create ZIP:', err);
    showToast('Failed to generate ZIP file', 'error');
  } finally {
    videoDownloadZipBtn.disabled = false;
    videoDownloadZipBtn.textContent = '📦 Download ZIP';
  }
}
