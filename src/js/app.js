/**
 * Main Application Logic & Event Handlers
 * Handles both image conversion and video compression workflows.
 */
import { formatBytes, showToast, initTheme, toggleTheme, isCanvasFormatSupported } from './ui.js';
import { loadImageFile, convertImage } from './converter.js';
import { createZipArchive, triggerDownload, getExtensionForMime } from './zip.js';
import { compressVideo, isVideoFile, getFFmpeg } from './videoConverter.js';
import { openVideoThumbnailScrubber } from './videoThumbnail.js';
import { openVideoTimelineEditor } from './videoTimelineEditor.js';
import { buildTimelapse } from './timelapseConverter.js';

// Application State
const state = {
  queue: [],         // Array of QueueItem objects (image or video)
  isConverting: false,
  activeTab: 'image', // 'image' | 'video' | 'timelapse'
  settings: {
    // Image settings
    targetFormat: 'image/webp',
    quality: 0.8,
    generateThumb: true,
    thumbPreset: '300x200',
    thumbWidth: 300,
    thumbHeight: 200,
    thumbFit: 'contain',
    // Video settings
    videoTargetFormat: 'video/mp4',
    videoCrf: 23,
    videoPreset: 'fast',
    videoGenerateThumb: true,
    // Timelapse settings
    tlFps: 12,
    tlResolutionCap: '1280',
    tlFormat: 'video/mp4',
    tlCrf: 23,
    tlPreset: 'fast',
    tlHoldLastFrame: false,
    tlHoldSeconds: 2,
  }
};

// DOM Elements — image tab
let dropzone, fileInput, queueList, emptyState, queueControls;
let targetFormatSelect, qualitySlider, qualityValue, generateThumbCheckbox;
let thumbPresetSelect, thumbWidthInput, thumbHeightInput, thumbFitSelect;
let convertBtn, downloadZipBtn, clearQueueBtn, addMoreBtn, themeToggleBtn;
let progressCard, progressBarInner, progressText, progressLabel;
let previewModal, previewModalTitle, previewModalBody, closeModalBtn;

// DOM Elements — tabs
let tabImageBtn, tabVideoBtn, tabTimelapseBtn, imageTabPanel, videoTabPanel, timelapseTabPanel;

// DOM Elements — video tab
let videoDropzone, videoFileInput, videoTargetFormatSelect;
let videoCrfSlider, videoCrfValue, videoPresetSelect;
let videoGenerateThumbCheckbox;
let videoConvertBtn, videoDownloadZipBtn, videoClearQueueBtn, videoAddMoreBtn;
let videoQueueList, videoEmptyState, videoQueueControls, videoProgressCard;
let videoProgressBarInner, videoProgressText, videoProgressLog, videoProgressLabel;

// DOM Elements — timelapse tab
let timelapseDropzone, timelapseFileInput, timelapseQueueList, timelapseEmptyState, timelapseQueueControls;
let timelapseSortNameBtn, timelapseSortDateBtn, timelapseAddMoreBtn, timelapseClearQueueBtn;
let timelapseFpsSelect, timelapseResolutionSelect, timelapseFormatSelect;
let timelapseCrfSlider, timelapseCrfValue, timelapseHoldCheckbox, timelapseHoldSecondsInput;
let timelapseDurationEstimate, timelapseBuildBtn, timelapseDownloadBtn;
let timelapseProgressCard, timelapseProgressBarInner, timelapseProgressText, timelapseProgressLabel, timelapseProgressLog;
let timelapseResultCard, timelapseResultVideo, timelapseResultInfo;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindDOMElements();
  attachEventListeners();
  renderQueue();
  renderVideoQueue();
  renderTimelapseQueue();
});

