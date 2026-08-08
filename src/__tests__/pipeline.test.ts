import { expect, test, describe } from 'bun:test';
import { getFilteredSites } from '../main';
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
      negative: [],
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

  test('getFilteredSites respects hideNsfw flag', () => {
    const hidden = getFilteredSites(sampleSites, { sectionId: 'all', hideNsfw: true });
    expect(hidden.length).toBe(1);
    expect(hidden[0].id).toBe('site1');

    const shown = getFilteredSites(sampleSites, { sectionId: 'all', hideNsfw: false });
    expect(shown.length).toBe(2);
  });

  test('getUrlParams parses query params accurately', () => {
    const params = getUrlParams();
    expect(params.section).toBe('all');
    expect(params.query).toBe('');
  });
});
