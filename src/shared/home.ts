/**
 * Shared model + parsers. Used by the Cloudflare Pages Functions (server) and
 * by the Preact client, so everything here must stay free of DOM/Workers APIs.
 */

export const UPSTREAM = 'https://everythingmoe.com';

export interface MenuEntry {
  id: string;
  short?: string;
  shortextra?: string;
  color?: string;
  nsfw?: boolean;
}

export interface NoteToken {
  text: string;
  id?: string;
}

export interface Item {
  id: string;
  name: string;
  rank: number;
  /** Primary link. Empty when upstream asks people to DM for links. */
  url: string;
  icon: string;
  /** Short uppercase chips, e.g. MULT, DDL, RAW. */
  tags: string[];
  /** Curated facet labels, e.g. "Self-host", "Soft-sub". */
  filters: string[];
  licensed: boolean;
  torrent: boolean;
  nsfw: boolean;
  /** True for items that came from the low-rank list. */
  low: boolean;
}

export interface Section {
  id: string;
  title: string;
  short: string;
  color: string;
  nsfw: boolean;
  count: number;
  notes: NoteToken[];
  filterOptions: string[];
  items: Item[];
  /** Id used by /data/lowsec/{id}.json, when the section has a low-rank list. */
  lowId: string | null;
  /** Rank number the first low-rank item continues from. */
  lowStart: number;
}

export interface Home {
  sections: Section[];
  menu: MenuEntry[];
}

export interface Mirror {
  label: string;
  url: string;
}

export interface Detail {
  positive: string[];
  negative: string[];
  note: string;
  mirrors: Mirror[];
  extra: Mirror[];
  dead: string;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' '
};

export function decode(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

export function stripTags(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return decode(raw.replace(/<[^>]*>?/g, '')).trim();
}

function absolute(src: string): string {
  if (!src) return '';
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('/')) return `${UPSTREAM}${src}`;
  return src;
}

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

/* ---------------------------------------------------------------- page */

const SECTION_START = /<div\s+id="sec-([a-z0-9_-]+)"\s+class="(section(?:\s[^"]*)?)"[^>]*>/gi;

function plain(raw: string): string {
  return decode(raw.replace(/<[^>]*>?/g, '')).replace(/\s+/g, ' ');
}

