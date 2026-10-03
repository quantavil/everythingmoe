import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('Content-Security-Policy', () => {
  test('allows exactly the inline theme script in index.html', () => {
    const inline = root('index.html').match(/<script>([\s\S]*?)<\/script>/);
    expect(inline).not.toBeNull();
    const hash = `sha256-${createHash('sha256').update(inline![1]).digest('base64')}`;
    // If this fails, index.html's inline script changed: update the hash in public/_headers.
    expect(root('public/_headers')).toContain(`'${hash}'`);
  });

  test('every external script in index.html is same-origin', () => {
    for (const tag of root('index.html').matchAll(/<script[^>]+src="([^"]+)"/g)) {
      expect(tag[1].startsWith('/')).toBe(true);
    }
  });
});
