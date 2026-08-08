import { expect, test, describe } from 'bun:test';
import { getFilteredSites, matchesTagFilters } from '../main';
import { IndexedSiteItem } from '../search';
import { getUrlParams } from '../store';

describe('Filter Pipeline (src/main.ts)', () => {
  const sampleSites: IndexedSiteItem[] = [
    {
      id: 'site1',
      name: 'AnimeFlix',
      section: 'anime',
      categoryName: 'Anime',
      positive: ['Softsubs', 'No Ads'],
      negative: [],
      info: '1080p stream',
      altlinks: [{ label: 'Main', url: 'https://flix.com' }],
      domains: ['flix.com'],
      isLowSec: false,
      isDead: false,
      _searchIndex: 'animeflix anime softsubs no ads 1080p stream'
    },
    {
      id: 'site2',
      name: 'HentaiHaven',
      section: 'hentai',
      categoryName: 'Hentai',
      positive: ['Clean UI'],
      negative: ['Popups', 'Aggressive Ads'],
      info: 'Adult stream',
      altlinks: [{ label: 'Main', url: 'https://hh.com' }],
      domains: ['hh.com'],
      isLowSec: false,
      isDead: false,
      _searchIndex: 'hentaihaven adult stream'
    },
    {
      id: 'site3',
      name: 'OldDeadSite',
      section: 'manga',
      categoryName: 'Manga',
      positive: [],
      negative: [],
      info: 'Closed down',
      altlinks: [{ label: 'Main', url: 'https://dead.com' }],
      domains: ['dead.com'],
      isLowSec: false,
      isDead: true,
      _searchIndex: 'olddeadsite manga closed down'
    }
  ];

  test('getFilteredSites filters out dead sites for section=all', () => {
    const result = getFilteredSites(sampleSites, { sectionId: 'all' });
    expect(result.length).toBe(2);
    expect(result.some(s => s.id === 'site3')).toBe(false);
  });

  test('getFilteredSites includes dead sites when sectionId is dead', () => {
    const result = getFilteredSites(sampleSites, { sectionId: 'dead' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('site3');
  });

  test('getUrlParams parses query params accurately', () => {
    const params = getUrlParams();
    expect(params.section).toBe('all');
    expect(params.query).toBe('');
  });

  test('matchesTagFilters correctly filters no-ads sites', () => {
    const noAdsFilter = new Set(['no-ads']);
    expect(matchesTagFilters(sampleSites[0], noAdsFilter)).toBe(true);
    expect(matchesTagFilters(sampleSites[1], noAdsFilter)).toBe(false);
    expect(matchesTagFilters(sampleSites[2], noAdsFilter)).toBe(false);
  });

  test('matchesTagFilters correctly filters softsubs sites', () => {
    const softsubsFilter = new Set(['softsubs']);
    expect(matchesTagFilters(sampleSites[0], softsubsFilter)).toBe(true);
    expect(matchesTagFilters(sampleSites[1], softsubsFilter)).toBe(false);
  });

  test('matchesTagFilters returns true when no tag filters are active', () => {
    expect(matchesTagFilters(sampleSites[0], new Set())).toBe(true);
  });
});