/** Keeps the spaces around links so "AnimeKai is moved…" doesn't collapse into one word. */
function parseNotes(html: string): NoteToken[] {
  const tokens: NoteToken[] = [];
  let last = 0;
  for (const m of html.matchAll(/<a\s+href="\/s\/([^"#]+)"[^>]*>(.*?)<\/a>/gi)) {
    const before = plain(html.slice(last, m.index));
    if (before.trim()) tokens.push({ text: before });
    tokens.push({ text: plain(m[2]).trim(), id: decode(m[1]) });
    last = m.index! + m[0].length;
  }
  const rest = plain(html.slice(last));
  if (rest.trim()) tokens.push({ text: rest });
  if (tokens.length && !tokens[0].id) tokens[0].text = tokens[0].text.trimStart();
  const end = tokens[tokens.length - 1];
  if (end && !end.id) end.text = end.text.trimEnd();
  return tokens;
}

function parseItems(chunk: string): Item[] {
  const items: Item[] = [];
  const pieces = chunk.split('<div data-rank="').slice(1);
  for (const piece of pieces) {
    const head = piece.match(/^(\d+)"(?:\s+data-filter="([^"]*)")?\s+class="section-item([^"]*)"/);
    if (!head) continue;
    const link = piece.match(
      /<a\s+href="\/s\/([^"#]+)"\s+data-link="([^"]*)"[^>]*>\s*<img\s+src="([^"]*)"[^>]*>\s*([^<]*?)\s*<\/a>/
    );
    if (!link) continue;
    const body = piece.split('class="morebtn')[0];
    const afterLink = body.slice(body.indexOf('</a>'));
    const tags = [...afterLink.matchAll(/<span class="addtag[^"]*">([^<]+)<\/span>/g)]
      .map((m) => decode(m[1]).trim())
      .filter(Boolean);
    const torrent = /class="img-tag"><img[^>]*alt="torrent"/.test(afterLink);
    const nsfw = /class="nsfwtag"/.test(afterLink) || /\bnsfw\b/i.test(head[3]);
    const dataLink = decode(link[2]);
    items.push({
      id: decode(link[1]),
      name: decode(link[4]),
      rank: Number(head[1]),
      url: isHttpUrl(dataLink) ? dataLink : '',
      icon: absolute(decode(link[3])),
      tags,
      filters: head[2]
        ? decode(head[2])
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      licensed: /section-licensed/.test(head[3]),
      torrent,
      nsfw,
      low: false
    });
  }
  return items;
}

export function parseHome(html: string, menu: MenuEntry[] = []): Section[] {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const starts = [...html.matchAll(SECTION_START)];
  return starts.map((m, i) => {
    const id = m[1];
    const chunk = html.slice(m.index!, starts[i + 1]?.index ?? html.length);
    const meta = byId.get(id);
    const title = chunk.match(
      /<span class="title-text"[^>]*>(?:\s*<i[^>]*><\/i>)?\s*([^<]*?)\s*<div class="sec-count">\((\d+)\)<\/div>/
    );
    const color = chunk.match(/class="section-title"\s+style="background-color:\s*(#[0-9a-fA-F]{3,8})/);
    const notes = chunk.match(/<div class="section-notes">(.*?)<\/div>/s);
    const select = chunk.match(/<select[^>]*class="filter-input"[^>]*>(.*?)<\/select>/s);
    const low = chunk.match(/expandsection\(this,\s*'([a-z0-9_-]+)',\s*(\d+)\)/i);
    const filterOptions = select
      ? [...select[1].matchAll(/<option value="([^"]*)"/g)].map((o) => decode(o[1])).filter((v) => v && v !== 'any')
      : [];
    return {
      id,
      title: title ? decode(title[1]) : (meta?.short ?? id),
      short: meta?.short ?? meta?.shortextra ?? (title ? decode(title[1]) : id),
      color: color?.[1] ?? meta?.color ?? '#222226',
      nsfw: Boolean(meta?.nsfw) || /\bnsfwsection\b/.test(m[2]),
      count: title ? Number(title[2]) : 0,
      notes: notes ? parseNotes(notes[1]) : [],
      filterOptions,
      items: parseItems(chunk),
      lowId: low ? low[1] : null,
      lowStart: low ? Number(low[2]) : 0
    };
  });
}

/* ------------------------------------------------------------ low ranks */

export interface UpstreamLowItem {
  id?: string;
  title?: string;
  link?: string;
  icon?: string;
  tags?: string;
  filter?: string;
  'ex-DEAD'?: unknown;
}

/** Low-rank items. Dead entries are returned separately so lists stay clean. */
export function parseLow(raw: unknown, startRank: number): { items: Item[]; dead: Item[] } {
  const items: Item[] = [];
  const dead: Item[] = [];
  if (!Array.isArray(raw)) return { items, dead };
  let rank = startRank;
  for (const r of raw as UpstreamLowItem[]) {
    if (!r || typeof r.title !== 'string' || !r.title) continue;
    const flags = typeof r.tags === 'string' ? r.tags.split(/\s+/).filter(Boolean) : [];
    const link = typeof r.link === 'string' ? r.link : '';
    const item: Item = {
      id: r.id ?? r.title,
      name: stripTags(r.title),
      rank,
      url: isHttpUrl(link) ? link : '',
      icon: absolute(r.icon ?? ''),
      tags: flags.filter((f) => !['licensed', 'nsfw', 'torrent'].includes(f)).map((f) => f.toUpperCase()),
      filters:
        typeof r.filter === 'string'
          ? r.filter
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      licensed: flags.includes('licensed'),
      torrent: flags.includes('torrent'),
      nsfw: flags.includes('nsfw'),
      low: true
    };
    rank++;
    if (r['ex-DEAD']) dead.push(item);
    else items.push(item);
  }
  return { items, dead };
}

/* -------------------------------------------------------------- details */

/**
 * "label<<url#label<<url" lists. Hashes inside a URL fragment must survive, so
 * we only split on a "#" that starts another entry.
 */
export function parseLinks(raw?: string): Mirror[] {
  if (!raw || typeof raw !== 'string') return [];
  const entries = raw.split(/#(?!\d+<<)(?=(?:[^#<]+<<https?:\/\/|https?:\/\/))/i);
  const out: Mirror[] = [];
  for (const entry of entries) {
    const parts = entry.split('<<');
    if (parts.length >= 2) {
      const url = parts[1].trim();
      if (isHttpUrl(url)) out.push({ label: stripTags(parts[0]) || hostOf(url), url });
    } else {
      const url = entry.trim();
      if (isHttpUrl(url)) out.push({ label: hostOf(url), url });
    }
  }
  return out;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function splitList(raw: unknown): string[] {
  return typeof raw === 'string' ? raw.split('#').map(stripTags).filter(Boolean) : [];
}

export function parseDetail(raw: unknown): Detail {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const dead = r['ex-DEAD'];
  return {
    positive: splitList(r.positive),
    negative: splitList(r.negative),
    note: typeof r.info === 'string' ? stripTags(r.info) : '',
    mirrors: parseLinks(typeof r.altlink === 'string' ? r.altlink : undefined),
    extra: parseLinks(typeof r['ex-altlink'] === 'string' ? r['ex-altlink'] : undefined),
    dead: typeof dead === 'string' ? dead : dead ? 'Shut down' : ''
  };
}

/* ---------------------------------------------------------------- misc */

/** Rank text colour: the top four fade from gold, the rest stay quiet. */
export const RANK_COLORS = ['#ffd672', '#d4b97a', '#c5b080', '#beb08d'];

export function matchesFilters(item: Item, active: ReadonlySet<string>): boolean {
  if (!active.size) return true;
  for (const f of active) if (!item.filters.includes(f)) return false;
  return true;
}
