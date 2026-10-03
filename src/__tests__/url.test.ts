import { describe, expect, test } from 'bun:test';
import { legacyHash, parseHash, toHash } from '../url';

describe('url state', () => {
  test('empty hash is the overview', () => {
    expect(parseHash('')).toEqual({ route: { view: 'home' }, query: '', filters: [] });
    expect(parseHash('#/')).toEqual({ route: { view: 'home' }, query: '', filters: [] });
  });

  test('section, saved, query and filters', () => {
    expect(parseHash('#/s/anime?f=Self-host,Soft-sub').route).toEqual({ view: 'section', id: 'anime' });
    expect(parseHash('#/s/anime?f=Self-host,Soft-sub').filters).toEqual(['Self-host', 'Soft-sub']);
    expect(parseHash('#/saved').route).toEqual({ view: 'saved' });
    expect(parseHash('#/?q=ani%20mo').query).toBe('ani mo');
  });

  test('unknown paths fall back to home', () => {
    expect(parseHash('#/nope/what').route).toEqual({ view: 'home' });
    expect(parseHash('#/s/../../etc').route).toEqual({ view: 'home' });
  });

  test('round trips', () => {
    const state = { route: { view: 'section', id: 'download' } as const, query: 'nyaa', filters: ['DDL'] };
    expect(parseHash(toHash(state))).toEqual(state);
    expect(toHash({ route: { view: 'home' }, query: '  ', filters: ['x'] })).toBe('#/');
  });

  test('filters only travel with a section page', () => {
    expect(toHash({ route: { view: 'saved' }, query: '', filters: ['x'] })).toBe('#/saved');
  });
});

describe('legacy query-string links', () => {
  test('section and search map to the hash route', () => {
    expect(legacyHash('?lowsec=false&section=hentairead')).toBe('#/s/hentairead');
    expect(legacyHash('?section=anime&q=nyaa')).toBe('#/s/anime?q=nyaa');
    expect(legacyHash('?q=ani')).toBe('#/?q=ani');
  });

  test('old multi-select keeps the first category and renamed ids follow', () => {
    expect(legacyHash('?section=manga,novel')).toBe('#/s/manga');
    expect(legacyHash('?section=tracker')).toBe('#/s/database');
  });

  test('pseudo sections and unrelated params are ignored', () => {
    expect(legacyHash('?section=favorites')).toBe('#/');
    expect(legacyHash('?lowsec=true')).toBeNull();
    expect(legacyHash('')).toBeNull();
    expect(legacyHash('?section=../x')).toBe('#/');
  });
});
