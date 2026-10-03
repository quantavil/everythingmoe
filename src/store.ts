import { effect, signal } from '@preact/signals';

const KEYS = {
  theme: 'everythingmoe_theme_v3',
  nsfw: 'everythingmoe_nsfw_v3',
  rows: 'everythingmoe_rows_v3',
  collapsed: 'everythingmoe_collapsed_v3',
  favs: 'everythingmoe_favorites_v2'
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or quota */
  }
}
function readJsonArray(key: string): string[] {
  try {
    const parsed = JSON.parse(read(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Old builds stored low-rank ids as "lowsec_{section}_{id}". Upstream ids are the stable key now. */
export function normalizeBookmarkId(id: string): string {
  return id.replace(/^lowsec_[a-z0-9-]+?_/i, '');
}

export function normalizeBookmarks(ids: string[]): string[] {
  return [...new Set(ids.map(normalizeBookmarkId))];
}

export const ROW_CHOICES = [10, 20, 50] as const;
export type RowChoice = (typeof ROW_CHOICES)[number];

function initialRows(): RowChoice {
  const saved = Number(read(KEYS.rows));
  if ((ROW_CHOICES as readonly number[]).includes(saved)) return saved as RowChoice;
  const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches;
  return wide ? 20 : 10;
}

export type Theme = 'dark' | 'light';

export const theme = signal<Theme>(read(KEYS.theme) === 'light' ? 'light' : 'dark');
export const nsfw = signal(read(KEYS.nsfw) === 'true');
export const rowsPerPanel = signal<RowChoice>(initialRows());
export const collapsed = signal<string[]>(readJsonArray(KEYS.collapsed));
export const bookmarks = signal<string[]>(normalizeBookmarks(readJsonArray(KEYS.favs)));

export function toggleBookmark(id: string) {
  const list = bookmarks.value;
  bookmarks.value = list.includes(id) ? list.filter((b) => b !== id) : [...list, id];
}

export function toggleCollapsed(sectionId: string) {
  const list = collapsed.value;
  collapsed.value = list.includes(sectionId) ? list.filter((s) => s !== sectionId) : [...list, sectionId];
}

/** Persist signals and mirror the theme onto <html>. Call once at startup. */
export function startPersistence() {
  effect(() => {
    document.documentElement.setAttribute('data-theme', theme.value);
    write(KEYS.theme, theme.value);
  });
  effect(() => write(KEYS.nsfw, String(nsfw.value)));
  effect(() => write(KEYS.rows, String(rowsPerPanel.value)));
  effect(() => write(KEYS.collapsed, JSON.stringify(collapsed.value)));
  effect(() => write(KEYS.favs, JSON.stringify(bookmarks.value)));

  window.addEventListener('storage', (e) => {
    if (e.key === KEYS.favs) bookmarks.value = normalizeBookmarks(readJsonArray(KEYS.favs));
  });
}
