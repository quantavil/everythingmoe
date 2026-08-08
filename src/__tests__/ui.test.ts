import { expect, test, describe } from 'bun:test';
import { escapeHtml, escapeUrl, getSiteDomain } from '../ui';
import { IndexedSiteItem } from '../search';

describe('UI Utilities (src/ui.ts)', () => {
  test('escapeHtml sanitizes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml("Foo & 'Bar'")).toBe('Foo &amp; &#39;Bar&#39;');
    expect(escapeHtml('')).toBe('');
  });

  test('escapeUrl restricts unsafe protocols to #', () => {
    expect(escapeUrl('https://everythingmoe.com')).toBe('https://everythingmoe.com');
    expect(escapeUrl('http://example.com/foo?bar=1')).toBe('http://example.com/foo?bar=1');
    expect(escapeUrl('javascript:alert(1)')).toBe('#');
    expect(escapeUrl('data:text/html,<script>')).toBe('#');
    expect(escapeUrl('')).toBe('#');
  });

  test('getSiteDomain extracts hostname from domains or altlinks', () => {
    const site1: IndexedSiteItem = {
      id: 'test1',
      name: 'Test',
      section: 'anime',
      categoryName: 'Anime',
      positive: [],
      negative: [],
      info: '',
      altlinks: [{ label: 'Mirror', url: 'https://sub.domain.org/path' }],
      exAltlinks: [],
      domains: ['primary.com'],
      isDead: false
    };

    expect(getSiteDomain(site1)).toBe('primary.com');

    const site2: IndexedSiteItem = {
      id: 'test2',
      name: 'Test 2',
      section: 'anime',
      categoryName: 'Anime',
      positive: [],
      negative: [],
      info: '',
      altlinks: [{ label: 'Mirror', url: 'https://fallback-mirror.to/path' }],
      exAltlinks: [],
      domains: [],
      isDead: false
    };

    expect(getSiteDomain(site2)).toBe('fallback-mirror.to');
  });
});
