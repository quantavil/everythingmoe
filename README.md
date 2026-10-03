# EverythingMoe viewer

An unofficial, faster way to browse [EverythingMoe](https://everythingmoe.com)'s ranked lists of anime, manga, novel,
music and other otaku sites. Rankings, notes and reviews all belong to EverythingMoe. This project only presents them
differently. Comments, corrections and submissions stay on the original site, and the viewer links there.

## What it adds

- **Everything on one page, in as many columns as fit.** 3 to 4 columns on desktop, 1 on a phone, instead of a fixed two.
- **Sticky search and section bar.** Search covers every section, including low ranks, with typo tolerance and
  highlighting. Click a section to jump to it. The "Sections" button opens the full tile grid.
- **The original's data, kept.** Rank numbers, chips (MULT, DDL, RAW…), curated filters (Self-host, Soft-sub…),
  section notes, pros and cons, mirrors and comment counts.
- **Section pages.** Click a section title for a full-width list with filters that show how many sites match.
- **Status checks you ask for.** Expanding a site, or pressing the refresh icon on a panel, asks our edge function whether
  the links respond. Nothing is probed in the background.
- **Saved sites** (stored on your device), light and dark themes, an NSFW switch (off by default), keyboard shortcuts
  (`/`, `F` or `Ctrl/Cmd+K` to search, `Esc` to clear) and offline reading.
- **Back/Forward and deep links work.** Every view is a URL (`#/s/anime?f=Self-host`, `#/?q=nyaa`).

## Where the data comes from

| What | Source | Through |
| --- | --- | --- |
| Ranked lists, chips, filters, notes, section colours | EverythingMoe's server-rendered page | `/api/home` (parsed server side) |
| Pros, cons, notes, mirrors | `/data/cache/main.json` | `/api/dataset` |
| Low-ranked sites | `/data/lowsec/{section}.json` | `/api/lowsec?sec=` |
| Comment counts | `/comments/threadcount.json` | `/api/comments` |

The ranked lists exist only in the page's HTML, so `src/shared/home.ts` parses it. If EverythingMoe changes that markup,
`/api/home` answers `502 Upstream layout changed` rather than showing wrong data. The parser tests run against saved
real markup in `src/__tests__/fixtures/`.

## Stack

Preact + `@preact/signals`, Vite, TypeScript, Biome, `@leeoniya/ufuzzy` for search, `lucide-preact` for icons, Geist
fonts served from the same origin. Cloudflare Pages Functions in `functions/api/` provide the API, with edge caching.

```
src/shared/home.ts     model + parsers shared by the client and the Functions
src/shared/proxy.ts    upstream fetch helpers and edge cache
functions/api/         home, dataset, lowsec, comments, health
src/state.ts           data, route and derived lists (signals)
src/store.ts           saved sites, theme, NSFW, rows per list (localStorage)
src/health.ts          on-demand status checks through /api/health
src/search.ts          fuzzy index over names, tags, facets and notes
src/components/        UI
public/                service worker, manifest, _headers (CSP), _routes.json
```

## Develop

```bash
bun install
bun run dev      # Vite serves /api/* by calling the same Function modules as production
bun test         # parser, search, URL, store and edge-guard tests (no network needed)
bun run lint     # Biome
bun run check    # tsc --noEmit
bun run build
```

`bun run dev` needs network access to everythingmoe.com for live data.

## Deploy (Cloudflare Pages)

Build command `bun run build`, output directory `dist`. The `functions/` folder is picked up automatically, and
`public/_routes.json` limits Function invocations to `/api/*`.

If you edit the inline theme script in `index.html`, update its hash in `public/_headers` (the Content-Security-Policy).
`src/__tests__/headers.test.ts` fails until you do.

## Privacy and safety

- No analytics, and no requests reporting what you click. (EverythingMoe's own site reports outgoing clicks to itself.
  This viewer does not.)
- The browser never contacts a listed site by itself. Status checks go through `/api/health`, which only accepts public
  hostnames on ports 80 and 443.
- Site icons load from `static.everythingmoe.com` without a referrer.
- NSFW sites are hidden until you switch them on. The setting is remembered on your device.

## License

MIT. Data and rankings © EverythingMoe and its contributors.
