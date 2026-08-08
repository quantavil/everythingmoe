import { SiteItem, SectionMeta, MirrorLink } from './types';

export const SECTION_MAPPINGS: Record<string, { id: string; title: string }> = {
  sectionanime: { id: 'anime', title: 'Anime Streaming' },
  sectionmanga: { id: 'manga', title: 'Manga & Webtoons' },
  sectionmanhwa: { id: 'manhwa', title: 'Manhwa & Comics' },
  sectionnovel: { id: 'novel', title: 'Light Novels' },
  sectiondonghua: { id: 'donghua', title: 'Donghua' },
  sectionapps: { id: 'apps', title: 'Apps & Mihon' },
  sectiondownload: { id: 'download', title: 'Torrents & DDL' },
  sectionmusic: { id: 'music', title: 'OSTs & Music' },
  sectionschedule: { id: 'schedule', title: 'Schedules' },
  sectiontracker: { id: 'tracker', title: 'Trackers & DBs' },
  sectionutils: { id: 'utils', title: 'Japanese Tools' },
  sectionwiki: { id: 'wiki', title: 'Wikis' },
  sectionartboard: { id: 'artboard', title: 'Art & Wallpapers' },
  sectionvtuber: { id: 'vtuber', title: 'VTuber' },
  sectionforums: { id: 'forums', title: 'Communities' },
  sectiondrama: { id: 'drama', title: 'Asian Dramas' },
  sectionhentai: { id: 'hentai', title: 'Adult Anime (18+)' },
  sectionhentairead: { id: 'hentairead', title: 'Adult Manga (18+)' }
};

const lowsecCache = new Map<string, SiteItem[]>();
const UPSTREAM_DATA_URL = 'https://everythingmoe.com';

export function isExplicitlyDead(val: unknown): boolean {
  if (val === true) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s !== '' && s !== '0' && s !== 'false' && s !== 'null' && s !== 'undefined';
  }
  return false;
}

export function strip(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>?/gm, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function parseLinks(raw?: string): MirrorLink[] {
  if (!raw || typeof raw !== 'string') return [];
  const entries = raw.split(/#(?=(?:[^#<]+<<https?:\/\/|https?:\/\/))/i);
  return entries.map(entry => {
    const parts = entry.split('<<');
    if (parts.length >= 2) {
      return { label: strip(parts[0]) || 'Link', url: parts[1].trim() };
    }
    const trimmed = entry.trim();
    return (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
      ? { label: 'Link', url: trimmed }
      : null;
  }).filter((item): item is MirrorLink => item !== null && item.url.length > 0 && /^https?:\/\//i.test(item.url));
}

export function parseTags(raw?: string): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split('#').map(t => strip(t)).filter(Boolean);
}

async function fetchJson<T>(endpoints: string[], fallback: T): Promise<T> {
  for (const u of endpoints) {
    try {
      const res = await fetch(u);
      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data) || Object.keys(data).length > 0)) return data as T;
      }
    } catch {
      // try next endpoint
    }
  }
  return fallback;
}

function cleanIconId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function fetchLowSecForSection(secId: string): Promise<SiteItem[]> {
  if (lowsecCache.has(secId)) return lowsecCache.get(secId)!;
  const raw = await fetchJson<any[]>([`/api/lowsec?sec=${secId}`, `${UPSTREAM_DATA_URL}/lowsec/${secId}.json`], []);
  const meta = Object.values(SECTION_MAPPINGS).find(m => m.id === secId);
  const categoryTitle = meta ? meta.title : secId;

  const items: SiteItem[] = raw.filter(item => item.title && item.link).map(item => {
    const filters = item.filter ? item.filter.split(',').map((f: string) => strip(f)) : [];
    const tagsText = item.tags ? strip(item.tags) : '';
    let host = '';
    try { host = new URL(item.link).hostname; } catch { /* ignore */ }

    const cleanId = cleanIconId(item.id || item.title);
    const isDead = isExplicitlyDead(item['ex-DEAD'])
      || filters.some((f: string) => /dead|shutdown|discontinued|defunct|offline|closed/i.test(f))
      || /discontinued|shut down|dead site/i.test(tagsText);

    return {
      id: `lowsec_${secId}_${item.id || item.title}`,
      name: item.title,
      section: secId,
      categoryName: `${categoryTitle} (Low-Ranked)`,
      positive: filters,
      negative: ['Lower Security / Unverified'],
      info: tagsText ? `Tags: ${tagsText}` : 'Lower-ranked site listing.',
      altlinks: [{ label: host || item.title, url: item.link }],
      domains: host ? [host] : [],
      isLowSec: true,
      isDead,
      iconUrl: item.icon || `https://static.everythingmoe.com/icons/${cleanId}.png`
    };
  });

  lowsecCache.set(secId, items);
  return items;
}

