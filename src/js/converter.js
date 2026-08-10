/**
 * Canvas Image Converter and Thumbnail Engine
 */

/**
 * Load an image File object into an HTMLImageElement
 * @param {File} file 
 * @returns {Promise<{img: HTMLImageElement, width: number, height: number}>}
 */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ img, width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = url;
  });
}

/**
 * Convert an HTMLImageElement to target MIME format and create thumbnail
 * @param {HTMLImageElement} img 
 * @param {Object} options 
 * @param {string} options.targetFormat - e.g. 'image/webp', 'image/jpeg', 'image/png', 'image/avif'
 * @param {number} options.quality - float between 0.10 and 1.00
 * @param {boolean} options.generateThumb - whether thumbnail is requested
 * @param {number} options.thumbWidth - target thumbnail width
 * @param {number} options.thumbHeight - target thumbnail height
 * @param {'contain' | 'cover' | 'stretch'} options.thumbFit - aspect ratio mode
 * @returns {Promise<{
 *   convertedBlob: Blob,
 *   convertedSize: number,
 *   convertedWidth: number,
 *   convertedHeight: number,
 *   thumbnailBlob: Blob | null,
 *   thumbnailSize: number,
 *   thumbWidth: number,
 *   thumbHeight: number
 * }>}
 */
export async function convertImage(img, options) {
  const {
    targetFormat = 'image/webp',
    quality = 0.8,
    generateThumb = true,
    thumbWidth = 150,
    thumbHeight = 150,
    thumbFit = 'contain'
  } = options;

  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  // 1. Full-size conversion canvas
  const canvas = document.createElement('canvas');
  canvas.width = originalWidth;
  canvas.height = originalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not create 2D canvas context');

  // Handle transparency background for JPEG (fill white background if source is transparent)
  if (targetFormat === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, originalWidth, originalHeight);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, originalWidth, originalHeight);

  const convertedBlob = await canvasToBlob(canvas, targetFormat, quality);

  // 2. Thumbnail canvas generation
  let thumbnailBlob = null;
  let actualThumbW = thumbWidth;
  let actualThumbH = thumbHeight;

  if (generateThumb) {
    const thumbCanvas = document.createElement('canvas');
    const thumbCtx = thumbCanvas.getContext('2d');
    if (!thumbCtx) throw new Error('Could not create thumbnail 2D canvas context');

    if (thumbFit === 'contain') {
      const scale = Math.min(thumbWidth / originalWidth, thumbHeight / originalHeight);
      actualThumbW = Math.max(1, Math.round(originalWidth * scale));
      actualThumbH = Math.max(1, Math.round(originalHeight * scale));

      thumbCanvas.width = actualThumbW;
      thumbCanvas.height = actualThumbH;

      if (targetFormat === 'image/jpeg') {
        thumbCtx.fillStyle = '#FFFFFF';
        thumbCtx.fillRect(0, 0, actualThumbW, actualThumbH);
      }

      thumbCtx.imageSmoothingEnabled = true;
      thumbCtx.imageSmoothingQuality = 'high';
      thumbCtx.drawImage(img, 0, 0, actualThumbW, actualThumbH);

    } else if (thumbFit === 'cover') {
      thumbCanvas.width = thumbWidth;
      thumbCanvas.height = thumbHeight;

      if (targetFormat === 'image/jpeg') {
        thumbCtx.fillStyle = '#FFFFFF';
        thumbCtx.fillRect(0, 0, thumbWidth, thumbHeight);
      }

      const imgAspect = originalWidth / originalHeight;
      const targetAspect = thumbWidth / thumbHeight;
      let sx, sy, sWidth, sHeight;

      if (imgAspect > targetAspect) {
        sHeight = originalHeight;
        sWidth = originalHeight * targetAspect;
        sx = (originalWidth - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = originalWidth;
        sHeight = originalWidth / targetAspect;
        sx = 0;
        sy = (originalHeight - sHeight) / 2;
      }

      thumbCtx.imageSmoothingEnabled = true;
      thumbCtx.imageSmoothingQuality = 'high';
      thumbCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, thumbWidth, thumbHeight);
    } else {
      // stretch
      thumbCanvas.width = thumbWidth;
      thumbCanvas.height = thumbHeight;

      if (targetFormat === 'image/jpeg') {
        thumbCtx.fillStyle = '#FFFFFF';
        thumbCtx.fillRect(0, 0, thumbWidth, thumbHeight);
      }

      thumbCtx.imageSmoothingEnabled = true;
      thumbCtx.imageSmoothingQuality = 'high';
      thumbCtx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
    }

    thumbnailBlob = await canvasToBlob(thumbCanvas, targetFormat, quality);
  }

  return {
    convertedBlob,
    convertedSize: convertedBlob.size,
    convertedWidth: originalWidth,
    convertedHeight: originalHeight,
    thumbnailBlob,
    thumbnailSize: thumbnailBlob ? thumbnailBlob.size : 0,
    thumbWidth: actualThumbW,
    thumbHeight: actualThumbH
  };
}

/**
 * Helper to wrap canvas.toBlob in a Promise
 * @param {HTMLCanvasElement} canvas 
 * @param {string} format 
 * @param {number} quality 
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Failed to convert canvas to blob format: ${format}`));
        }
      },
      format,
      quality
    );
  });
}