function bindDOMElements() {
  // Tabs
  tabImageBtn = document.getElementById('tabImageBtn');
  tabVideoBtn = document.getElementById('tabVideoBtn');
  tabTimelapseBtn = document.getElementById('tabTimelapseBtn');
  imageTabPanel = document.getElementById('imageTabPanel');
  videoTabPanel = document.getElementById('videoTabPanel');
  timelapseTabPanel = document.getElementById('timelapseTabPanel');

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
  progressLabel = document.getElementById('progressLabel');
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
  videoProgressLabel = document.getElementById('videoProgressLabel');
  videoProgressLog = document.getElementById('videoProgressLog');

  // Timelapse tab elements
  timelapseDropzone = document.getElementById('timelapseDropzone');
  timelapseFileInput = document.getElementById('timelapseFileInput');
  timelapseQueueList = document.getElementById('timelapseQueueList');
  timelapseEmptyState = document.getElementById('timelapseEmptyState');
  timelapseQueueControls = document.getElementById('timelapseQueueControls');
  timelapseSortNameBtn = document.getElementById('timelapseSortNameBtn');
  timelapseSortDateBtn = document.getElementById('timelapseSortDateBtn');
  timelapseAddMoreBtn = document.getElementById('timelapseAddMoreBtn');
  timelapseClearQueueBtn = document.getElementById('timelapseClearQueueBtn');
  timelapseFpsSelect = document.getElementById('timelapseFps');
  timelapseResolutionSelect = document.getElementById('timelapseResolution');
  timelapseFormatSelect = document.getElementById('timelapseFormat');
  timelapseCrfSlider = document.getElementById('timelapseCrfSlider');
  timelapseCrfValue = document.getElementById('timelapseCrfValue');
  timelapseHoldCheckbox = document.getElementById('timelapseHoldCheckbox');
  timelapseHoldSecondsInput = document.getElementById('timelapseHoldSeconds');
  timelapseDurationEstimate = document.getElementById('timelapseDurationEstimate');
  timelapseBuildBtn = document.getElementById('timelapseBuildBtn');
  timelapseDownloadBtn = document.getElementById('timelapseDownloadBtn');
  timelapseProgressCard = document.getElementById('timelapseProgressCard');
  timelapseProgressBarInner = document.getElementById('timelapseProgressBarInner');
  timelapseProgressText = document.getElementById('timelapseProgressText');
  timelapseProgressLabel = document.getElementById('timelapseProgressLabel');
  timelapseProgressLog = document.getElementById('timelapseProgressLog');
  timelapseResultCard = document.getElementById('timelapseResultCard');
  timelapseResultVideo = document.getElementById('timelapseResultVideo');
  timelapseResultInfo = document.getElementById('timelapseResultInfo');
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
  if (tabTimelapseBtn) {
    tabTimelapseBtn.addEventListener('click', () => switchTab('timelapse'));
  }

  // ── Auto-switch tab based on what's being dragged in, before it's dropped ──
  document.addEventListener('dragenter', (e) => {
    const kind = classifyDragTypes(e.dataTransfer);
    if (kind && kind !== state.activeTab) {
      switchTab(kind);
    }
  });

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
    if (!(e.dataTransfer.files?.length > 0)) return;

    const { images, videos, other } = splitFilesByType(Array.from(e.dataTransfer.files));
    if (images.length) handleFilesAdded(images);
    if (videos.length) {
      switchTab('video');
      handleVideoFilesAdded(videos);
    }
    if (other.length) handleFilesAdded(other); // let it report the "skipped" toasts
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
    if (val.startsWith('original-')) {
      if (val === 'original-50pct') {
        thumbWidthInput.value = 50;
        thumbHeightInput.value = 50;
      } else if (val === 'original-25pct') {
        thumbWidthInput.value = 25;
        thumbHeightInput.value = 25;
      } else {
        const maxDim = parseInt(val.replace('original-', ''), 10) || 300;
        thumbWidthInput.value = maxDim;
        thumbHeightInput.value = maxDim;
        state.settings.thumbWidth = maxDim;
        state.settings.thumbHeight = maxDim;
      }
      thumbWidthInput.disabled = true;
      thumbHeightInput.disabled = true;
      thumbFitSelect.value = 'contain';
      state.settings.thumbFit = 'contain';
    } else if (val !== 'custom') {
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
    state.settings.thumbWidth = parseInt(e.target.value, 10) || 300;
  });

  thumbHeightInput.addEventListener('input', (e) => {
    state.settings.thumbHeight = parseInt(e.target.value, 10) || 200;
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
      if (!(e.dataTransfer.files?.length > 0)) return;

      const { images, videos, other } = splitFilesByType(Array.from(e.dataTransfer.files));
      if (videos.length) handleVideoFilesAdded(videos);
      if (images.length) {
        switchTab('image');
        handleFilesAdded(images);
      }
      if (other.length) handleVideoFilesAdded(other); // let it report the "skipped" toasts
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

  // ── Timelapse dropzone & controls ──────────────────────────────────────
  if (timelapseDropzone) {
    timelapseDropzone.addEventListener('click', () => timelapseFileInput.click());
    timelapseDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      timelapseDropzone.classList.add('dragover');
    });
    timelapseDropzone.addEventListener('dragleave', () => timelapseDropzone.classList.remove('dragover'));
    timelapseDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      timelapseDropzone.classList.remove('dragover');
      if (!(e.dataTransfer.files?.length > 0)) return;
      handleTimelapseFilesAdded(Array.from(e.dataTransfer.files));
    });

    timelapseFileInput.addEventListener('change', (e) => {
      if (e.target.files?.length > 0) {
        handleTimelapseFilesAdded(Array.from(e.target.files));
        timelapseFileInput.value = '';
      }
    });

    timelapseAddMoreBtn.addEventListener('click', () => timelapseFileInput.click());
    timelapseClearQueueBtn.addEventListener('click', clearTimelapseQueue);
    timelapseSortNameBtn.addEventListener('click', () => sortTimelapseQueue('name'));
    timelapseSortDateBtn.addEventListener('click', () => sortTimelapseQueue('date'));

    timelapseFpsSelect.addEventListener('change', (e) => {
      state.settings.tlFps = parseInt(e.target.value, 10);
      updateTimelapseDurationEstimate();
    });

    timelapseResolutionSelect.addEventListener('change', (e) => {
      state.settings.tlResolutionCap = e.target.value;
    });

    timelapseFormatSelect.addEventListener('change', (e) => {
      state.settings.tlFormat = e.target.value;
    });

    timelapseCrfSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      timelapseCrfValue.textContent = String(val);
      state.settings.tlCrf = val;
    });

    timelapseHoldCheckbox.addEventListener('change', (e) => {
      state.settings.tlHoldLastFrame = e.target.checked;
      if (timelapseHoldSecondsInput) timelapseHoldSecondsInput.disabled = !e.target.checked;
      updateTimelapseDurationEstimate();
    });

    timelapseHoldSecondsInput.addEventListener('input', (e) => {
      state.settings.tlHoldSeconds = parseFloat(e.target.value) || 0;
      updateTimelapseDurationEstimate();
    });

    timelapseBuildBtn.addEventListener('click', startTimelapseBuild);
    timelapseDownloadBtn.addEventListener('click', downloadTimelapseResult);
  }
}