export async function fetchAllLowSec(): Promise<SiteItem[]> {
  const ids = Object.values(SECTION_MAPPINGS).map(m => m.id);
  return (await Promise.all(ids.map(fetchLowSecForSection))).flat();
}

export async function fetchEverythingMoeData(): Promise<{ sites: SiteItem[]; sections: SectionMeta[] }> {
  const rawMain = await fetchJson<Record<string, any>>(['/api/dataset', `${UPSTREAM_DATA_URL}/dataset.json`], {});
  const sites: SiteItem[] = [];
  const counts: Record<string, number> = {};
  let curSec = 'anime';
  let curTitle = 'Anime Streaming';

  for (const [key, val] of Object.entries(rawMain)) {
    if (key.startsWith('section')) {
      const meta = SECTION_MAPPINGS[key];
      curSec = meta ? meta.id : key.replace('section', '');
      curTitle = meta ? meta.title : key;
      if (!counts[curSec]) counts[curSec] = 0;
      continue;
    }

    const pos = parseTags(val.positive);
    const neg = parseTags(val.negative);
    const altlinks = parseLinks(val.altlink);
    const exAlt = parseLinks(val['ex-altlink']);
    const domains = val.domains ? val.domains.split(/[\s,#]+/).filter(Boolean) : [];
    const info = strip(val.info);

    const isDead = isExplicitlyDead(val['ex-DEAD'])
      || neg.some(n => /dead|shutdown|discontinued|defunct|offline|closed|shut down/i.test(n))
      || /discontinued|shut down|no longer active|permanently closed|dead site/i.test(info);

    if (!altlinks.length && domains.length > 0) {
      for (const d of domains) {
        const clean = d.replace(/^https?:\/\//i, '').trim();
        if (clean.includes('.') && !altlinks.some(l => l.url.includes(clean))) {
          altlinks.push({ label: clean, url: d.startsWith('http') ? d : `https://${clean}` });
        }
      }
    }

    if (!altlinks.length && exAlt.length > 0) {
      for (const ex of exAlt) {
        if (!altlinks.some(l => l.url === ex.url)) altlinks.push(ex);
      }
    }

    if (!altlinks.length) {
      if (!isDead) {
        const cleanKey = cleanIconId(key);
        const defaultDomain = `${cleanKey}.com`;
        altlinks.push({ label: defaultDomain, url: `https://${defaultDomain}` });
      }
    }

    sites.push({
      id: key,
      name: key,
      section: curSec,
      categoryName: curTitle,
      positive: pos,
      negative: neg,
      info,
      altlinks,
      domains,
      isLowSec: false,
      isDead,
      iconUrl: val.icon || `https://static.everythingmoe.com/icons/${cleanIconId(key)}.png`
    });

    counts[curSec] = (counts[curSec] || 0) + 1;
  }

  const sections: SectionMeta[] = Object.entries(SECTION_MAPPINGS).map(([, meta]) => ({
    id: meta.id,
    key: `section${meta.id}`,
    title: meta.title,
    iconName: meta.id,
    siteCount: counts[meta.id] || 0
  }));

  return { sites, sections };
}
