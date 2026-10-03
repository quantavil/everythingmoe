import { describe, expect, test } from 'bun:test';
import { normalizeBookmarkId, normalizeBookmarks } from '../store';

describe('bookmark migration', () => {
  test('strips the old low-rank prefix', () => {
    expect(normalizeBookmarkId('lowsec_anime_AnimeParadise')).toBe('AnimeParadise');
    expect(normalizeBookmarkId('lowsec_hentairead_some_id')).toBe('some_id');
    expect(normalizeBookmarkId('miruro')).toBe('miruro');
  });

  test('de-duplicates after normalising', () => {
    expect(normalizeBookmarks(['miruro', 'lowsec_anime_miruro', 'reanime'])).toEqual(['miruro', 'reanime']);
  });
});
