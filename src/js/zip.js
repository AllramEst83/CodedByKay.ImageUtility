/**
 * ZIP Packaging Utility using JSZip
 */
import JSZip from 'jszip';

/**
 * Get file extension for target MIME type (image or video)
 * @param {string} mimeType 
 * @returns {string}
 */
export function getExtensionForMime(mimeType) {
  switch (mimeType) {
    // Image formats
    case 'image/jpeg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/avif': return '.avif';
    case 'image/webp': return '.webp';
    // Video formats
    case 'video/mp4': return '.mp4';
    case 'video/webm': return '.webm';
    default:
      return '.webp';
  }
}

/**
 * Generate a ZIP file containing converted images/videos and thumbnails.
 * @param {Array<{
 *   originalName: string,
 *   convertedBlob: Blob,
 *   thumbnailBlob: Blob | null,
 *   targetFormat: string,
 *   itemType?: 'image'|'video'
 * }>} items 
 * @param {function(number): void} [onProgress] - optional progress callback (0-100)
 * @returns {Promise<Blob>}
 */
export async function createZipArchive(items, onProgress) {
  const zip = new JSZip();

  const convertedFolder = zip.folder('converted');
  const thumbnailsFolder = zip.folder('thumbnails');

  items.forEach((item) => {
    if (!item.convertedBlob) return;

    const baseName = item.originalName.substring(0, item.originalName.lastIndexOf('.')) || item.originalName;
    const ext = getExtensionForMime(item.targetFormat);
    const isVideo = item.itemType === 'video';

    // Save main converted file
    const convertedFilename = isVideo
      ? `${baseName}_compressed${ext}`
      : `${baseName}_converted${ext}`;
    convertedFolder.file(convertedFilename, item.convertedBlob);

    // Save thumbnail: video thumbnails are PNG, image thumbs match target format
    if (item.thumbnailBlob && thumbnailsFolder) {
      const thumbExt = isVideo ? '.png' : ext;
      const thumbFilename = `thumb_${baseName}${thumbExt}`;
      thumbnailsFolder.file(thumbFilename, item.thumbnailBlob);
    }
  });

  // Generate blob with compression
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      if (onProgress && typeof onProgress === 'function') {
        onProgress(Math.round(metadata.percent));
      }
    }
  );

  return zipBlob;
}

/**
 * Trigger browser download for a Blob or File object
 * @param {Blob} blob 
 * @param {string} filename 
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
