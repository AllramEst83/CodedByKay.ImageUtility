/**
 * UI Utilities and DOM Helpers
 */

/**
 * Format raw byte size into human readable string
 * @param {number} bytes 
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Show Neo-Brutalist toast notification
 * @param {string} message 
 * @param {'info' | 'success' | 'error'} type 
 * @param {number} duration 
 */
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'brutal-btn btn-sm btn-dark';
  closeBtn.style.padding = '0.1rem 0.4rem';
  closeBtn.style.minWidth = 'auto';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close toast');
  closeBtn.onclick = () => toast.remove();

  toast.appendChild(textSpan);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, duration);
}

/**
 * Initialize and handle Dark / Light Theme
 */
export function initTheme() {
  const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(savedTheme);
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

/**
 * Check browser support for image MIME type export on Canvas
 * @param {string} mimeType 
 * @returns {boolean}
 */
export function isCanvasFormatSupported(mimeType) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const dataUrl = canvas.toDataURL(mimeType);
  return dataUrl.startsWith(`data:${mimeType}`);
}
