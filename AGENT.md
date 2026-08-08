# EverythingMoe 2.0 Project Agent Log

## Overview
Ultra-fast, zero-dependency Otaku resource directory indexing 1,200+ main & low-ranked sites across 18 categories using Bun, TypeScript, Vanilla CSS, Vite, and Cloudflare Pages Functions.

## Project Structure
- `functions/api/dataset.ts` - Cloudflare Pages serverless proxy for `/api/dataset` with 10-min Edge CDN caching.
- `functions/api/lowsec.ts` - Cloudflare Pages serverless proxy for category-specific low-ranked site sub-indexes.
- `functions/api/health.ts` - Cloudflare Pages serverless proxy for edge health checking and domain redirect detection.
- `src/main.ts` - Entry point orchestrating search filtering, category updates, tag filters, and `IntersectionObserver` health probes.
- `src/components.ts` - Grid card component (`renderGridCard`), skeleton loading template (`renderSkeletonState`), site icon rendering, and health refresh control.
- `src/health.ts` - 5-minute health cache (`healthCache`), `fetch()` GET + `Image` favicon fallback probes, and concurrency-queued mirror checker.
- `src/ui.ts` - String escaping, URL sanitization, domain extraction, and toast notifications.
- `src/data.ts` - Multi-tier dataset fetching (`/api/` -> remote origin fallback), fragment-safe link parsing, `isExplicitlyDead` detection, and category mappings.
- `src/search.ts` - Fast 0.1ms zero-dependency multi-term search indexer.
- `src/store.ts` - Bookmarks storage with corrupt data recovery, theme preferences, lowsec toggle state, and URL query parameter deep linking (`tags`, `section`, `q`, `lowsec`).
- `src/icons.ts` - Inline SVG icons module.
- `src/styles.css` - Vanilla CSS (`@layer reset, base, components, utilities`) with Editorial Luxury dark/light theme tokens.
- `public/sw.js` - Service Worker PWA Network-First caching strategy.

## Non-Obvious Discoveries
- Sites without `altlink` or `domains` property require fallback link generation to `https://${key}.com`.
- Sites marked with `ex-DEAD` or `#dead` tags are flagged as `isDead` and separated into the `💀 Dead / Offline` category tab.
- Google `s2/favicons` service returns HTTP 200 with 16x16 default globe images for missing favicons, which bypassed `onerror` handlers; handled by inspecting `img.naturalWidth <= 16` on fallback load.
- Multi-tier icon loader resolves: official static PNG -> Google domain favicon -> dynamic gradient letter avatar badge.
- `checkAllMirrorsHealth` checks ALL mirrors per site, ensuring every mirror pill receives a live status dot.
- Dual probe strategy (`fetch` GET no-cors + `Image` favicon fallback) ensures accurate health detection across Cloudflare, strict CORS policies, and browser security restrictions.
- 5-minute `healthCache` backed by `sessionStorage` eliminates repetitive network traffic on scroll/refresh, bypassable via `.recheck-health-btn`.
- Synchronous `getCachedSiteHealth` check in card components renders status badges instantly without triggering `IntersectionObserver` on cached cards.
- Unified `getFilteredSites()` pipeline ensures Bookmarks and Dead tab counts match active query, tag, lowsec, and NSFW filters consistently.
- Multi-tier `probeImage` includes Google s2 favicon fallback to resolve live status for Cloudflare socket-closing domains (`animepahe.com`, `animepahe.org`).
- Enhanced edge health probe (`/api/health`) with `redirect: 'manual'` to capture HTTP 301/302 redirects (`animepahe.com` -> `animepahe.pw`), Cloudflare WAF responses (403/503), and Google S2 favicon fallbacks.
- Synthesized domain fallback (`https://${cleanKey}.com`) for active sites lacking `altlink` in upstream dataset (e.g., `anidbstream`, `anizone`), ensuring all live sites render mirror links.
- Prevented grid card text overflow by enforcing `min-width: 0`, `text-overflow: ellipsis`, `max-width: 100%`, and `overflow-wrap: anywhere` across `.site-card`, `.card-title`, `.tag-badge`, and `.mirror-button`. Shortened Quality & Safety filter chip labels (`No Ads`, `HD Quality`, `Fast Server`, `Low Security`).

## Blunders Log
- **Blunder**: `Boolean(item['ex-DEAD'])` coercing string `"0"` or `"false"` to `true`.
  - **Root Cause**: Non-empty string values evaluate as truthy in JavaScript, falsely marking active sites as dead/shutdown.
  - **Fix**: Created `isExplicitlyDead` helper to check string values explicitly (`!== '0'` and `!== 'false'`).
- **Blunder**: Truncating URL hash fragments in `parseLinks`.
  - **Root Cause**: `raw.split('#')` split URL hash fragments (`https://domain.com/path#anchor`) into separate array elements.
  - **Fix**: Updated `parseLinks` to split on `#` only when preceding a link definition (`label<<http` or `http://`).
- **Blunder**: Un-scoped `/` keyboard shortcut intercepting input typing.
  - **Root Cause**: Shortcut listener only checked `document.activeElement !== searchInput`.
  - **Fix**: Extended check to ignore keydown events when `activeElement` is `INPUT`, `TEXTAREA`, `SELECT`, or `isContentEditable`.
- **Blunder**: Dead tab count and Bookmarks ignoring active search and tag filters.
  - **Root Cause**: `updateCategoryBar` used separate raw array lengths instead of filtering pipeline.
  - **Fix**: Replaced inline array filters with single `getFilteredSites()` pipeline function.

## Structural Changes
- Squashed all iteration commits into one single clean commit on `main` (`0a4e185`).
- Removed all local static dataset files (`public/dataset.json` and `public/lowsec/*.json`) to eliminate redundancy and reduce build bundle size.
- Added Cloudflare Pages serverless proxy functions in `functions/api/dataset.ts` and `functions/api/lowsec.ts` for zero-CORS edge revalidation.
- Refactored Service Worker data caching to Network-First, timer cleanup in health probes, and URL tag deep linking.
- Upgraded Filter Drawer with 100% SVG vector icons and 3 categorized feature groups.
- Category navigation supports multi-select toggling with distinct SVG icons for all 18 categories.
- Restructured card header to grant site title 100% full width, preventing line wrapping.
- Deleted `mock_redesign.html` (1,033 lines) prototype file.
- Created `src/__tests__/pipeline.test.ts` to test filter pipeline (`getFilteredSites`).
- Added NSFW toggle state and `--radius-pill` design token to CSS design system.
- Shortened and ordered `Features & Access` filter chips to fit inline on a single row without wrapping.
- Removed redundant Bookmarks pill from category navigation bar in favor of top-right header bookmark toggle button.
