import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  decode,
  type Item,
  matchesFilters,
  parseDetail,
  parseHome,
  parseLinks,
  parseLow,
  stripTags
} from '../shared/home';

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const html = read('home.html');
const menu = JSON.parse(read('menu.json'));
const sections = parseHome(html, menu);
const byId = (id: string) => sections.find((s) => s.id === id)!;

describe('parseHome', () => {
  test('finds every section in page order, including NSFW ones', () => {
    expect(sections.map((s) => s.id)).toEqual(['anime', 'download', 'hentai', 'western']);
  });

  test('reads title, count and tint', () => {
    const anime = byId('anime');
    expect(anime.title).toBe('Anime Streaming');
    expect(anime.count).toBe(93);
    expect(anime.color).toBe('#222b20');
    expect(anime.short).toBe('Anime');
  });

  test('keeps rank order and primary links', () => {
    const [first, , , miruro] = byId('anime').items;
    expect(first).toMatchObject({ id: 'reanime', name: 'Re:Anime', rank: 1, url: 'https://reanime.to/home' });
    expect(first.icon).toStartWith('https://static.everythingmoe.com/icons/');
    expect(miruro.rank).toBe(4);
  });

  test('reads curated facets and chips', () => {
    const anime = byId('anime');
    expect(anime.items[0].filters).toContain('Soft-sub');
    expect(anime.filterOptions).toContain('Self-host');
    expect(anime.items.find((i) => i.id === 'miruro')!.tags).toEqual(['MULT']);
  });

  test('flags torrent sites and keeps text chips', () => {
    const tosho = byId('download').items.find((i) => i.id === 'animetosho')!;
    expect(tosho.torrent).toBe(true);
    expect(tosho.tags).toEqual(['DDL', 'USENET']);
  });

  test('keeps the spaces around linked names in notes', () => {
    const notes = byId('anime').notes;
    expect(notes[0]).toEqual({ text: 'AnimeKai', id: 'animekai' });
    expect(notes[1].text).toBe(' is moved to Graveyard');
  });

  test('reads where low ranks continue from', () => {
    expect(byId('anime')).toMatchObject({ lowId: 'anime', lowStart: 21 });
    expect(byId('western').lowId).toBeNull();
  });

  test('marks nsfwsection pages as NSFW', () => {
    expect(byId('hentai').nsfw).toBe(true);
    expect(byId('anime').nsfw).toBe(false);
  });

  test('returns nothing for markup it does not know', () => {
    expect(parseHome('<html><body>maintenance</body></html>')).toEqual([]);
  });

  test('flags licensed rows and ignores rows without a usable link', () => {
    const page = `<div  id="sec-x" class="section"><div class="section-title"><span class="title-text" onclick="x"><i></i> X <div class="sec-count">(2)</div></span></div><div class="section-list">
      <div data-rank="1" data-filter="A, B" class="section-item section-licensed"><span>1.</span> <a href="/s/one" data-link="https://one.example"><img src="/icons/one.png" alt=""> One &amp; Co</a> <div class="morebtn"></div></div>
      <div data-rank="2" data-filter="" class="section-item"><span>2.</span> <a href="/s/two" data-link="#comments"><img src="x.png" alt=""> Two</a> <div class="morebtn"></div></div></div></div>`;
    const [s] = parseHome(page);
    expect(s.items[0]).toMatchObject({
      name: 'One & Co',
      licensed: true,
      filters: ['A', 'B'],
      icon: 'https://everythingmoe.com/icons/one.png'
    });
    expect(s.items[1].url).toBe('');
  });
});

describe('parseLow', () => {
  const raw = JSON.parse(read('lowsec-anime.json'));

  test('continues ranks from the given start and keeps facets', () => {
    const { items } = parseLow(raw, 21);
    expect(items[0].rank).toBe(21);
    expect(items[1].rank).toBe(22);
    expect(items.every((i) => i.low)).toBe(true);
    expect(items[0].filters.length).toBeGreaterThan(0);
  });

  test('separates shut-down sites', () => {
    const { items, dead } = parseLow(raw, 1);
    expect(dead.length).toBe(1);
    expect(items.some((i) => i.id === dead[0].id)).toBe(false);
  });

  test('maps tag words to flags and chips', () => {
    const { items } = parseLow(
      [
        { id: 'a', title: 'A', link: 'https://a.example', tags: 'licensed' },
        { id: 'b', title: 'B', link: 'https://b.example', tags: 'torrent ddl nsfw' }
      ],
      1
    );
    expect(items[0].licensed).toBe(true);
    expect(items[1]).toMatchObject({ torrent: true, nsfw: true, tags: ['DDL'] });
  });

  test('survives garbage input', () => {
    expect(parseLow(null, 1)).toEqual({ items: [], dead: [] });
    expect(parseLow([null, {}, { title: '' }, { title: 'ok', link: 'javascript:alert(1)' }], 1).items[0].url).toBe('');
  });
});

describe('details', () => {
  const details = JSON.parse(read('details.json'));

  test('parses pros, cons, note and mirrors', () => {
    const d = parseDetail(details.miruro);
    expect(d.positive).toHaveLength(4);
    expect(d.negative).toEqual(['Some stream server issues recently']);
    expect(d.note).toStartWith('note:');
    expect(d.mirrors.map((m) => m.label)).toEqual(['.ru', '.bz', '.tv', 'mirrors']);
    expect(d.extra.length).toBeGreaterThan(0);
  });

  test('keeps a URL fragment inside one link', () => {
    const links = parseLinks('Docs<<https://a.example/page#section#Mirror<<https://b.example/');
    expect(links).toEqual([
      { label: 'Docs', url: 'https://a.example/page#section' },
      { label: 'Mirror', url: 'https://b.example/' }
    ]);
  });

  test('drops non-http links', () => {
    expect(parseLinks('x<<javascript:alert(1)#ok<<https://ok.example')).toEqual([
      { label: 'ok', url: 'https://ok.example' }
    ]);
  });

  test('treats a dead date string as dead', () => {
    expect(parseDetail({ 'ex-DEAD': 'Site shutdown at 23 Apr 2026' }).dead).toContain('shutdown');
    expect(parseDetail(undefined).dead).toBe('');
  });
});

describe('text helpers', () => {
  test('decode and stripTags', () => {
    expect(decode('A &amp; B &#39;c&#39;')).toBe("A & B 'c'");
    expect(stripTags('<b>bold</b> &lt;ok&gt;')).toBe('bold <ok>');
    expect(stripTags(undefined)).toBe('');
  });
});

describe('matchesFilters', () => {
  const item = { filters: ['Self-host', 'Soft-sub'] } as Item;
  test('requires every active filter', () => {
    expect(matchesFilters(item, new Set())).toBe(true);
    expect(matchesFilters(item, new Set(['Self-host']))).toBe(true);
    expect(matchesFilters(item, new Set(['Self-host', 'Dub friendly']))).toBe(false);
  });
});
