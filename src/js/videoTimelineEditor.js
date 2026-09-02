/**
 * Video Timeline Editor
 * A lightweight non-linear editor modal: split the source video into clips,
 * delete/copy/paste clips, and reorder them by dragging on a timeline. The
 * edited sequence is expressed as an ordered list of source [start, end]
 * ranges that get stitched together by ffmpeg (trim + concat) at compress time.
 */

const MIN_SEG = 0.08; // seconds — smallest clip a split/drag/paste can produce
const EDGE_EPS = 0.05; // seconds — treated as "touching the edge" for snapping/no-op checks
const FRAME_STEP = 1 / 30; // seconds — approximate single-frame step for arrow-key nudging
const SPEED_MIN = 0.25;
const SPEED_MAX = 10;
const SPEED_STEP = 0.25;
const SEG_COLORS = ['--accent-cyan', '--accent-lime', '--accent-yellow', '--accent-purple', '--accent-pink', '--accent-orange'];

function formatTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
}

/**
 * Open the video timeline editor modal.
 *
 * @param {File} videoFile - the source video File
 * @param {string} videoName - display name for the modal title
 * @param {Array<{sourceStart:number, sourceEnd:number}>|null} [existingSegments] - previously applied edit, if any
 * @param {number} [existingSpeed] - previously applied playback speed (1 = normal), if any
 * @returns {Promise<{ segments: Array<{sourceStart:number, sourceEnd:number}>|null, speed: number }|false>}
 *   - `{ segments, speed }` if the user applied — segments is `null` when cut edits are equivalent to the
 *     untouched source (cleared), speed is 1 when unchanged; either can carry independently of the other
 *   - `false` if the user cancelled/closed without applying
 */
