import { expect, test, describe } from 'bun:test';
import { indexSites, searchSites } from '../search';
import { SiteItem } from '../types';

describe('Search Engine (src/search.ts)', () => {
  const sampleSites: SiteItem[] = [
    {
      id: 'aniwave',
      name: 'AniWave',
      section: 'anime',
      categoryName: 'Anime Streaming',
      positive: ['Ad-Free', '1080p'],
      negative: [],
      info: 'Popular anime streaming portal',
      altlinks: [{ label: 'AniWave Official', url: 'https://aniwave.to' }],
      domains: ['aniwave.to'],
      isLowSec: false,
      isDead: false
    },
    {
      id: 'mangadex',
      name: 'MangaDex',
      section: 'manga',
      categoryName: 'Manga & Webtoons',
      positive: ['Clean UI', 'No Ads'],
      negative: [],
      info: 'Open source manga reader platform',
      altlinks: [{ label: 'MangaDex Main', url: 'https://mangadex.org' }],
      domains: ['mangadex.org'],
      isLowSec: false,
      isDead: false
    }
  ];

  test('indexSites pre-computes lowercase search index strings', () => {
    const indexed = indexSites(sampleSites);
    expect(indexed.length).toBe(2);
    expect(indexed[0]._searchIndex).toContain('aniwave');
    expect(indexed[0]._searchIndex).toContain('1080p');
    expect(indexed[1]._searchIndex).toContain('mangadex.org');
  });

  test('searchSites filters accurately based on single token', () => {
    const indexed = indexSites(sampleSites);
    const results = searchSites('manga', indexed);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('mangadex');
  });

  test('searchSites supports multi-token matching', () => {
    const indexed = indexSites(sampleSites);
    const results = searchSites('aniwave 1080p', indexed);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('aniwave');
  });

  test('searchSites returns all sites for empty query', () => {
    const indexed = indexSites(sampleSites);
    const results = searchSites('   ', indexed);
    expect(results.length).toBe(2);
  });
});
