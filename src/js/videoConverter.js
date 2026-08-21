/**
 * Client-side Video Compressor using @ffmpeg/ffmpeg (WebAssembly)
 * Supports: .mp4, .webm, .mov, .avi, .mkv, .ogv → .mp4 or .webm output
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance = null;
let isLoaded = false;
let isLoading = false;

/**
 * Lazy-load and cache the FFmpeg WASM instance.
 * @param {function(string): void} [onLog] - optional log callback
 * @returns {Promise<FFmpeg>}
 */
export async function getFFmpeg(onLog) {
  if (isLoaded && ffmpegInstance) return ffmpegInstance;

  if (isLoading) {
    // Wait for the existing load to finish
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (isLoaded && ffmpegInstance) {
          clearInterval(check);
          resolve(ffmpegInstance);
        }
      }, 200);
      setTimeout(() => {
        clearInterval(check);
        reject(new Error('FFmpeg load timeout'));
      }, 60000);
    });
  }

  isLoading = true;

  const ff = new FFmpeg();

  if (onLog) {
    ff.on('log', ({ message }) => onLog(message));
  }

  // Load from CDN – uses SharedArrayBuffer via COOP/COEP headers when available,
  // falls back gracefully in most browsers.
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ff;
  isLoaded = true;
  isLoading = false;

  return ff;
}

/**
 * Compress / transcode a video File to mp4 or webm using ffmpeg.wasm.
 * @param {File} file - source video File object
 * @param {Object} options
 * @param {'video/mp4'|'video/webm'} options.targetFormat - output container/codec
 * @param {number} options.crf - quality (0-51 for x264/5, lower = better; 18-28 recommended)
 * @param {string} options.preset - ffmpeg x264 preset (e.g. 'fast', 'medium', 'slow')
 * @param {function(number): void} [options.onProgress] - progress callback 0-100
 * @param {function(string): void} [options.onLog] - log callback
 * @returns {Promise<{blob: Blob, size: number, ext: string}>}
 */
export async function compressVideo(file, options = {}) {
  const {
    targetFormat = 'video/mp4',
    crf = 23,
    preset = 'fast',
    onProgress,
    onLog
  } = options;

  const ff = await getFFmpeg(onLog);

  // Determine output extension and codec args
  const isWebm = targetFormat === 'video/webm';
  const ext = isWebm ? 'webm' : 'mp4';
  const inputName = `input.${file.name.split('.').pop().toLowerCase()}`;
  const outputName = `output.${ext}`;

  // Write input file to ffmpeg's virtual FS
  await ff.writeFile(inputName, await fetchFile(file));

  // Listen to progress
  if (onProgress) {
    ff.on('progress', ({ progress }) => {
      onProgress(Math.min(99, Math.round(progress * 100)));
    });
  }

  // Build ffmpeg args
  let args;
  if (isWebm) {
    // VP9 for webm
    args = [
      '-i', inputName,
      '-c:v', 'libvpx-vp9',
      '-crf', String(crf),
      '-b:v', '0',
      '-c:a', 'libopus',
      '-b:a', '128k',
      '-y',
      outputName
    ];
  } else {
    // H.264 for mp4
    args = [
      '-i', inputName,
      '-c:v', 'libx264',
      '-crf', String(crf),
      '-preset', preset,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputName
    ];
  }

  await ff.exec(args);

  // Read output
  const data = await ff.readFile(outputName);
  const blob = new Blob([data.buffer], { type: targetFormat });

  // Cleanup virtual FS
  try { await ff.deleteFile(inputName); } catch (_) {}
  try { await ff.deleteFile(outputName); } catch (_) {}

  if (onProgress) onProgress(100);

  return {
    blob,
    size: blob.size,
    ext
  };
}

/**
 * Supported input video MIME types
 */
export const SUPPORTED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/ogg',
  'video/mpeg',
  'video/3gpp',
];

/**
 * Supported input video file extensions
 */
export const SUPPORTED_VIDEO_EXTENSIONS = [
  '.mp4', '.webm', '.mov', '.avi', '.mkv',
  '.ogv', '.ogg', '.mpeg', '.mpg', '.3gp', '.m4v'
];

/**
 * Check if a File is a supported video
 * @param {File} file
 * @returns {boolean}
 */
export function isVideoFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return (
    SUPPORTED_VIDEO_MIMES.includes(file.type) ||
    SUPPORTED_VIDEO_EXTENSIONS.includes(ext)
  );
}
