import { describe, expect, test } from 'bun:test';
import { buildDoc, searchDocs, splitByRanges } from '../search';
import type { Detail, Item } from '../shared/home';

const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({
  id,
  name,
  rank: 1,
  url: `https://${id}.example`,
  icon: '',
  tags: [],
  filters: [],
  licensed: false,
  torrent: false,
  nsfw: false,
  low: false,
  ...extra
});
const detail = (note: string): Detail => ({ positive: [], negative: [], note, mirrors: [], extra: [], dead: '' });

const docs = [
  buildDoc('anime', item('miruro', 'Miruro', { filters: ['Scraper'] })),
  buildDoc('anime', item('animepahe', 'animepahe')),
  buildDoc('download', item('nyaa', 'Nyaa', { tags: ['DDL'], torrent: true })),
  buildDoc('anime', item('other', 'Other Site'), detail('great for watching Miruro releases'))
];

describe('searchDocs', () => {
  test('finds by name and ranks name matches before note matches', () => {
    const hits = searchDocs(docs, 'miruro');
    expect(hits[0].doc.item.id).toBe('miruro');
    expect(hits.map((h) => h.doc.item.id)).toContain('other');
    expect(hits.findIndex((h) => h.doc.item.id === 'other')).toBeGreaterThan(0);
  });

  test('tolerates a single typo', () => {
    expect(searchDocs(docs, 'miruo').map((h) => h.doc.item.id)).toContain('miruro');
  });

  test('finds by tag and by facet', () => {
    expect(searchDocs(docs, 'ddl').map((h) => h.doc.item.id)).toContain('nyaa');
    expect(searchDocs(docs, 'scraper').map((h) => h.doc.item.id)).toContain('miruro');
  });

  test('empty query returns nothing', () => {
    expect(searchDocs(docs, '   ')).toEqual([]);
  });

  test('provides highlight ranges for name hits', () => {
    const hit = searchDocs(docs, 'pahe')[0];
    expect(hit.doc.item.id).toBe('animepahe');
    expect(splitByRanges('animepahe', hit.ranges).some((p) => p.hit && p.text === 'pahe')).toBe(true);
  });
});

describe('splitByRanges', () => {
  test('alternates plain and matched text', () => {
    expect(splitByRanges('abcdef', [1, 3])).toEqual([
      { text: 'a', hit: false },
      { text: 'bc', hit: true },
      { text: 'def', hit: false }
    ]);
    expect(splitByRanges('abc', null)).toEqual([{ text: 'abc', hit: false }]);
  });
});
