/** Hash routes keep deep links working on any static host and make Back/Forward behave. */
export type Route = { view: 'home' } | { view: 'section'; id: string } | { view: 'saved' };

export interface UrlState {
  route: Route;
  query: string;
  filters: string[];
}

export function parseHash(hash: string): UrlState {
  const raw = hash.replace(/^#/, '');
  const [path, qs = ''] = raw.split('?');
  const params = new URLSearchParams(qs);
  const section = path.match(/^\/s\/([a-z0-9_-]+)$/i);
  const route: Route = section
    ? { view: 'section', id: section[1] }
    : path === '/saved'
      ? { view: 'saved' }
      : { view: 'home' };
  return {
    route,
    query: params.get('q') ?? '',
    filters: (params.get('f') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  };
}

export function toHash(state: UrlState): string {
  const path = state.route.view === 'section' ? `/s/${state.route.id}` : state.route.view === 'saved' ? '/saved' : '/';
  const params = new URLSearchParams();
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.route.view === 'section' && state.filters.length) params.set('f', state.filters.join(','));
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

/**
 * Old builds used query strings (?section=anime&q=nyaa&lowsec=false). Turn those into the equivalent hash route so
 * existing bookmarks and shared links still land in the right place.
 */
export function legacyHash(search: string): string | null {
  const params = new URLSearchParams(search);
  const section = (params.get('section') ?? '').split(',')[0].trim().toLowerCase();
  const query = params.get('q') ?? '';
  if (!section && !query.trim()) return null;
  const known = /^[a-z0-9_-]+$/.test(section) && !['all', 'favorites', 'dead', 'category'].includes(section);
  const id = section === 'tracker' ? 'database' : section;
  return toHash({ route: known ? { view: 'section', id } : { view: 'home' }, query, filters: [] });
}