// ── Tab Management ─────────────────────────────────────────────────────────

function switchTab(tab) {
  state.activeTab = tab;

  if (tabImageBtn) tabImageBtn.classList.toggle('tab-active', tab === 'image');
  if (tabVideoBtn) tabVideoBtn.classList.toggle('tab-active', tab === 'video');
  if (tabTimelapseBtn) tabTimelapseBtn.classList.toggle('tab-active', tab === 'timelapse');

  if (imageTabPanel) imageTabPanel.style.display = tab === 'image' ? 'contents' : 'none';
  if (videoTabPanel) videoTabPanel.style.display = tab === 'video' ? 'contents' : 'none';
  if (timelapseTabPanel) timelapseTabPanel.style.display = tab === 'timelapse' ? 'contents' : 'none';
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

/**
 * Check if a File is a supported image
 * @param {File} file
 * @returns {boolean}
 */
function isImageFile(file) {
  const fileExt = '.' + file.name.split('.').pop().toLowerCase();
  return IMAGE_MIMES.includes(file.type) || IMAGE_EXTENSIONS.includes(fileExt);
}

/**
 * Split a dropped/selected file list into image and video buckets. Files
 * matching neither are left out of both (their handler will report them).
 * @param {File[]} files
 * @returns {{ images: File[], videos: File[], other: File[] }}
 */
function splitFilesByType(files) {
  const images = [];
  const videos = [];
  const other = [];
  files.forEach((file) => {
    if (isImageFile(file)) images.push(file);
    else if (isVideoFile(file)) videos.push(file);
    else other.push(file);
  });
  return { images, videos, other };
}

/**
 * Peek at an in-progress drag's file types (before drop) using the browser's
 * partial DataTransferItem info, to proactively switch to the matching tab.
 * @param {DataTransfer} dataTransfer
 * @returns {'image'|'video'|null} null when mixed, empty, or undetermined
 */
function classifyDragTypes(dataTransfer) {
  if (!dataTransfer || !dataTransfer.items) return null;
  let hasImage = false;
  let hasVideo = false;
  for (const item of dataTransfer.items) {
    if (item.kind !== 'file') continue;
    if (item.type && item.type.startsWith('image/')) hasImage = true;
    else if (item.type && item.type.startsWith('video/')) hasVideo = true;
  }
  if (hasVideo && !hasImage) return 'video';
  if (hasImage && !hasVideo) return 'image';
  return null;
}

// ── Image Queue ────────────────────────────────────────────────────────────

/**
 * Handle addition of new image files into queue
 * @param {File[]} files
 */
function handleFilesAdded(files) {
  let addedCount = 0;

  files.forEach((file) => {
    if (!isImageFile(file)) {
      showToast(`Skipped non-image file: ${file.name}`, 'error');
      return;
    }

    const item = {
      id: 'img_' + Math.random().toString(36).substr(2, 9),
      itemType: 'image',
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'image/' + file.name.split('.').pop().toLowerCase(),
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
      triggerDownload(item.convertedBlob, `${baseName}${ext}`);
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
  if (progressLabel) progressLabel.textContent = '⚡ Converting Batch...';
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
        thumbPreset: state.settings.thumbPreset,
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

  if (progressLabel) progressLabel.textContent = '✅ Converting Done';

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
      segments: null, // Array<{sourceStart, sourceEnd}> from the timeline editor; null = untouched/no edits
      playbackSpeed: 1, // from the timeline editor's speed control; 1 = normal speed
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

  if (item.segments && item.segments.length) {
    const trimNote = document.createElement('span');
    trimNote.className = 'badge';
    trimNote.style.background = 'var(--accent-lime)';
    trimNote.style.color = '#000';
    trimNote.textContent = `✂️ ${formatSegmentsSummary(item)}`;
    metaEl.appendChild(trimNote);
  }

  if (item.playbackSpeed && item.playbackSpeed !== 1) {
    const speedNote = document.createElement('span');
    speedNote.className = 'badge';
    speedNote.style.background = 'var(--accent-purple)';
    speedNote.style.color = '#fff';
    const speedLabel = item.playbackSpeed % 1 === 0 ? item.playbackSpeed.toFixed(0) : item.playbackSpeed.toFixed(2);
    speedNote.textContent = `⏩ ${speedLabel}x speed`;
    metaEl.appendChild(speedNote);
  }

  details.appendChild(nameEl);
  details.appendChild(metaEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'queue-item-actions';

  // Timeline editor button
  const editBtn = document.createElement('button');
  editBtn.className = 'brutal-btn btn-sm btn-lime';
  editBtn.innerHTML = '🎬 Edit';
  editBtn.title = 'Cut, delete, copy/paste & reorder clips before compression';
  editBtn.disabled = isVideoConverting;
  editBtn.onclick = () => openTimelineEditor(item);
  actions.appendChild(editBtn);

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
 * Format a queue item's edited timeline as a short summary string for display
 * @param {Object} item
 * @returns {string}
 */
function formatSegmentsSummary(item) {
  const totalSec = item.segments.reduce((sum, s) => sum + (s.sourceEnd - s.sourceStart), 0);
  const m = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const count = item.segments.length;
  return `${count} clip${count === 1 ? '' : 's'}, ${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Open the timeline editor modal for a video queue item
 * @param {Object} item
 */
async function openTimelineEditor(item) {
  const result = await openVideoTimelineEditor(item.file, item.name, item.segments, item.playbackSpeed);
  if (result === false) return; // cancelled — leave item untouched

  item.segments = result.segments; // null (cut edits cleared) or an array of segments
  item.playbackSpeed = result.speed || 1;

  const hasCuts = !!(item.segments && item.segments.length);
  const hasSpeed = item.playbackSpeed !== 1;
  const message = hasCuts || hasSpeed ? `Edits applied to "${item.name}"` : `Edits cleared for "${item.name}"`;
  showToast(message, 'success');
  renderVideoQueueItem(item);
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
  if (videoProgressLabel) videoProgressLabel.textContent = '🎬 Compressing Video...';
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
        segments: item.segments,
        speed: item.playbackSpeed || 1,
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
  if (videoProgressLabel) videoProgressLabel.textContent = '✅ Compressing Done';
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

// ── Timelapse Queue ───────────────────────────────────────────────────────

/** Ordered frames queue for the timelapse builder */
const timelapseQueue = [];
let isTimelapseBuilding = false;
let timelapseResult = null;        // { blob, size, width, height, durationSeconds, frameCount, ext }
let timelapseResultVideoUrl = null;

/**
 * Natural (numeric-aware) filename comparator, so "frame_2.jpg" sorts
 * before "frame_10.jpg" the way most camera/screen-recorder apps intend.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Handle addition of new frame images into the timelapse queue.
 * New frames are appended and the whole queue is re-sorted by filename,
 * since that matches how sequential camera/recorder output is named.
 * @param {File[]} files
 */
function handleTimelapseFilesAdded(files) {
  let addedCount = 0;

  files.forEach((file) => {
    if (!isImageFile(file)) {
      showToast(`Skipped non-image file: ${file.name}`, 'error');
      return;
    }

    timelapseQueue.push({
      id: 'tl_' + Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified || 0,
      previewUrl: URL.createObjectURL(file),
    });
    addedCount++;
  });

  if (addedCount > 0) {
    timelapseQueue.sort((a, b) => naturalCompare(a.name, b.name));
    showToast(`Added ${addedCount} frame(s), sorted by filename`, 'success');
    renderTimelapseQueue();
  }
}

/**
 * Re-sort the timelapse queue by the given strategy.
 * @param {'name'|'date'} mode
 */
function sortTimelapseQueue(mode) {
  if (timelapseQueue.length === 0 || isTimelapseBuilding) return;

  if (mode === 'name') {
    timelapseQueue.sort((a, b) => naturalCompare(a.name, b.name));
    showToast('Frames sorted by filename', 'info');
  } else if (mode === 'date') {
    timelapseQueue.sort((a, b) => a.lastModified - b.lastModified);
    showToast('Frames sorted by date modified', 'info');
  }
  renderTimelapseQueue();
}

/**
 * Move a frame earlier/later in the timelapse sequence.
 * @param {string} id
 * @param {number} delta - -1 to move earlier, +1 to move later
 */
function moveTimelapseFrame(id, delta) {
  if (isTimelapseBuilding) return;
  const index = timelapseQueue.findIndex(i => i.id === id);
  if (index === -1) return;
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= timelapseQueue.length) return;
  const [item] = timelapseQueue.splice(index, 1);
  timelapseQueue.splice(newIndex, 0, item);
  renderTimelapseQueue();
}

/**
 * Remove a frame from the timelapse queue.
 * @param {string} id
 */
function removeTimelapseFrame(id) {
  if (isTimelapseBuilding) return;
  const index = timelapseQueue.findIndex(i => i.id === id);
  if (index !== -1) {
    const item = timelapseQueue[index];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    timelapseQueue.splice(index, 1);
    renderTimelapseQueue();
    showToast('Removed frame from queue', 'info');
  }
}

/**
 * Clear all frames from the timelapse queue.
 */
function clearTimelapseQueue() {
  if (isTimelapseBuilding) return;
  timelapseQueue.forEach(item => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  timelapseQueue.length = 0;
  renderTimelapseQueue();
  showToast('Timelapse queue cleared', 'info');
}

/**
 * Update the live "N frames → ~M:SS at X fps" estimate readout.
 */
function updateTimelapseDurationEstimate() {
  if (!timelapseDurationEstimate) return;

  const frameCount = timelapseQueue.length;
  if (frameCount === 0) {
    timelapseDurationEstimate.textContent = 'Add frames to see estimated duration';
    return;
  }

  const holdFrames = state.settings.tlHoldLastFrame
    ? Math.round(state.settings.tlHoldSeconds * state.settings.tlFps)
    : 0;
  const totalFrames = frameCount + holdFrames;
  const seconds = state.settings.tlFps > 0 ? totalFrames / state.settings.tlFps : 0;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, '0');

  timelapseDurationEstimate.textContent = `${frameCount} frame${frameCount === 1 ? '' : 's'} → ~${m}:${s} at ${state.settings.tlFps} fps`;
}

/**
 * Render the full timelapse frame grid + controls.
 */
function renderTimelapseQueue() {
  const count = timelapseQueue.length;
  const countBadge = document.getElementById('timelapseQueueCountBadge');
  if (countBadge) countBadge.textContent = `${count} Frame${count === 1 ? '' : 's'}`;

  if (count === 0) {
    if (timelapseEmptyState) timelapseEmptyState.style.display = 'block';
    if (timelapseQueueList) timelapseQueueList.style.display = 'none';
    if (timelapseQueueControls) timelapseQueueControls.style.display = 'none';
    if (timelapseBuildBtn) timelapseBuildBtn.disabled = true;
    if (timelapseProgressCard) timelapseProgressCard.style.display = 'none';
    updateTimelapseDurationEstimate();
    return;
  }

  if (timelapseEmptyState) timelapseEmptyState.style.display = 'none';
  if (timelapseQueueList) timelapseQueueList.style.display = 'flex';
  if (timelapseQueueControls) timelapseQueueControls.style.display = 'flex';
  if (timelapseBuildBtn) timelapseBuildBtn.disabled = isTimelapseBuilding || count < 2;

  if (timelapseQueueList) {
    timelapseQueueList.innerHTML = '';
    timelapseQueue.forEach((item, index) => {
      timelapseQueueList.appendChild(createTimelapseFrameElement(item, index, count));
    });
  }

  updateTimelapseDurationEstimate();
}

/**
 * Create a compact frame card: thumbnail, order badge, filename, and
 * move-up/move-down/remove mini-actions.
 * @param {Object} item
 * @param {number} index
 * @param {number} total
 */
function createTimelapseFrameElement(item, index, total) {
  const card = document.createElement('div');
  card.id = item.id;
  card.className = 'frame-card';

  const badge = document.createElement('span');
  badge.className = 'frame-order-badge';
  badge.textContent = String(index + 1);
  card.appendChild(badge);

  const thumbBox = document.createElement('div');
  thumbBox.className = 'frame-thumb';
  const img = document.createElement('img');
  img.src = item.previewUrl;
  img.alt = item.name;
  img.loading = 'lazy';
  thumbBox.appendChild(img);
  card.appendChild(thumbBox);

  const nameEl = document.createElement('div');
  nameEl.className = 'frame-name';
  nameEl.textContent = item.name;
  nameEl.title = item.name;
  card.appendChild(nameEl);

  const actions = document.createElement('div');
  actions.className = 'frame-mini-actions';

  const upBtn = document.createElement('button');
  upBtn.className = 'frame-mini-btn';
  upBtn.innerHTML = '⬆️';
  upBtn.title = 'Move earlier';
  upBtn.disabled = index === 0 || isTimelapseBuilding;
  upBtn.onclick = () => moveTimelapseFrame(item.id, -1);
  actions.appendChild(upBtn);

  const downBtn = document.createElement('button');
  downBtn.className = 'frame-mini-btn';
  downBtn.innerHTML = '⬇️';
  downBtn.title = 'Move later';
  downBtn.disabled = index === total - 1 || isTimelapseBuilding;
  downBtn.onclick = () => moveTimelapseFrame(item.id, 1);
  actions.appendChild(downBtn);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'frame-mini-btn frame-mini-btn-danger';
  removeBtn.innerHTML = '✕';
  removeBtn.title = 'Remove frame';
  removeBtn.disabled = isTimelapseBuilding;
  removeBtn.onclick = () => removeTimelapseFrame(item.id);
  actions.appendChild(removeBtn);

  card.appendChild(actions);

  return card;
}

/**
 * Build the timelapse video from the current queue order and settings.
 */
async function startTimelapseBuild() {
  if (timelapseQueue.length === 0 || isTimelapseBuilding) return;

  if (timelapseQueue.length < 2) {
    showToast('Add at least 2 frames to build a timelapse', 'error');
    return;
  }

  isTimelapseBuilding = true;
  timelapseBuildBtn.disabled = true;
  timelapseDownloadBtn.disabled = true;
  timelapseClearQueueBtn.disabled = true;
  timelapseAddMoreBtn.disabled = true;
  renderTimelapseQueue(); // also disables per-frame reorder/remove buttons

  timelapseProgressCard.style.display = 'block';
  timelapseProgressBarInner.style.width = '0%';
  if (timelapseProgressLabel) timelapseProgressLabel.textContent = '⏱️ Building Timelapse...';
  timelapseProgressText.textContent = 'Loading FFmpeg WASM...';
  if (timelapseProgressLog) timelapseProgressLog.textContent = '';
  if (timelapseResultCard) timelapseResultCard.style.display = 'none';

  try {
    await getFFmpeg((msg) => {
      if (timelapseProgressLog) timelapseProgressLog.textContent = msg;
    });

    const result = await buildTimelapse(
      timelapseQueue.map(item => item.file),
      {
        fps: state.settings.tlFps,
        targetFormat: state.settings.tlFormat,
        crf: state.settings.tlCrf,
        preset: state.settings.tlPreset,
        resolutionCap: state.settings.tlResolutionCap,
        holdLastFrameSeconds: state.settings.tlHoldLastFrame ? state.settings.tlHoldSeconds : 0,
        onProgress: (pct, label) => {
          timelapseProgressBarInner.style.width = `${pct}%`;
          timelapseProgressText.textContent = `${label} (${pct}%)`;
        },
        onLog: (msg) => {
          if (timelapseProgressLog) timelapseProgressLog.textContent = msg;
        }
      }
    );

    timelapseResult = result;
    if (timelapseResultVideoUrl) URL.revokeObjectURL(timelapseResultVideoUrl);
    timelapseResultVideoUrl = URL.createObjectURL(result.blob);

    if (timelapseResultVideo) timelapseResultVideo.src = timelapseResultVideoUrl;
    if (timelapseResultCard) timelapseResultCard.style.display = 'block';
    if (timelapseResultInfo) {
      timelapseResultInfo.textContent = `${result.width}×${result.height} • ${result.frameCount} frames • ${result.durationSeconds.toFixed(1)}s • ${formatBytes(result.size)}`;
    }

    if (timelapseProgressLabel) timelapseProgressLabel.textContent = '✅ Timelapse Built';
    timelapseProgressText.textContent = `Done: ${formatBytes(result.size)}`;
    if (timelapseProgressLog) timelapseProgressLog.textContent = '';
    timelapseDownloadBtn.disabled = false;

    showToast('Timelapse built successfully!', 'success');
  } catch (err) {
    console.error('Failed to build timelapse:', err);
    if (timelapseProgressLabel) timelapseProgressLabel.textContent = '❌ Build Failed';
    timelapseProgressText.textContent = err.message || 'Unknown error';
    showToast(`Failed to build timelapse: ${err.message || 'Unknown error'}`, 'error');
  } finally {
    isTimelapseBuilding = false;
    timelapseClearQueueBtn.disabled = false;
    timelapseAddMoreBtn.disabled = false;
    renderTimelapseQueue();
  }
}

/**
 * Trigger download of the built timelapse video.
 */
function downloadTimelapseResult() {
  if (!timelapseResult) {
    showToast('No timelapse built yet.', 'error');
    return;
  }

  const now = new Date().toISOString().split('T')[0];
  const ext = timelapseResult.ext === 'webm' ? '.webm' : '.mp4';
  triggerDownload(
    timelapseResult.blob,
    `CodedByKay_Timelapse_${timelapseResult.frameCount}frames_${state.settings.tlFps}fps_${now}${ext}`
  );
  showToast('Timelapse downloaded!', 'success');
}
