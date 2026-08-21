/**
 * Video Thumbnail Scrubber Modal
 * Renders a full-screen modal with an HTML5 video player + scrubber.
 * The user can seek to any frame and capture it as a PNG thumbnail blob.
 */

/**
 * Open the video thumbnail scrubber modal.
 * Returns a Promise that resolves with a Blob (PNG image) when the user
 * clicks "Capture Frame", or null if they close/cancel.
 *
 * @param {File} videoFile - the source video File
 * @param {string} videoName - display name for the modal title
 * @returns {Promise<Blob|null>}
 */
export function openVideoThumbnailScrubber(videoFile, videoName) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(videoFile);

    // ── Build overlay ──────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'videoScrubberOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.82);
      z-index: 10000; display: flex; align-items: center;
      justify-content: center; padding: 1.5rem;
    `;

    const panel = document.createElement('div');
    panel.className = 'brutal-card';
    panel.style.cssText = `
      max-width: 820px; width: 100%; max-height: 92vh; overflow-y: auto;
      background-color: var(--bg-card); display: flex; flex-direction: column; gap: 1rem;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 3px solid var(--border-color); padding-bottom: 0.75rem;
    `;
    header.innerHTML = `
      <h3 style="font-weight:900; font-size:1.1rem;">🎬 Pick Thumbnail Frame — <span style="font-size:0.9rem;opacity:0.75">${videoName}</span></h3>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'brutal-btn btn-sm btn-pink';
    closeBtn.textContent = '✕ Close';
    header.appendChild(closeBtn);

    // Video player
    const video = document.createElement('video');
    video.style.cssText = `
      width: 100%; max-height: 420px; background: #000;
      border: 3px solid var(--border-color); display: block;
      object-fit: contain;
    `;
    video.src = objectUrl;
    video.preload = 'metadata';
    video.controls = false; // we build our own scrubber

    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.style.cssText = `
      font-family: var(--font-mono); font-weight: 700; font-size: 0.85rem;
      text-align: right; color: var(--text-muted);
    `;
    timeDisplay.textContent = '0:00 / 0:00';

    // Scrubber (timeline slider)
    const scrubberWrap = document.createElement('div');
    scrubberWrap.style.cssText = 'display: flex; gap: 0.75rem; align-items: center;';

    const playBtn = document.createElement('button');
    playBtn.className = 'brutal-btn btn-sm btn-cyan';
    playBtn.textContent = '▶ Play';

    const scrubber = document.createElement('input');
    scrubber.type = 'range';
    scrubber.className = 'brutal-range';
    scrubber.style.flex = '1';
    scrubber.min = '0';
    scrubber.max = '1000';
    scrubber.value = '0';
    scrubber.step = '1';

    scrubberWrap.appendChild(playBtn);
    scrubberWrap.appendChild(scrubber);

    // Preview canvas (shows the frame that will be captured)
    const previewSection = document.createElement('div');
    previewSection.style.cssText = 'display:flex; gap:1rem; align-items:flex-start; flex-wrap:wrap;';

    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'flex:1; min-width:180px;';

    const canvasLabel = document.createElement('p');
    canvasLabel.style.cssText = 'font-weight:800; font-size:0.8rem; text-transform:uppercase; margin-bottom:0.4rem;';
    canvasLabel.textContent = 'Frame Preview';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      width: 100%; max-width: 320px; display: block;
      border: 3px solid var(--border-color); background: #111;
    `;
    canvas.width = 320;
    canvas.height = 180;

    canvasWrap.appendChild(canvasLabel);
    canvasWrap.appendChild(canvas);
    previewSection.appendChild(canvasWrap);

    // Capture controls
    const controlsWrap = document.createElement('div');
    controlsWrap.style.cssText = 'display:flex; flex-direction:column; gap:0.75rem; min-width:160px;';

    const captureBtn = document.createElement('button');
    captureBtn.className = 'brutal-btn btn-lime';
    captureBtn.innerHTML = '📸 Use This Frame';
    captureBtn.style.whiteSpace = 'nowrap';

    const frameInfo = document.createElement('p');
    frameInfo.style.cssText = 'font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);';
    frameInfo.textContent = 'Seek to desired frame, then capture.';

    controlsWrap.appendChild(captureBtn);
    controlsWrap.appendChild(frameInfo);
    previewSection.appendChild(controlsWrap);

    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(video);
    panel.appendChild(timeDisplay);
    panel.appendChild(scrubberWrap);
    panel.appendChild(previewSection);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // ── Helpers ────────────────────────────────────────────────────────────
    const ctx = canvas.getContext('2d');

    function formatTime(s) {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    function drawFrame() {
      // Fit video frame into canvas preserving aspect ratio
      const vw = video.videoWidth || 320;
      const vh = video.videoHeight || 180;
      const scale = Math.min(canvas.width / vw, canvas.height / vh);
      const dw = Math.round(vw * scale);
      const dh = Math.round(vh * scale);
      const dx = Math.round((canvas.width - dw) / 2);
      const dy = Math.round((canvas.height - dh) / 2);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, dx, dy, dw, dh);
    }

    function updateTimeDisplay() {
      timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration || 0)}`;
    }

    function cleanup(result) {
      video.pause();
      URL.revokeObjectURL(objectUrl);
      overlay.remove();
      resolve(result);
    }

    // ── Video events ───────────────────────────────────────────────────────
    video.addEventListener('loadedmetadata', () => {
      // Set canvas aspect ratio to match video
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw && vh) {
        const maxW = 320;
        const scale = maxW / vw;
        canvas.width = maxW;
        canvas.height = Math.round(vh * scale);
      }
      updateTimeDisplay();
    });

    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      scrubber.value = String(Math.round((video.currentTime / video.duration) * 1000));
      updateTimeDisplay();
      drawFrame();
    });

    video.addEventListener('seeked', () => {
      drawFrame();
      updateTimeDisplay();
    });

    // ── Scrubber interaction ───────────────────────────────────────────────
    scrubber.addEventListener('input', () => {
      if (!video.duration) return;
      video.currentTime = (parseInt(scrubber.value) / 1000) * video.duration;
    });

    // ── Play/Pause button ──────────────────────────────────────────────────
    playBtn.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        playBtn.textContent = '⏸ Pause';
      } else {
        video.pause();
        playBtn.textContent = '▶ Play';
      }
    });

    video.addEventListener('pause', () => { playBtn.textContent = '▶ Play'; });
    video.addEventListener('play', () => { playBtn.textContent = '⏸ Pause'; });
    video.addEventListener('ended', () => { playBtn.textContent = '▶ Play'; });

    // ── Capture frame ──────────────────────────────────────────────────────
    captureBtn.addEventListener('click', () => {
      video.pause();
      drawFrame();
      canvas.toBlob((blob) => {
        if (blob) {
          frameInfo.textContent = `✅ Captured at ${formatTime(video.currentTime)}`;
          captureBtn.textContent = '✅ Captured!';
          captureBtn.disabled = true;
          setTimeout(() => cleanup(blob), 600);
        } else {
          frameInfo.textContent = '❌ Frame capture failed.';
        }
      }, 'image/png');
    });

    // ── Close ──────────────────────────────────────────────────────────────
    closeBtn.addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null);
    });

    // Draw first frame once ready
    video.addEventListener('loadeddata', () => {
      video.currentTime = 0.01;
    });
  });
}
