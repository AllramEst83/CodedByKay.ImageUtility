/**
 * ZIP Packaging Utility using JSZip
 */
import JSZip from 'jszip';

/**
 * Get file extension for target MIME type
 * @param {string} mimeType 
 * @returns {string}
 */
export function getExtensionForMime(mimeType) {
  switch (mimeType) {
    case 'image/jpeg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/avif': return '.avif';
    case 'image/webp':
    default:
      return '.webp';
  }
}

/**
 * Generate a ZIP file containing converted images and thumbnails
 * @param {Array<{
 *   originalName: string,
 *   convertedBlob: Blob,
 *   thumbnailBlob: Blob | null,
 *   targetFormat: string
 * }>} items 
 * @param {function(number): void} [onProgress] - optional progress callback (0 - 100)
 * @returns {Promise<Blob>}
 */
export async function createZipArchive(items, onProgress) {
  const zip = new JSZip();

  const convertedFolder = zip.folder('converted');
  const thumbnailsFolder = zip.folder('thumbnails');

  items.forEach((item, index) => {
    if (!item.convertedBlob) return;

    const baseName = item.originalName.substring(0, item.originalName.lastIndexOf('.')) || item.originalName;
    const ext = getExtensionForMime(item.targetFormat);

    // Save main converted image
    const convertedFilename = `${baseName}_converted${ext}`;
    convertedFolder.file(convertedFilename, item.convertedBlob);

    // Save thumbnail image if present
    if (item.thumbnailBlob && thumbnailsFolder) {
      const thumbFilename = `thumb_${baseName}${ext}`;
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
