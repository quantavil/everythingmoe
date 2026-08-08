import { expect, test, describe } from 'bun:test';
import { getAvatarStyle, renderGridCard } from '../components';
import { IndexedSiteItem } from '../search';

describe('UI Components (src/components.ts)', () => {
  const mockSite: IndexedSiteItem = {
    id: 'anidb',
    name: 'AniDB',
    section: 'anime',
    categoryName: 'Anime Streaming',
    positive: ['Clean UI'],
    negative: [],
    info: 'Anime database portal',
    altlinks: [{ label: 'AniDB Main', url: 'https://anidb.net' }],
    domains: ['anidb.net'],
    isLowSec: false,
    isDead: false,
    iconUrl: 'https://static.everythingmoe.com/icons/anidb.png',
    _searchIndex: 'anidb'
  };

  test('getAvatarStyle generates deterministic linear-gradient string', () => {
    const style1 = getAvatarStyle('AniDB');
    const style2 = getAvatarStyle('AniDB');
    expect(style1).toContain('linear-gradient');
    expect(style1).toBe(style2);
  });

  test('renderGridCard produces safe HTML string', () => {
    const html = renderGridCard(mockSite, false);
    expect(html).toContain('AniDB');
    expect(html).toContain('anidb.net');
    expect(html).toContain('site-card');
  });
});

