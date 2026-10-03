# EverythingMoe viewer: project notes

## What this is
An unofficial reskin of everythingmoe.com. The point is a better way to read the same ranked lists, not new data.
Parity with the original comes first: if something the original shows is missing here, that is a bug.

## Data model (the part that is easy to get wrong)
- **`/data/cache/main.json` is a details dictionary, not a section listing.** Keys are site ids. Section markers
  (`sectionanime` …) hold *low-rank lists* and sit *after* the sites they follow. Sections without a low-rank list
  (game, western, quiz, trend, tools, cosplay, amv) have no marker at all. Parsing it as "marker, then its sites"
  files sites under the wrong categories. An earlier version did exactly that.
- **Ranked top lists, chips, curated filters, notes and colours exist only in the server-rendered HTML of `/`.**
  `src/shared/home.ts` parses it. Rank numbers can skip (hidden NSFW items), and the low-rank list continues from
  `expandsection(this,'<id>',<start>)`, so use that start number.
- Low ranks: `/data/lowsec/{id}.json`. The id can differ from the section id (section `database` uses `tracker`).
- NSFW sections (`hentai`, `hentairead`) and NSFW items are only in the HTML when the request carries `Cookie: nsfw=true`.
  Their section class is `section nsfwsection`, which an exact `class="section"` match misses.
- `ex-DEAD` is a date string such as "Site shutdown at 23 Apr 2026", not a boolean.
- Comment counts: `/comments/threadcount.json`, keyed by `/s/{id}` in lower case. Threads live upstream.
- `/data/expand/{id}.json` equals the entry in `main.json`; the viewer loads `main.json` once instead.

## Rules we keep
- The browser never contacts a listed site. Health checks go through `/api/health` and only run when the user asks.
- `/api/health` accepts public hostnames only (no IP literals, no internal names, ports 80/443). 403/503 still means alive.
- Never cache `/api/health` in the service worker, otherwise "Check status" replays old answers.
- No Google favicon service as a health signal. It answers 200 for domains that do not exist.
- Bookmark ids are upstream site ids. Old `lowsec_{section}_{id}` ids are migrated in `src/store.ts`.
- CSS custom properties that derive from `--sec` must be declared on the element that sets `--sec`. Declared on `:root`
  they resolve once with `--sec` unset and every panel loses its tint.

## Testing
- `bun test` is hermetic. Parser tests use real saved markup in `src/__tests__/fixtures/`.
- To check the UI in a browser without network, serve `dist/` and answer `/api/*` by importing the Function modules
  with `fetch` replaced by saved upstream responses. That exercises the real parsing and edge code.

## Blunders log
- Parsed `main.json` as sequential sections (see Data model). Result: Anime held 99 sites instead of 20 top-ranked,
  and hentai sites appeared under Donghua.
- Client fallbacks pointed at `everythingmoe.com/dataset.json` and `/lowsec/{id}.json`, both 404. Only the edge
  function's second URL worked, so `vite dev` showed "Connection Error".
- Edge health returned "online" whenever Google's favicon service answered, so dead domains looked alive.
- The service worker cached `/api/health` cache-first with no expiry.
- `Boolean(item['ex-DEAD'])` marked sites dead for the string "0".
- Filter chips matched substrings of free text (`app` matched "happy"). Curated facets from upstream replaced them.
