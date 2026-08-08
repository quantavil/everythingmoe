# 🚀 EverythingMoe 2.0 - Ultimate Otaku Resource Directory

> An ultra-fast, zero-bloat, 100% type-safe catalog indexing **1,200+ main & lower-security sites** across **18 categories**, featuring **Cloudflare Pages edge proxy functions**, **PWA Network-First offline caching**, **per-mirror live status checking**, **ping latency measurement**, **interactive health rechecking**, **Editorial Luxury Grid UI**, and **zero-dependency search**.

---

## 🌐 Cloudflare Edge & Data Pipeline

1. **Main Catalog API (`/api/dataset`)**:
   - Cloudflare Pages Function ([functions/api/dataset.ts](file:///home/quantavil/Documents/Project/everythingmoe/functions/api/dataset.ts)) proxies upstream data from `everythingmoe.com`, caching responses at Cloudflare Edge CDN for 10 minutes (`s-maxage=600`) with remote fallback.
   - Indexes 914+ top-ranked sites across 18 categories, positive/negative tags, descriptions, domains, and mirror links (`altlink`, `ex-altlink`).
2. **Low-Security Sub-Indexes API (`/api/lowsec?sec={category}`)**:
   - Cloudflare Pages Function ([functions/api/lowsec.ts](file:///home/quantavil/Documents/Project/everythingmoe/functions/api/lowsec.ts)) lazily loads category sub-indexes (`anime`, `manga`, `manhwa`, `novel`, `donghua`, `apps`, `download`, `music`, `schedule`, `tracker`, `utils`, `wiki`, `artboard`, `vtuber`, `forums`, `drama`, `hentai`, `hentairead`).
   - Header toggle button (`Low-Ranked Sites`) dynamically enables or hides lower-security/unverified site listings.
3. **PWA Service Worker Offline Cache**:
   - Network-First caching strategy ([public/sw.js](file:///home/quantavil/Documents/Project/everythingmoe/public/sw.js)) automatically revalidates live API JSON on page loads while providing 100% offline access when disconnected.

---

## ⚡ Tech Stack & Modular Architecture

- **Runtime & Package Manager**: Bun (`v1.3.14`)
- **Language**: TypeScript (`v5.7.0` - 100% type-safe)
- **Bundler & Dev Server**: Vite (`v6.0.0` - ultra-fast HMR builds)
- **Search Engine**: Pre-indexed zero-dependency multi-term relevance search engine (`0.1ms` execution time)
- **Modular Architecture**:
  - `functions/api/dataset.ts`: Cloudflare Pages Edge proxy for the main site dataset.
  - `functions/api/lowsec.ts`: Cloudflare Pages Edge proxy for low-ranked category bundles.
  - `src/main.ts`: Entry point orchestrating search debouncing, category tabs, filter drawer, URL deep linking, and `IntersectionObserver` status checks.
  - `src/components.ts`: Editorial Luxury grid card (`renderGridCard`), skeleton loading templates, site icons, and avatar generators.
  - `src/health.ts`: 5-minute health status cache (`healthCache`), 2,500-entry capacity, `fetch()` GET probes with fallback favicon probes, and 5-worker concurrency queue (`checkAllMirrorsHealth`).
  - `src/ui.ts`: String escaping, URL protocol sanitization, domain extraction, and toast notifications.
  - `src/data.ts`: Multi-tier dataset fetching (`/api/` -> remote origin fallback), fragment-safe link parsing, `isExplicitlyDead` detection, and category mappings.
  - `src/search.ts`: High-performance multi-term search indexer.
  - `src/store.ts`: Favorites storage, theme preferences, lowsec toggle state, and URL query parameter deep linking (`tags`, `section`, `q`, `lowsec`).
- **Styling**: Modern Vanilla CSS (`@layer`) with Editorial Luxury dark/light mode tokens and Google Fonts typography.

---

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh) (`v1.3+`)

### Installation & Local Development

```bash
# Install dependencies
bun install

# Start local dev server
bun run dev

# Run unit tests
bun test

# Type check & lint
bun run check
bun run lint
```

Visit `http://localhost:5173/` in your browser.

### Production Build

```bash
# Type check and build production bundle
bun run build
```

---

## 🎯 Key Features

- **🎨 Editorial Luxury Grid Design**: Warm Studio dark obsidian palette with parchment typography, radial gradient mesh ambiance, and double-bezel card styling.
- **🟢 Per-Mirror Live Status & Card Header Summary**: Cards display real-time mirror health summaries (e.g. `🟢 3/4 Live (38ms)`). Every individual mirror pill button displays its own live status dot (`🟢` or `🔴`) and ping latency.
- **🔄 Interactive Health Refresh Button**: Click the refresh button (`recheck-health-btn`) on any card to spin the refresh icon, bypass the 5-minute cache, and re-test all mirror links in real time.
- **🛡️ Dual Probe Reliability (`fetch` + `Image` Favicon Fallback)**: Uses `fetch()` GET probes combined with `Image` favicon asset pings to ensure accurate health detection across Cloudflare CDNs and strict CORS policies.
- **💀 Dead / Offline Site Separation**: Active sites are displayed under **All Sites**, while dead/discontinued sites are separated into a dedicated `💀 Dead / Offline` category tab.
- **⚡ 0.1ms Client-Side Search**: Multi-term relevance search over site titles, categories, positive/negative features, and mirror URLs.
- **🖼️ Multi-Tier PNG & Avatar Icons**: Official site PNG icons with domain favicon fallbacks and dynamic gradient letter avatar badges on 404s.
- **⚠️ Low-Ranked Sites Toggle**: Instantly view or hide lower-ranked/low-security listings.
- **📌 Bookmarking & Favorites**: Save preferred resources to local storage with real-time cross-tab sync and corrupt data auto-recovery.
- **🔗 Comprehensive URL Deep Linking**: Automatically sync search queries, category selections, feature filter chips (`tags`), and lowsec state to URL parameters.
- **📄 MIT Licensed**: Open source software licensed under the MIT License.
