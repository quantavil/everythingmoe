import { IndexedSiteItem } from './search';
import { icons } from './icons';
import { escapeHtml, escapeUrl, getSiteDomain } from './ui';
import { getCachedSiteHealth, AllMirrorsCheckResult, MirrorStatusResult } from './health';

const GRADIENTS = [
  '#f59e0b, #b45309', '#10b981, #047857', '#d97706, #78350f',
  '#e11d48, #9f1239', '#8b5cf6, #5b21b6', '#0284c7, #0369a1', '#f97316, #c2410c'
];

export function getAvatarStyle(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % GRADIENTS.length;
  return `background: linear-gradient(135deg, ${GRADIENTS[idx]}); color: #fff; font-weight: 800;`;
}

export function renderSiteIcon(site: IndexedSiteItem): string {
  const cleanId = site.id.replace(/^lowsec_[^_]+_/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const primary = site.iconUrl || `https://static.everythingmoe.com/icons/${cleanId}.png`;
  const domain = getSiteDomain(site);
  const secondary = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : '';
  return `<img src="${escapeUrl(primary)}" alt="${escapeHtml(site.name)}" class="site-logo" data-site-name="${escapeHtml(site.name)}" data-fallback-icon="${escapeUrl(secondary)}" />`;
}

function renderStatusBadge(res: AllMirrorsCheckResult | null): string {
  if (!res) return `<span class="status-badge checking">${icons.activity(12)} CHECKING...</span>`;
  const isLive = res.liveCount > 0;
  const ping = res.bestPingMs ? ` (${res.bestPingMs}ms)` : '';
  return `<span class="status-badge ${isLive ? 'online' : 'offline'}" title="Estimated reachability based on network probe">${isLive ? icons.check(11) : icons.alert(11)} ${res.liveCount}/${res.totalCount} Up${ping}</span>`;
}

function renderStatusControl(site: IndexedSiteItem, cached: AllMirrorsCheckResult | null): string {
  if (site.isDead || !site.altlinks.length) return '';
  const json = escapeHtml(JSON.stringify(site.altlinks));
  return `
    <div class="status-wrapper">
      <div class="status-container" data-site-mirrors="${json}" ${cached ? 'data-status-cached="true"' : ''}>
        ${renderStatusBadge(cached)}
      </div>
      <button class="recheck-health-btn" title="Recheck status" aria-label="Recheck ${escapeHtml(site.name)}">
        ${icons.refresh(12)}
      </button>
    </div>
  `;
}

function renderDot(res?: MirrorStatusResult): string {
  if (!res) return '';
  if (res.status === 'redirected') {
    const target = res.redirectHost ? `<span class="mirror-redirect-label">➔ ${escapeHtml(res.redirectHost)}</span>` : '';
    return `<span class="mirror-dot redirected"></span>${target}`;
  }
  const ping = res.pingMs ? `<span class="mirror-ping-label">${res.pingMs}ms</span>` : '';
  return `<span class="mirror-dot ${res.status}"></span>${ping}`;
}

export function renderSkeletonCard(): string {
  return `
    <div class="skeleton-card">
      <div class="skeleton-header-flex">
        <div class="skeleton-avatar skeleton-box"></div>
        <div><div class="skeleton-badge-box skeleton-box"></div><div class="skeleton-title-box skeleton-box"></div></div>
      </div>
      <div class="skeleton-tag-row">
        <div class="skeleton-tag-pill skeleton-box"></div><div class="skeleton-tag-pill skeleton-box"></div><div class="skeleton-tag-pill skeleton-box"></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div class="skeleton-desc-line skeleton-box"></div><div class="skeleton-desc-short skeleton-box"></div>
      </div>
      <div class="skeleton-footer">
        <div class="skeleton-footer-btn skeleton-box"></div><div class="skeleton-footer-btn skeleton-box" style="width: 60px;"></div>
      </div>
    </div>
  `;
}

export function renderSkeletonState(appEl: HTMLElement, query: string, lowsec: boolean, theme: string) {
  appEl.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <a href="#" class="brand-title" id="logo-btn" aria-label="EverythingMoe 2.0 Home">
          <span class="brand-text-wrapper">
            <span class="brand-text">EVERYTHING<span class="brand-accent">MOE</span></span>
            <sup class="brand-badge-sup">2.0</sup>
          </span>
        </a>
        <div class="header-controls">
          <button class="btn btn-icon ${lowsec ? 'btn-primary' : ''}" id="lowsec-toggle-btn" title="Toggle Low-Ranked Sites" aria-label="Toggle Low-Ranked Sites">${lowsec ? icons.shieldAlert(18) : icons.alert(18)}</button>
          <button class="btn btn-icon" id="theme-toggle-btn" title="Toggle Theme" aria-label="Toggle Theme">${theme === 'dark' ? icons.sun(18) : icons.moon(18)}</button>
          <button class="btn btn-icon" id="favorites-tab-btn" title="Bookmarks (0)" aria-label="Bookmarks (0)">${icons.star(18, false)}</button>
        </div>
      </div>
    </header>
    <div class="hero-wrapper">
      <div class="search-box-container">
        <span class="search-icon-left">${icons.search(20)}</span>
        <input type="text" id="search-input" class="search-field" placeholder="Search 1,200+ main & low-ranked sites, softsubs, apps..." value="${escapeHtml(query)}" autocomplete="off" />
        <div class="search-actions-right">
          <button class="filter-toggle-btn" id="filter-toggle-btn" title="Toggle Feature Filters">
            ${icons.filter(14)} <span>Filter</span>
          </button>
          <div class="search-kbd-shortcut">${icons.command(12)} <span>/</span></div>
        </div>
      </div>
      <div class="filter-drawer" id="filter-drawer"></div>
      <div class="search-meta-bar search-meta-center" id="search-meta-bar"><span class="search-counter">⚡ Initializing 1,200+ Otaku Resources...</span></div>
    </div>
    <nav class="category-bar" id="category-bar">${Array(8).fill(0).map(() => `<div class="cat-pill skeleton-box" style="width: 110px; height: 34px;"></div>`).join('')}</nav>
    <main class="main-wrapper" id="content-container"><div class="site-grid">${Array(9).fill(0).map(() => renderSkeletonCard()).join('')}</div></main>
  `;
}

export function getSectionIcon(sectionId: string, size = 14): string {
  switch (sectionId) {
    case 'anime': return icons.tv(size);
    case 'manga': return icons.book(size);
    case 'manhwa': return icons.layers(size);
    case 'novel': return icons.feather(size);
    case 'donghua': return icons.film(size);
    case 'apps': return icons.smartphone(size);
    case 'download': return icons.download(size);
    case 'music': return icons.music(size);
    case 'schedule': return icons.calendar(size);
    case 'tracker': return icons.database(size);
    case 'utils': return icons.wrench(size);
    case 'wiki': return icons.bookOpen(size);
    case 'artboard': return icons.image(size);
    case 'vtuber': return icons.sparkles(size);
    case 'forums': return icons.users(size);
    case 'drama': return icons.video(size);
    case 'hentai': return icons.flame(size);
    case 'hentairead': return icons.shieldLock(size);
    case 'dead': return icons.skull(size);
    default: return icons.tv(size);
  }
}

export function renderGridCard(site: IndexedSiteItem, isBookmarked: boolean, index = 0): string {
  const cached = getCachedSiteHealth(site.altlinks);
  const pos = site.positive.slice(0, 4).map(p => `<span class="tag-badge positive">${icons.check(11)} ${escapeHtml(p)}</span>`).join('');
  const neg = site.negative.slice(0, 3).map(n => `<span class="tag-badge negative">${icons.alert(11)} ${escapeHtml(n)}</span>`).join('');
  const mirrors = site.altlinks.map((alt, idx) => {
    const mRes = cached?.mirrors.find(m => m.url === alt.url);
    const isOffline = mRes && mRes.status === 'offline';
    const isRedirected = mRes && mRes.status === 'redirected';
    const titleAttr = isRedirected && mRes.redirectHost ? `title="Redirects to ${escapeHtml(mRes.redirectHost)}"` : '';
    return `<a href="${escapeUrl(alt.url)}" target="_blank" rel="noopener noreferrer" class="mirror-button ${idx === 0 ? 'primary-mirror' : ''} ${isOffline ? 'mirror-offline' : ''} ${isRedirected ? 'mirror-redirected' : ''}" ${titleAttr}>${idx === 0 ? icons.externalLink(12) : ''} ${escapeHtml(alt.label || 'Link')} ${renderDot(mRes)}</a>`;
  }).join('');

  return `
    <article class="site-card ${site.isDead ? 'dead-card' : ''} ${site.isLowSec ? 'lowsec-card' : ''}" data-site-id="${escapeHtml(site.id)}" style="--i:${Math.min(index, 12)}">
      <div class="card-inner">
        <div class="card-top">
          <div class="card-meta-row">
            <div class="card-category-row">
              <span class="card-category-label">${escapeHtml(site.categoryName)}</span>
              ${site.isDead ? `<span class="dead-badge">${icons.skull(12)} SHUTDOWN</span>` : ''}
            </div>
            <div class="card-actions-top">
              ${renderStatusControl(site, cached)}
              <button class="bookmark-action-btn ${isBookmarked ? 'active' : ''}" data-fav-id="${escapeHtml(site.id)}" title="${isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}" aria-label="${isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}">${icons.star(18, isBookmarked)}</button>
            </div>
          </div>
          <div class="site-title-inline">
            ${renderSiteIcon(site)}
            <h3 class="card-title">${escapeHtml(site.name)}</h3>
          </div>
        </div>
        ${pos || neg ? `
          <div class="tags-wrapper">
            ${pos ? `<div class="tag-cluster positive-cluster">${pos}</div>` : ''}
            ${neg ? `<div class="tag-cluster negative-cluster">${neg}</div>` : ''}
          </div>
        ` : ''}
        ${site.info ? `<p class="card-info-description">${escapeHtml(site.info)}</p>` : ''}
        <div class="mirrors-footer"><div class="mirrors-list">${mirrors}</div></div>
      </div>
    </article>
  `;
}