export function openVideoTimelineEditor(videoFile, videoName, existingSegments, existingSpeed) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(videoFile);
    let idCounter = 0;
    const nextId = () => `seg_${++idCounter}`;

    // ── Build overlay ──────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'videoTimelineEditorOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.85);
      z-index: 10000; display: flex; align-items: center;
      justify-content: center; padding: 1.5rem;
    `;

    const panel = document.createElement('div');
    panel.className = 'brutal-card';
    panel.style.cssText = `
      max-width: 900px; width: 100%; max-height: 94vh; overflow-y: auto;
      background-color: var(--bg-card); display: flex; flex-direction: column; gap: 0.9rem;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 3px solid var(--border-color); padding-bottom: 0.75rem;
    `;
    header.innerHTML = `
      <h3 style="font-weight:900; font-size:1.1rem;">🎬 Edit Video — <span style="font-size:0.9rem;opacity:0.75">${videoName}</span></h3>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'brutal-btn btn-sm btn-pink';
    closeBtn.textContent = '✕ Close';
    header.appendChild(closeBtn);

    // Video preview
    const video = document.createElement('video');
    video.style.cssText = `
      width: 100%; max-height: 360px; background: #000;
      border: 3px solid var(--border-color); display: block;
    `;
    video.src = objectUrl;
    video.preload = 'metadata';
    video.controls = false;

    // Playback bar
    const playbackBar = document.createElement('div');
    playbackBar.style.cssText = 'display: flex; align-items: center; gap: 0.75rem;';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'brutal-btn btn-sm btn-cyan';
    playBtn.textContent = '▶ Play Edit';

    const timeReadout = document.createElement('span');
    timeReadout.style.cssText = 'font-family: var(--font-mono); font-weight: 700; font-size: 0.85rem;';
    timeReadout.textContent = '0:00.0 / 0:00.0';

    // Playback speed stepper — affects both the preview and the exported file.
    const speedWrap = document.createElement('div');
    speedWrap.style.cssText = 'display: flex; align-items: center; gap: 0.4rem; margin-left: auto;';

    const speedLabel = document.createElement('span');
    speedLabel.style.cssText = 'font-weight: 800; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);';
    speedLabel.textContent = 'Speed';

    const speedDownBtn = document.createElement('button');
    speedDownBtn.type = 'button';
    speedDownBtn.className = 'brutal-btn btn-sm btn-dark';
    speedDownBtn.textContent = '−';
    speedDownBtn.title = 'Slow down playback (and the exported video)';

    const speedReadout = document.createElement('span');
    speedReadout.style.cssText = 'font-family: var(--font-mono); font-weight: 700; font-size: 0.85rem; min-width: 3.2em; text-align: center;';
    speedReadout.textContent = '1x';

    const speedUpBtn = document.createElement('button');
    speedUpBtn.type = 'button';
    speedUpBtn.className = 'brutal-btn btn-sm btn-dark';
    speedUpBtn.textContent = '+';
    speedUpBtn.title = 'Speed up playback (and the exported video)';

    const speedOutputReadout = document.createElement('span');
    speedOutputReadout.style.cssText = 'font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);';
    speedOutputReadout.textContent = '';

    speedWrap.appendChild(speedLabel);
    speedWrap.appendChild(speedDownBtn);
    speedWrap.appendChild(speedReadout);
    speedWrap.appendChild(speedUpBtn);
    speedWrap.appendChild(speedOutputReadout);

    playbackBar.appendChild(playBtn);
    playbackBar.appendChild(timeReadout);
    playbackBar.appendChild(speedWrap);

    // Timeline label
    const timelineLabel = document.createElement('div');
    timelineLabel.style.cssText = 'font-weight: 800; font-size: 0.8rem; text-transform: uppercase; margin-top: 0.2rem;';
    timelineLabel.textContent = 'Timeline';

    // Timeline track
    const track = document.createElement('div');
    track.style.cssText = `
      position: relative; display: flex; height: 64px; width: 100%;
      border: 3px solid var(--border-color); background: var(--bg-primary);
      overflow: hidden; cursor: pointer; user-select: none;
    `;

    // Draggable playhead: a wide invisible hit-area (easy to grab) with a
    // thin visual line + a grip square at the top so it reads as scrubbable.
    const playhead = document.createElement('div');
    playhead.style.cssText = `
      position: absolute; top: 0; bottom: 0; width: 18px; margin-left: -9px;
      left: 0%; z-index: 6; cursor: ew-resize;
    `;
    const playheadLine = document.createElement('div');
    playheadLine.style.cssText = `
      position: absolute; top: 0; bottom: 0; left: 50%; width: 3px; margin-left: -1.5px;
      background: #fff; box-shadow: 0 0 0 1px #000; pointer-events: none;
    `;
    const playheadGrip = document.createElement('div');
    playheadGrip.style.cssText = `
      position: absolute; top: 0; left: 50%; width: 14px; height: 10px; margin-left: -7px;
      background: #fff; border: 2px solid #000; pointer-events: none;
    `;
    playhead.appendChild(playheadLine);
    playhead.appendChild(playheadGrip);

    const trackInner = document.createElement('div');
    trackInner.style.cssText = 'display: flex; width: 100%; height: 100%;';
    track.appendChild(trackInner);
    track.appendChild(playhead);

    // Selected clip info
    const selectedInfo = document.createElement('p');
    selectedInfo.style.cssText = `
      font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);
      min-height: 1.1em;
    `;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap;';

    const splitBtn = document.createElement('button');
    splitBtn.className = 'brutal-btn btn-sm btn-yellow';
    splitBtn.innerHTML = '✂️ Split at Playhead';
    splitBtn.title = 'Split the clip under the playhead into two (S)';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'brutal-btn btn-sm btn-pink';
    deleteBtn.innerHTML = '🗑️ Delete Clip';
    deleteBtn.title = 'Remove the selected clip and close the gap (Delete)';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'brutal-btn btn-sm btn-cyan';
    copyBtn.innerHTML = '📋 Copy Clip';
    copyBtn.title = 'Copy the selected clip (Ctrl+C)';

    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'brutal-btn btn-sm btn-cyan';
    pasteBtn.innerHTML = '📥 Paste After';
    pasteBtn.title = 'Insert a copy of the clipboard clip after the selected clip (Ctrl+V)';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'brutal-btn btn-sm btn-dark';
    resetBtn.innerHTML = '↺ Reset All';
    resetBtn.title = 'Undo all edits — back to the full, single-clip video';

    toolbar.appendChild(splitBtn);
    toolbar.appendChild(deleteBtn);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(pasteBtn);
    toolbar.appendChild(resetBtn);

    // Status / hint line
    const statusLine = document.createElement('p');
    statusLine.style.cssText = `
      font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700;
      color: var(--accent-pink, #ff2e93); min-height: 1.1em;
    `;

    const hintLine = document.createElement('p');
    hintLine.style.cssText = 'font-size: 0.75rem; color: var(--text-muted);';
    hintLine.textContent = 'Click the timeline, or drag the white playhead handle, to scrub & select a clip. Drag a clip left/right to reorder it. Shortcuts: Space play/pause, ←/→ step a frame, S split, Delete remove, Ctrl+C/V copy/paste.';

    // Footer actions
    const actionsWrap = document.createElement('div');
    actionsWrap.style.cssText = 'display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: flex-end; border-top: 3px solid var(--border-color); padding-top: 0.75rem;';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'brutal-btn btn-sm btn-dark';
    cancelBtn.textContent = 'Cancel';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'brutal-btn btn-lime';
    applyBtn.textContent = '✅ Apply Edits';

    actionsWrap.appendChild(cancelBtn);
    actionsWrap.appendChild(applyBtn);

    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(video);
    panel.appendChild(playbackBar);
    panel.appendChild(timelineLabel);
    panel.appendChild(track);
    panel.appendChild(selectedInfo);
    panel.appendChild(toolbar);
    panel.appendChild(statusLine);
    panel.appendChild(hintLine);
    panel.appendChild(actionsWrap);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // ── State ──────────────────────────────────────────────────────────────
    let duration = 0;
    let segments = null; // Array<{id, sourceStart, sourceEnd}> — set once duration is known
    let selectedId = null;
    let clipboard = null; // {sourceStart, sourceEnd}
    let playheadSeqTime = 0;
    let currentPlaybackIndex = 0;
    let statusTimer = null;
    let playbackSpeed = 1;
    const initialSpeed = (typeof existingSpeed === 'number' && existingSpeed > 0) ? existingSpeed : 1;

    function flashStatus(msg) {
      statusLine.textContent = msg;
      if (statusTimer) clearTimeout(statusTimer);
      statusTimer = setTimeout(() => { statusLine.textContent = ''; }, 2600);
    }

    function setPlaybackSpeed(speed) {
      playbackSpeed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, speed));
      video.playbackRate = playbackSpeed;
      speedReadout.textContent = `${playbackSpeed.toFixed(playbackSpeed % 1 === 0 ? 0 : 2)}x`;
      updateSpeedOutputReadout();
    }

    function updateSpeedOutputReadout() {
      if (!segments || !segments.length) { speedOutputReadout.textContent = ''; return; }
      const outputLen = totalSeqDuration() / playbackSpeed;
      speedOutputReadout.textContent = playbackSpeed === 1 ? '' : `→ ${formatTime(outputLen)} output`;
    }

    function totalSeqDuration() {
      if (!segments) return 0;
      return segments.reduce((sum, s) => sum + (s.sourceEnd - s.sourceStart), 0);
    }

    function segmentIndexAtSeqTime(t) {
      let acc = 0;
      for (let i = 0; i < segments.length; i++) {
        const len = segments[i].sourceEnd - segments[i].sourceStart;
        if (t < acc + len || i === segments.length - 1) return i;
        acc += len;
      }
      return 0;
    }

    function seqTimeToSource(t) {
      const idx = segmentIndexAtSeqTime(t);
      let acc = 0;
      for (let i = 0; i < idx; i++) acc += (segments[i].sourceEnd - segments[i].sourceStart);
      const seg = segments[idx];
      const len = seg.sourceEnd - seg.sourceStart;
      return seg.sourceStart + Math.max(0, Math.min(len, t - acc));
    }

    function pauseIfPlaying() {
      if (!video.paused) video.pause();
    }

    function seekSequence(t) {
      if (!segments || !segments.length) return;
      pauseIfPlaying();
      playheadSeqTime = Math.max(0, Math.min(totalSeqDuration(), t));
      currentPlaybackIndex = segmentIndexAtSeqTime(playheadSeqTime);
      video.currentTime = seqTimeToSource(playheadSeqTime);
      updatePlayheadUI();
    }

    // ── Rendering ──────────────────────────────────────────────────────────
    function updatePlayheadUI() {
      const total = totalSeqDuration();
      const pct = total ? (playheadSeqTime / total) * 100 : 0;
      playhead.style.left = `${pct}%`;
      timeReadout.textContent = `${formatTime(playheadSeqTime)} / ${formatTime(total)}`;

      const selSeg = segments && segments.find(s => s.id === selectedId);
      if (selSeg) {
        const idx = segments.findIndex(s => s.id === selectedId);
        selectedInfo.textContent = `Selected: Clip ${idx + 1} of ${segments.length} — source ${formatTime(selSeg.sourceStart)}–${formatTime(selSeg.sourceEnd)} (${formatTime(selSeg.sourceEnd - selSeg.sourceStart)})`;
      } else {
        selectedInfo.textContent = segments ? 'No clip selected — click a piece on the timeline.' : '';
      }

      deleteBtn.disabled = !selSeg || segments.length <= 1;
      copyBtn.disabled = !selSeg;
      pasteBtn.disabled = !clipboard;
      timelineLabel.textContent = segments
        ? `Timeline — ${segments.length} clip${segments.length === 1 ? '' : 's'}, ${formatTime(total)} total (source is ${formatTime(duration)})`
        : 'Timeline';

      updateSpeedOutputReadout();
    }

    function render() {
      trackInner.innerHTML = '';
      if (!segments || !segments.length) {
        updatePlayheadUI();
        return;
      }
      const total = totalSeqDuration();

      segments.forEach((seg, i) => {
        const len = seg.sourceEnd - seg.sourceStart;
        const pct = total ? (len / total) * 100 : 0;
        const isSelected = seg.id === selectedId;

        const block = document.createElement('div');
        block.dataset.segId = seg.id;
        block.style.cssText = `
          flex: 0 0 ${pct}%; min-width: 14px; height: 100%;
          background-color: var(${SEG_COLORS[i % SEG_COLORS.length]});
          border-right: 2px solid var(--border-color);
          box-sizing: border-box; cursor: grab;
          display: flex; align-items: flex-end; justify-content: center;
          padding-bottom: 2px; overflow: hidden;
          ${isSelected ? 'outline: 3px solid #fff; outline-offset: -3px; box-shadow: inset 0 0 0 2px #000;' : ''}
        `;
        block.title = `Clip ${i + 1}: ${formatTime(seg.sourceStart)}–${formatTime(seg.sourceEnd)}`;

        if (pct > 4) {
          const lbl = document.createElement('span');
          lbl.style.cssText = 'font-size: 0.65rem; font-weight: 900; color: #000; font-family: var(--font-mono); white-space: nowrap;';
          lbl.textContent = formatTime(len);
          block.appendChild(lbl);
        }

        block.addEventListener('mousedown', (e) => onBlockMouseDown(e, seg.id));
        trackInner.appendChild(block);
      });

      updatePlayheadUI();
    }

    // ── Timeline drag / click-to-seek / reorder ───────────────────────────
    function onBlockMouseDown(e, segId) {
      e.preventDefault();
      pauseIfPlaying();
      selectedId = segId;
      render();

      const startX = e.clientX;
      let moved = false;

      function onMove(ev) {
        if (Math.abs(ev.clientX - startX) > 4) moved = true;
        if (!moved) return;

        const rect = track.getBoundingClientRect();
        const relX = Math.min(Math.max(ev.clientX - rect.left, 0), rect.width);
        const total = totalSeqDuration();
        let acc = 0;
        let targetIndex = segments.length - 1;
        for (let i = 0; i < segments.length; i++) {
          const segLen = segments[i].sourceEnd - segments[i].sourceStart;
          const segPxWidth = total ? (segLen / total) * rect.width : 0;
          if (relX < acc + segPxWidth / 2) { targetIndex = i; break; }
          acc += segPxWidth;
        }
        const curIndex = segments.findIndex(s => s.id === segId);
        if (curIndex !== -1 && targetIndex !== curIndex) {
          const [movedSeg] = segments.splice(curIndex, 1);
          segments.splice(targetIndex, 0, movedSeg);
          render();
        }
      }

      function onUp(ev) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        if (!moved) {
          // Treat as a click: seek playhead to the clicked position within this block.
          const blockEl = trackInner.querySelector(`[data-seg-id="${segId}"]`);
          if (blockEl) {
            const rect = blockEl.getBoundingClientRect();
            const relX = Math.min(Math.max(ev.clientX - rect.left, 0), rect.width);
            const seg = segments.find(s => s.id === segId);
            const idx = segments.findIndex(s => s.id === segId);
            let acc = 0;
            for (let i = 0; i < idx; i++) acc += (segments[i].sourceEnd - segments[i].sourceStart);
            const localFrac = rect.width ? relX / rect.width : 0;
            seekSequence(acc + (seg.sourceEnd - seg.sourceStart) * localFrac);
          }
        } else {
          seekSequence(playheadSeqTime);
        }
        render();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    // ── Editing operations ────────────────────────────────────────────────
    function splitAtPlayhead() {
      if (!segments || !segments.length) return;
      const idx = segmentIndexAtSeqTime(playheadSeqTime);
      const seg = segments[idx];
      const srcT = seqTimeToSource(playheadSeqTime);
      if (srcT - seg.sourceStart < MIN_SEG || seg.sourceEnd - srcT < MIN_SEG) {
        flashStatus('⚠️ Move the playhead away from a clip edge before splitting.');
        return;
      }
      const left = { id: nextId(), sourceStart: seg.sourceStart, sourceEnd: srcT };
      const right = { id: nextId(), sourceStart: srcT, sourceEnd: seg.sourceEnd };
      segments.splice(idx, 1, left, right);
      selectedId = right.id;
      render();
    }

    function deleteSelected() {
      if (!segments) return;
      const idx = segments.findIndex(s => s.id === selectedId);
      if (idx === -1) return;
      if (segments.length <= 1) {
        flashStatus('⚠️ At least one clip must remain.');
        return;
      }
      segments.splice(idx, 1);
      selectedId = segments[Math.min(idx, segments.length - 1)]?.id ?? null;
      playheadSeqTime = Math.min(playheadSeqTime, totalSeqDuration());
      render();
      seekSequence(playheadSeqTime);
    }

    function copySelected() {
      const seg = segments && segments.find(s => s.id === selectedId);
      if (!seg) return;
      clipboard = { sourceStart: seg.sourceStart, sourceEnd: seg.sourceEnd };
      flashStatus('📋 Clip copied.');
      updatePlayheadUI();
    }

    function pasteAfterSelected() {
      if (!clipboard || !segments) return;
      const idx = segments.findIndex(s => s.id === selectedId);
      const insertAt = idx === -1 ? segments.length : idx + 1;
      const copy = { id: nextId(), sourceStart: clipboard.sourceStart, sourceEnd: clipboard.sourceEnd };
      segments.splice(insertAt, 0, copy);
      selectedId = copy.id;
      flashStatus('📥 Clip pasted.');
      render();
    }

    function resetAll() {
      if (!duration) return;
      segments = [{ id: nextId(), sourceStart: 0, sourceEnd: duration }];
      selectedId = segments[0].id;
      clipboard = null;
      playheadSeqTime = 0;
      currentPlaybackIndex = 0;
      setPlaybackSpeed(1);
      render();
      seekSequence(0);
    }

    // ── Playback of the edited sequence ───────────────────────────────────
    function playPause() {
      if (!segments || !segments.length) return;
      if (video.paused) {
        currentPlaybackIndex = segmentIndexAtSeqTime(playheadSeqTime);
        video.currentTime = seqTimeToSource(playheadSeqTime);
        video.play();
      } else {
        video.pause();
      }
    }

    video.addEventListener('play', () => { playBtn.textContent = '⏸ Pause'; });
    video.addEventListener('pause', () => { playBtn.textContent = '▶ Play Edit'; });

    video.addEventListener('timeupdate', () => {
      if (!segments || !segments.length || video.paused) return;
      const seg = segments[currentPlaybackIndex];
      if (!seg) { video.pause(); return; }

      if (video.currentTime >= seg.sourceEnd - 0.03) {
        currentPlaybackIndex++;
        if (currentPlaybackIndex >= segments.length) {
          video.pause();
          currentPlaybackIndex = segments.length - 1;
          playheadSeqTime = totalSeqDuration();
          updatePlayheadUI();
          return;
        }
        video.currentTime = segments[currentPlaybackIndex].sourceStart;
      }

      let acc = 0;
      for (let i = 0; i < currentPlaybackIndex; i++) acc += (segments[i].sourceEnd - segments[i].sourceStart);
      playheadSeqTime = acc + Math.max(0, video.currentTime - segments[currentPlaybackIndex].sourceStart);
      updatePlayheadUI();
    });

    // ── Metadata load / initial segments ──────────────────────────────────
    video.addEventListener('loadedmetadata', () => {
      duration = video.duration || 0;

      if (existingSegments && existingSegments.length) {
        segments = existingSegments.map(s => ({
          id: nextId(),
          sourceStart: Math.max(0, Math.min(duration, s.sourceStart)),
          sourceEnd: Math.max(0, Math.min(duration, s.sourceEnd))
        })).filter(s => s.sourceEnd - s.sourceStart > 0.01);
      }
      if (!segments || !segments.length) {
        segments = [{ id: nextId(), sourceStart: 0, sourceEnd: duration }];
      }
      selectedId = segments[0].id;
      setPlaybackSpeed(initialSpeed);
      render();
      seekSequence(0);
    });

    // ── Button wiring ──────────────────────────────────────────────────────
    playBtn.addEventListener('click', playPause);
    speedDownBtn.addEventListener('click', () => setPlaybackSpeed(playbackSpeed - SPEED_STEP));
    speedUpBtn.addEventListener('click', () => setPlaybackSpeed(playbackSpeed + SPEED_STEP));
    splitBtn.addEventListener('click', splitAtPlayhead);
    deleteBtn.addEventListener('click', deleteSelected);
    copyBtn.addEventListener('click', copySelected);
    pasteBtn.addEventListener('click', pasteAfterSelected);
    resetBtn.addEventListener('click', resetAll);

    track.addEventListener('click', (e) => {
      // Fallback for clicks that land on the track but not on any block (e.g. rounding gaps).
      if (e.target !== track) return;
      const rect = track.getBoundingClientRect();
      const relX = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const total = totalSeqDuration();
      seekSequence(rect.width ? (relX / rect.width) * total : 0);
    });

    // Drag the playhead itself to scrub, like a normal editor's timeline cursor.
    playhead.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!segments || !segments.length) return;
      pauseIfPlaying();

      function scrubTo(clientX) {
        const rect = track.getBoundingClientRect();
        const relX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
        const total = totalSeqDuration();
        seekSequence(rect.width ? (relX / rect.width) * total : 0);
      }

      function onMove(ev) { scrubTo(ev.clientX); }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      scrubTo(e.clientX);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    function cleanup(result) {
      document.removeEventListener('keydown', onKeyDown);
      video.pause();
      URL.revokeObjectURL(objectUrl);
      overlay.remove();
      resolve(result);
    }

    function onKeyDown(e) {
      if (e.code === 'Space') { e.preventDefault(); playPause(); }
      else if (e.key === 's' || e.key === 'S') { splitAtPlayhead(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteAfterSelected(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekSequence(playheadSeqTime - FRAME_STEP); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekSequence(playheadSeqTime + FRAME_STEP); }
      else if (e.key === 'Escape') { cleanup(false); }
    }
    document.addEventListener('keydown', onKeyDown);

    cancelBtn.addEventListener('click', () => cleanup(false));
    closeBtn.addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    applyBtn.addEventListener('click', () => {
      if (!segments || !segments.length) { cleanup(false); return; }
      const isNoOp = segments.length === 1
        && segments[0].sourceStart <= EDGE_EPS
        && (duration - segments[0].sourceEnd) <= EDGE_EPS;

      const segmentsOut = isNoOp
        ? null
        : segments.map(s => ({
            sourceStart: +s.sourceStart.toFixed(3),
            sourceEnd: +s.sourceEnd.toFixed(3)
          }));
      cleanup({ segments: segmentsOut, speed: playbackSpeed });
    });
  });
}
