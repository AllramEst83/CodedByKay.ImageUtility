/**
 * Client-side Timelapse Builder using ffmpeg.wasm's image sequence input.
 * Stitches an ordered sequence of still-image frames (e.g. JPEGs captured
 * by a drawing time-lapse app) into a single MP4/WebM video.
 */
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './videoConverter.js';
import { loadImageFile } from './converter.js';

/** Max long-edge (px) for each resolution cap preset; null = no downscale */
export const RESOLUTION_CAPS = {
  original: null,
  '1920': 1920,
  '1280': 1280,
  '854': 854,
};

function evenify(n) {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v - 1;
}

/**
 * Resize an image File onto a canvas of a fixed WxH (cover/crop fit, so
 * every frame ends up pixel-identical in size regardless of small drift in
 * the source camera's output), returning a JPEG blob ready for ffmpeg's FS.
 * @param {File} file
 * @param {number} targetW
 * @param {number} targetH
 * @returns {Promise<Blob>}
 */
async function renderFrame(file, targetW, targetH) {
  const { img, width, height } = await loadImageFile(file);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas context');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const srcAspect = width / height;
  const dstAspect = targetW / targetH;
  let sx, sy, sw, sh;
  if (srcAspect > dstAspect) {
    sh = height;
    sw = height * dstAspect;
    sx = (width - sw) / 2;
    sy = 0;
  } else {
    sw = width;
    sh = width / dstAspect;
    sx = 0;
    sy = (height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Failed to render frame: ${file.name}`))),
      'image/jpeg',
      0.92
    );
  });
}

/**
 * Build an MP4/WebM timelapse from an ordered array of image Files.
 * @param {File[]} frameFiles - frames in playback order
 * @param {Object} options
 * @param {number} [options.fps] - output frame rate
 * @param {'video/mp4'|'video/webm'} [options.targetFormat]
 * @param {number} [options.crf]
 * @param {string} [options.preset] - x264 preset (ignored for webm)
 * @param {'original'|'1920'|'1280'|'854'} [options.resolutionCap]
 * @param {number} [options.holdLastFrameSeconds] - freeze the final frame this many extra seconds
 * @param {function(number, string): void} [options.onProgress] - (percent 0-100, phase label)
 * @param {function(string): void} [options.onLog]
 * @returns {Promise<{blob: Blob, size: number, width: number, height: number, durationSeconds: number, frameCount: number, ext: string}>}
 */
export async function buildTimelapse(frameFiles, options = {}) {
  const {
    fps = 12,
    targetFormat = 'video/mp4',
    crf = 23,
    preset = 'fast',
    resolutionCap = '1280',
    holdLastFrameSeconds = 0,
    onProgress,
    onLog
  } = options;

  if (!frameFiles || frameFiles.length === 0) {
    throw new Error('No frames provided');
  }

  const report = (percent, label) => {
    if (onProgress) onProgress(Math.min(100, Math.round(percent)), label);
  };

  report(0, 'Reading first frame...');
  const first = await loadImageFile(frameFiles[0]);
  const maxLongEdge = Object.prototype.hasOwnProperty.call(RESOLUTION_CAPS, resolutionCap)
    ? RESOLUTION_CAPS[resolutionCap]
    : RESOLUTION_CAPS.original;

  let targetW = first.width;
  let targetH = first.height;
  if (maxLongEdge && Math.max(targetW, targetH) > maxLongEdge) {
    const scale = maxLongEdge / Math.max(targetW, targetH);
    targetW = targetW * scale;
    targetH = targetH * scale;
  }
  targetW = evenify(targetW);
  targetH = evenify(targetH);

  const ff = await getFFmpeg(onLog);

  const holdFrames = holdLastFrameSeconds > 0 ? Math.round(holdLastFrameSeconds * fps) : 0;
  const totalFrames = frameFiles.length + holdFrames;
  const padLen = Math.max(5, String(totalFrames).length);

  const written = [];
  let lastFrameName = null;

  try {
    for (let i = 0; i < frameFiles.length; i++) {
      const blob = await renderFrame(frameFiles[i], targetW, targetH);
      const name = `frame_${String(i + 1).padStart(padLen, '0')}.jpg`;
      await ff.writeFile(name, await fetchFile(blob));
      written.push(name);
      lastFrameName = name;

      // Frame prep (decode + resize + write) is usually the slow part for
      // large batches — weight it as the first ~65% of overall progress.
      const preparePct = ((i + 1) / frameFiles.length) * 65;
      report(preparePct, `Preparing frame ${i + 1} / ${frameFiles.length}`);
    }

    if (holdFrames > 0 && lastFrameName) {
      const lastData = await ff.readFile(lastFrameName);
      for (let h = 0; h < holdFrames; h++) {
        const name = `frame_${String(frameFiles.length + h + 1).padStart(padLen, '0')}.jpg`;
        await ff.writeFile(name, lastData);
        written.push(name);
      }
    }

    report(66, 'Encoding video...');

    const isWebm = targetFormat === 'video/webm';
    const ext = isWebm ? 'webm' : 'mp4';
    const outputName = `timelapse_output.${ext}`;

    const videoCodecArgs = isWebm
      ? ['-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-pix_fmt', 'yuv420p']
      : ['-c:v', 'libx264', '-crf', String(crf), '-preset', preset, '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

    const recentLogs = [];
    const logCapture = ({ message }) => {
      recentLogs.push(message);
      if (recentLogs.length > 15) recentLogs.shift();
    };
    ff.on('log', logCapture);

    const onProgressWrapped = ({ progress }) => {
      const clamped = Math.min(1, Math.max(0, progress));
      report(66 + clamped * 34, `Encoding video... ${Math.round(clamped * 100)}%`);
    };
    ff.on('progress', onProgressWrapped);

    const args = [
      '-y',
      '-framerate', String(fps),
      '-start_number', '1',
      '-i', `frame_%0${padLen}d.jpg`,
      '-r', String(fps),
      ...videoCodecArgs,
      outputName
    ];

    let exitCode;
    try {
      exitCode = await ff.exec(args);
    } finally {
      ff.off('log', logCapture);
      ff.off('progress', onProgressWrapped);
    }

    if (exitCode !== 0) {
      throw new Error(`FFmpeg failed (exit ${exitCode}): ${recentLogs.slice(-4).join(' | ') || 'no output produced'}`);
    }

    const data = await ff.readFile(outputName);
    const blob = new Blob([data.buffer], { type: targetFormat });

    try { await ff.deleteFile(outputName); } catch (_) {}

    report(100, 'Done');

    return {
      blob,
      size: blob.size,
      width: targetW,
      height: targetH,
      durationSeconds: totalFrames / fps,
      frameCount: totalFrames,
      ext
    };
  } finally {
    for (const name of written) {
      try { await ff.deleteFile(name); } catch (_) {}
    }
  }
}
