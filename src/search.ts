import { SiteItem } from './types';

export interface IndexedSiteItem extends SiteItem {
  _searchIndex?: string;
}

export function indexSites(sites: SiteItem[]): IndexedSiteItem[] {
  return sites.map(site => ({
    ...site,
    _searchIndex: [
      site.name,
      site.domains.join(' '),
      site.positive.join(' '),
      site.negative.join(' '),
      site.categoryName,
      site.info,
      site.altlinks.map(l => `${l.label} ${l.url}`).join(' ')
    ].join(' ').toLowerCase()
  }));
}

export function searchSites(query: string, sites: IndexedSiteItem[]): IndexedSiteItem[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return sites;
  return sites.filter(site => {
    const idx = site._searchIndex || '';
    return tokens.every(t => idx.includes(t));
  });
}
