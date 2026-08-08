import { expect, test, describe } from 'bun:test';
import { SECTION_MAPPINGS, isExplicitlyDead, parseLinks, strip } from '../data';

describe('Data Module (src/data.ts)', () => {
  test('SECTION_MAPPINGS contains all required category definitions', () => {
    expect(SECTION_MAPPINGS.sectionanime).toBeDefined();
    expect(SECTION_MAPPINGS.sectionanime.id).toBe('anime');
    expect(SECTION_MAPPINGS.sectionmanga).toBeDefined();
    expect(SECTION_MAPPINGS.sectionmanga.id).toBe('manga');
  });

  test('isExplicitlyDead evaluates truthiness without false positives for "0" or "false"', () => {
    expect(isExplicitlyDead(true)).toBe(true);
    expect(isExplicitlyDead('1')).toBe(true);
    expect(isExplicitlyDead('true')).toBe(true);
    expect(isExplicitlyDead('DEAD')).toBe(true);

    expect(isExplicitlyDead(false)).toBe(false);
    expect(isExplicitlyDead('0')).toBe(false);
    expect(isExplicitlyDead('false')).toBe(false);
    expect(isExplicitlyDead('')).toBe(false);
    expect(isExplicitlyDead(undefined)).toBe(false);
  });

  test('parseLinks parses mirror definitions and preserves URL hash fragments', () => {
    const raw = 'Primary<<https://example.com/watch#season1#Secondary<<https://mirror.com/stream#ep2';
    const parsed = parseLinks(raw);
    expect(parsed.length).toBe(2);
    expect(parsed[0]).toEqual({ label: 'Primary', url: 'https://example.com/watch#season1' });
    expect(parsed[1]).toEqual({ label: 'Secondary', url: 'https://mirror.com/stream#ep2' });
  });

  test('strip sanitizes HTML tags and decodes entities', () => {
    expect(strip('<b>Test &amp; Code</b>')).toBe('Test & Code');
    expect(strip('<script>alert(1)</script>Safe')).toBe('alert(1)Safe');
  });
});

