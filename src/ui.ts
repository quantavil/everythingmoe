import { IndexedSiteItem } from './search';
import { icons } from './icons';

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeUrl(url: string): string {
  if (!url) return '#';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  return (lower.startsWith('http://') || lower.startsWith('https://'))
    ? escapeHtml(trimmed)
    : '#';
}

export function getSiteDomain(site: IndexedSiteItem): string | null {
  if (site.domains.length > 0) return site.domains[0];
  if (site.altlinks.length > 0) {
    try { return new URL(site.altlinks[0].url).hostname; } catch { /* ignore */ }
  }
  return null;
}

export function showToast(message: string) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'status');
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `${icons.check(16)} <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 300): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  }) as T;
}
