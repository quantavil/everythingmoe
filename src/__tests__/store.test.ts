import { expect, test, describe, beforeEach } from 'bun:test';
import { getBookmarks, toggleBookmark, syncUrlParams } from '../store';

// Mock localStorage and window for Bun test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    }
  };
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    location: { href: 'https://everythingmoe.com', search: '' },
    history: {
      replaceState: () => {}
    }
  };
}

describe('Store & State Persistence (src/store.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('toggleBookmark adds and removes site IDs', () => {
    expect(getBookmarks()).toEqual([]);

    const isAdded = toggleBookmark('site-123');
    expect(isAdded).toBe(true);
    expect(getBookmarks()).toEqual(['site-123']);

    const isRemoved = toggleBookmark('site-123');
    expect(isRemoved).toBe(false);
    expect(getBookmarks()).toEqual([]);
  });

  test('getBookmarks safely handles non-array or corrupt JSON in localStorage', () => {
    localStorage.setItem('everythingmoe_favorites_v2', '{"corrupted": true}');
    expect(getBookmarks()).toEqual([]);
    localStorage.setItem('everythingmoe_favorites_v2', '12345');
    expect(getBookmarks()).toEqual([]);
    localStorage.setItem('everythingmoe_favorites_v2', '["valid-id"]');
    expect(getBookmarks()).toEqual(['valid-id']);
  });

  test('syncUrlParams handles tag filters', () => {
    expect(() => {
      syncUrlParams('naruto', 'anime', true, new Set(['softsubs', 'no-ads']));
    }).not.toThrow();
  });
});
