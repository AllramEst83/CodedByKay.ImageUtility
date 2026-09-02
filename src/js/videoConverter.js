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
 * Probe whether the input (already written to ffmpeg's virtual FS) has an
 * audio stream, by running an output-less `-i` pass and scanning its log
 * output for an "Audio:" stream line. Needed because the multi-clip filter
 * graph below references `[0:a]` explicitly — doing so on a video with no
 * audio track aborts ffmpeg with no output file at all.
 * @param {FFmpeg} ff
 * @param {string} inputName
 * @returns {Promise<boolean>}
 */
async function probeHasAudio(ff, inputName) {
  let hasAudio = false;
  const handler = ({ message }) => {
    if (/Stream #\d+:\d+.*: Audio:/.test(message)) hasAudio = true;
  };
  ff.on('log', handler);
  try {
    await ff.exec(['-i', inputName]);
  } finally {
    ff.off('log', handler);
  }
  return hasAudio;
}

/**
 * Build an ffmpeg `atempo` filter chain for an arbitrary speed factor.
 * A single `atempo` instance only accepts [0.5, 2.0], so factors outside
 * that range are decomposed into a chain of in-range steps.
 * @param {number} speed
 * @returns {string} e.g. "atempo=2.0,atempo=2.0,atempo=1.25" for speed=5
 */
function buildAtempoChain(speed) {
  const steps = [];
  let remaining = speed;
  if (remaining >= 1) {
    while (remaining > 2.0 + 1e-9) {
      steps.push(2.0);
      remaining /= 2.0;
    }
  } else {
    while (remaining < 0.5 - 1e-9) {
      steps.push(0.5);
      remaining /= 0.5;
    }
  }
  steps.push(remaining);
  return steps.map(s => `atempo=${s.toFixed(4)}`).join(',');
}

/**
 * Compress / transcode a video File to mp4 or webm using ffmpeg.wasm.
 * @param {File} file - source video File object
 * @param {Object} options
 * @param {'video/mp4'|'video/webm'} options.targetFormat - output container/codec
 * @param {number} options.crf - quality (0-51 for x264/5, lower = better; 18-28 recommended)
 * @param {string} options.preset - ffmpeg x264 preset (e.g. 'fast', 'medium', 'slow')
 * @param {Array<{sourceStart:number, sourceEnd:number}>|null} [options.segments] - ordered list of
 *   source time ranges to stitch together (from the timeline editor). null/empty means no edits —
 *   the whole source file is transcoded as-is.
 * @param {number} [options.speed] - playback speed multiplier applied to both video and audio
 *   (from the timeline editor's speed control). 1 = normal speed (no filter applied).
 * @param {function(number): void} [options.onProgress] - progress callback 0-100
 * @param {function(string): void} [options.onLog] - log callback
 * @returns {Promise<{blob: Blob, size: number, ext: string}>}
 */
export async function compressVideo(file, options = {}) {
  const {
    targetFormat = 'video/mp4',
    crf = 23,
    preset = 'fast',
    segments = null,
    speed = 1,
    onProgress,
    onLog
  } = options;

  const ff = await getFFmpeg(onLog);

  // Determine output extension and codec args
  const isWebm = targetFormat === 'video/webm';
  const ext = isWebm ? 'webm' : 'mp4';
  const inputName = `input.${file.name.split('.').pop().toLowerCase()}`;
  const outputName = `output.${ext}`;

  // Track recent ffmpeg log lines so a failure can report something useful
  // instead of a bare "FS error" from a readFile on a file that never got written.
  const recentLogs = [];
  const logCapture = ({ message }) => {
    recentLogs.push(message);
    if (recentLogs.length > 15) recentLogs.shift();
  };
  ff.on('log', logCapture);

  const onProgressWrapped = onProgress
    ? ({ progress }) => onProgress(Math.min(99, Math.round(progress * 100)))
    : null;
  if (onProgressWrapped) ff.on('progress', onProgressWrapped);

  try {
    // Write input file to ffmpeg's virtual FS
    await ff.writeFile(inputName, await fetchFile(file));

    const hasEdits = Array.isArray(segments) && segments.length > 0;
    const needsConcat = hasEdits && segments.length > 1;
    const needsSpeed = Math.abs(speed - 1) > 0.001;

    const videoCodecArgs = isWebm
      ? ['-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k']
      : ['-c:v', 'libx264', '-crf', String(crf), '-preset', preset, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'];

    let args;

    if (!needsConcat && !needsSpeed) {
      if (!hasEdits) {
        args = ['-i', inputName, ...videoCodecArgs, '-y', outputName];
      } else {
        // Single range, no speed change: -ss before -i does a fast input seek;
        // -t (duration) after -i trims relative to that seeked start.
        const { sourceStart, sourceEnd } = segments[0];
        const trimInArgs = sourceStart > 0 ? ['-ss', String(sourceStart)] : [];
        const trimOutArgs = ['-t', String(sourceEnd - sourceStart)];

        args = [
          ...trimInArgs,
          '-i', inputName,
          ...trimOutArgs,
          ...videoCodecArgs,
          '-y',
          outputName
        ];
      }
    } else if (!needsConcat) {
      // 0 or 1 range, plus a speed change: trim (if any) via fast seek, then
      // apply setpts/atempo as plain -vf/-af filters (no concat needed).
      const hasAudio = await probeHasAudio(ff, inputName);
      const trimInArgs = hasEdits && segments[0].sourceStart > 0 ? ['-ss', String(segments[0].sourceStart)] : [];
      const trimOutArgs = hasEdits ? ['-t', String(segments[0].sourceEnd - segments[0].sourceStart)] : [];

      const speedArgs = [
        '-vf', `setpts=${(1 / speed).toFixed(6)}*PTS`,
        ...(hasAudio ? ['-af', buildAtempoChain(speed)] : [])
      ];

      args = [
        ...trimInArgs,
        '-i', inputName,
        ...trimOutArgs,
        ...speedArgs,
        ...videoCodecArgs,
        '-y',
        outputName
      ];
    } else {
      // Multiple clips from the timeline editor: trim each range with filters
      // and concatenate them back together in sequence order, then apply a
      // speed change (if any) to the concatenated result. Skip the audio leg
      // entirely when the source has no audio stream (referencing [0:a] on
      // an audio-less input aborts ffmpeg with no output file).
      const hasAudio = await probeHasAudio(ff, inputName);

      const filterParts = [];
      segments.forEach((seg, i) => {
        filterParts.push(`[0:v]trim=start=${seg.sourceStart}:end=${seg.sourceEnd},setpts=PTS-STARTPTS[v${i}]`);
        if (hasAudio) {
          filterParts.push(`[0:a]atrim=start=${seg.sourceStart}:end=${seg.sourceEnd},asetpts=PTS-STARTPTS[a${i}]`);
        }
      });
      const concatInputs = segments.map((_, i) => hasAudio ? `[v${i}][a${i}]` : `[v${i}]`).join('');
      const vOut = needsSpeed ? 'cv' : 'outv';
      const aOut = needsSpeed ? 'ca' : 'outa';
      filterParts.push(`${concatInputs}concat=n=${segments.length}:v=1:a=${hasAudio ? 1 : 0}[${vOut}]${hasAudio ? `[${aOut}]` : ''}`);

      if (needsSpeed) {
        filterParts.push(`[cv]setpts=${(1 / speed).toFixed(6)}*PTS[outv]`);
        if (hasAudio) filterParts.push(`[ca]${buildAtempoChain(speed)}[outa]`);
      }

      args = [
        '-i', inputName,
        '-filter_complex', filterParts.join(';'),
        '-map', '[outv]',
        ...(hasAudio ? ['-map', '[outa]'] : []),
        ...videoCodecArgs,
        '-y',
        outputName
      ];
    }

    const exitCode = await ff.exec(args);
    if (exitCode !== 0) {
      throw new Error(`FFmpeg failed (exit ${exitCode}): ${recentLogs.slice(-4).join(' | ') || 'no output produced'}`);
    }

    // Read output
    const data = await ff.readFile(outputName);
    const blob = new Blob([data.buffer], { type: targetFormat });

    if (onProgress) onProgress(100);

    return {
      blob,
      size: blob.size,
      ext
    };
  } finally {
    ff.off('log', logCapture);
    if (onProgressWrapped) ff.off('progress', onProgressWrapped);
    try { await ff.deleteFile(inputName); } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}
  }
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
