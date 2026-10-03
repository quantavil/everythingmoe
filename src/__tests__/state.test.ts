import { afterEach, describe, expect, test } from 'bun:test';
import { effect } from '@preact/signals';
import type { Home, Section } from '../shared/home';
import { home, loadAllLow, low } from '../state';

const section = (id: string, lowId: string | null): Section => ({
  id,
  title: id,
  short: id,
  color: '#222',
  nsfw: false,
  count: 3,
  notes: [],
  filterOptions: [],
  items: [],
  lowId,
  lowStart: 5
});

describe('loadAllLow', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    low.value = {};
  });

  test('publishes the lists once, so the search index is rebuilt once and not per list', async () => {
    home.value = {
      sections: [section('a', 'a'), section('b', 'b'), section('c', null), section('d', 'd')],
      menu: []
    } as Home;
    globalThis.fetch = (async (url: string) =>
      Response.json([
        { id: String(url).slice(-1), title: `Site ${String(url).slice(-1)}`, link: 'https://x.example' }
      ])) as unknown as typeof fetch;

    let runs = 0;
    const stop = effect(() => {
      low.value;
      runs++;
    });
    await loadAllLow();
    stop();

    expect(runs).toBe(3); // initial read, "loading" marker, final results
    expect(Object.keys(low.value).sort()).toEqual(['a', 'b', 'd']);
    expect(low.value.a.items[0].rank).toBe(5);
    expect(low.value.a.status).toBe('ready');
  });

  test('a failing list is marked as an error and does not block the others', async () => {
    home.value = { sections: [section('a', 'a'), section('b', 'b')], menu: [] } as Home;
    globalThis.fetch = (async (url: string) =>
      String(url).endsWith('a') ? new Response('nope', { status: 500 }) : Response.json([])) as unknown as typeof fetch;
    await loadAllLow();
    expect(low.value.a.status).toBe('error');
    expect(low.value.b.status).toBe('ready');
  });
});
