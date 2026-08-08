import { SECTION_MAPPINGS } from './data';

const KEYS = {
  favs: 'everythingmoe_favorites_v2',
  theme: 'everythingmoe_theme_v2',
  lowsec: 'everythingmoe_lowsec_v2'
};

const VALID_SECTIONS = new Set(['all', 'favorites', 'dead', ...Object.values(SECTION_MAPPINGS).map(m => m.id)]);

const getItem = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const setItem = (key: string, val: string) => {
  try { localStorage.setItem(key, val); } catch {}
};

export function getBookmarks(): string[] {
  try {
    const raw = getItem(KEYS.favs);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((i): i is string => typeof i === 'string') : [];
  } catch {
    return [];
  }
}

export function toggleBookmark(siteId: string): boolean {
  const current = getBookmarks();
  const next = current.includes(siteId) ? current.filter(id => id !== siteId) : [...current, siteId];
  setItem(KEYS.favs, JSON.stringify(next));
  return next.includes(siteId);
}

export function getSavedTheme(): 'dark' | 'light' {
  const saved = getItem(KEYS.theme);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function setSavedTheme(theme: 'dark' | 'light') {
  setItem(KEYS.theme, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function getSavedLowSec(): boolean {
  const saved = getItem(KEYS.lowsec);
  return saved !== null ? saved === 'true' : true;
}

export function setSavedLowSec(enabled: boolean) {
  setItem(KEYS.lowsec, String(enabled));
}

export function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  const lowsec = p.get('lowsec');
  const sec = p.get('section') || 'all';
  const rawTags = p.get('tags');
  const tags = rawTags ? rawTags.split(',').filter(Boolean) : [];
  return {
    query: p.get('q') || '',
    section: VALID_SECTIONS.has(sec) || sec.includes(',') ? sec : 'all',
    tags,
    lowsec: lowsec !== null ? lowsec === 'true' : null
  };
}

export function syncUrlParams(query: string, section: string, lowsec: boolean, tags: Set<string> = new Set()) {
  const url = new URL(window.location.href);
  const setOrDel = (key: string, val: string | null) => val ? url.searchParams.set(key, val) : url.searchParams.delete(key);
  setOrDel('q', query.trim() || null);
  setOrDel('section', section && section !== 'all' ? section : null);
  setOrDel('tags', tags.size > 0 ? Array.from(tags).join(',') : null);
  setOrDel('lowsec', lowsec ? 'true' : 'false');
  window.history.replaceState({}, '', url.toString());
}

