import { batch, computed, signal } from '@preact/signals';
import { fetchComments, fetchDetails, fetchHome, fetchLow } from './api';
import { buildDoc, type Doc } from './search';
import { type Detail, type Home, type Item, parseDetail, parseLow, type Section } from './shared/home';
import { nsfw } from './store';
import { parseHash, type Route, toHash, type UrlState } from './url';

/* ------------------------------------------------------------- loading */

export const home = signal<Home | null>(null);
export const homeLoading = signal(true);
export const homeError = signal<string | null>(null);

let homeRequest = 0;
export async function loadHome() {
  const mine = ++homeRequest;
  homeLoading.value = true;
  homeError.value = null;
  try {
    const data = await fetchHome(nsfw.value);
    if (mine === homeRequest) home.value = data;
  } catch (err) {
    if (mine === homeRequest) homeError.value = err instanceof Error ? err.message : 'Could not load the index';
  } finally {
    if (mine === homeRequest) homeLoading.value = false;
  }
}

export const rawDetails = signal<Record<string, unknown> | null>(null);
export const comments = signal<Record<string, number>>({});
const detailCache = new Map<string, Detail>();

/** Reading rawDetails.value subscribes the caller, so rows refresh when details arrive. */
export function getDetail(id: string): Detail | null {
  const raw = rawDetails.value;
  if (!raw) return null;
  const hit = detailCache.get(id);
  if (hit) return hit;
  if (!(id in raw)) return null;
  const parsed = parseDetail(raw[id]);
  detailCache.set(id, parsed);
  return parsed;
}

export function commentCount(id: string): number {
  return comments.value[`/s/${id.toLowerCase()}`] ?? 0;
}

export async function loadMeta() {
  const [details, counts] = await Promise.allSettled([fetchDetails(), fetchComments()]);
  batch(() => {
    if (details.status === 'fulfilled') rawDetails.value = details.value;
    if (counts.status === 'fulfilled') comments.value = counts.value;
  });
}

export interface LowState {
  status: 'loading' | 'ready' | 'error';
  items: Item[];
  dead: Item[];
}
/** Low-rank lists by section id. */
export const low = signal<Record<string, LowState>>({});

export async function loadLow(section: Section) {
  if (!section.lowId) return;
  const current = low.value[section.id];
  if (current && current.status !== 'error') return;
  low.value = { ...low.value, [section.id]: { status: 'loading', items: [], dead: [] } };
  try {
    const raw = await fetchLow(section.lowId);
    const { items, dead } = parseLow(raw, section.lowStart);
    low.value = { ...low.value, [section.id]: { status: 'ready', items, dead } };
  } catch {
    low.value = { ...low.value, [section.id]: { status: 'error', items: [], dead: [] } };
  }
}

export async function loadAllLow() {
  const pending = (home.value?.sections ?? []).filter((s) => s.lowId && !low.value[s.id]);
  const queue = [...pending];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) await loadLow(s);
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

/* ------------------------------------------------------- derived lists */

export const sections = computed<Section[]>(() => (home.value?.sections ?? []).filter((s) => nsfw.value || !s.nsfw));

export function topItems(section: Section): Item[] {
  return nsfw.value ? section.items : section.items.filter((i) => !i.nsfw);
}

export function lowItems(section: Section): Item[] {
  const items = low.value[section.id]?.items ?? [];
  return nsfw.value ? items : items.filter((i) => !i.nsfw);
}

export interface Entry {
  section: Section;
  item: Item;
}

/** Every item we currently hold, top-ranked first. */
export const entries = computed<Entry[]>(() =>
  sections.value.flatMap((section) => [...topItems(section), ...lowItems(section)].map((item) => ({ section, item })))
);

export const docs = computed<Doc[]>(() => {
  const raw = rawDetails.value;
  return entries.value.map(({ section, item }) =>
    buildDoc(section.id, item, raw ? (getDetail(item.id) ?? undefined) : undefined)
  );
});

/* --------------------------------------------------------------- route */

export const route = signal<Route>({ view: 'home' });
export const query = signal('');
export const sectionFilters = signal<string[]>([]);
export const panelFilters = signal<Record<string, string[]>>({});
export const expanded = signal<ReadonlySet<string>>(new Set());

export const itemKey = (sectionId: string, itemId: string) => `${sectionId}/${itemId}`;

export function toggleExpanded(key: string) {
  const next = new Set(expanded.value);
  if (!next.delete(key)) next.add(key);
  expanded.value = next;
}

export function syncFromUrl() {
  const parsed = parseHash(location.hash);
  batch(() => {
    route.value = parsed.route;
    query.value = parsed.query;
    sectionFilters.value = parsed.filters;
  });
}

function currentUrl(): UrlState {
  return { route: route.value, query: query.value, filters: sectionFilters.value };
}

function writeUrl(next: UrlState, replace: boolean) {
  const hash = toHash(next);
  if (hash === (location.hash || '#/')) return;
  const url = hash === '#/' ? `${location.pathname}${location.search}` : hash;
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  syncFromUrl();
}

export function navigate(to: Route, filters: string[] = []) {
  writeUrl({ route: to, query: query.value, filters }, false);
}

export function toggleSectionFilter(filter: string) {
  const list = sectionFilters.value;
  const filters = list.includes(filter) ? list.filter((f) => f !== filter) : [...list, filter];
  writeUrl({ ...currentUrl(), filters }, true);
}

export function clearSectionFilters() {
  writeUrl({ ...currentUrl(), filters: [] }, true);
}

let urlTimer: ReturnType<typeof setTimeout> | undefined;
export function setQuery(q: string) {
  query.value = q;
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => writeUrl(currentUrl(), true), 250);
}

export function togglePanelFilter(sectionId: string, filter: string) {
  const list = panelFilters.value[sectionId] ?? [];
  const next = list.includes(filter) ? list.filter((f) => f !== filter) : [...list, filter];
  panelFilters.value = { ...panelFilters.value, [sectionId]: next };
}

export function clearPanelFilters(sectionId: string) {
  panelFilters.value = { ...panelFilters.value, [sectionId]: [] };
}

/** Where a section-bar click should land once the home view is on screen. */
export const pendingScroll = signal<string | null>(null);
