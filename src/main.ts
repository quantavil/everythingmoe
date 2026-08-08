import { fetchEverythingMoeData, fetchLowSecForSection, fetchAllLowSec } from './data';
import { indexSites, searchSites, IndexedSiteItem } from './search';
import { getBookmarks, toggleBookmark, getSavedTheme, setSavedTheme, getSavedLowSec, setSavedLowSec, getUrlParams, syncUrlParams } from './store';
import { SectionMeta, MirrorLink } from './types';
import { icons } from './icons';
import { checkAllMirrorsHealth, AllMirrorsCheckResult } from './health';
import { escapeHtml, showToast, debounce } from './ui';
import { getAvatarStyle, renderGridCard, renderSkeletonState, getSectionIcon } from './components';

const ITEMS_PER_PAGE = 36;

let allSites: IndexedSiteItem[] = [];
let allSections: SectionMeta[] = [];
let displayedItemCount = ITEMS_PER_PAGE;
const loadedLowSec = new Set<string>();
const inFlightLowSec = new Set<string>();

const params = getUrlParams();
let activeSectionId = params.section || 'all';
const selectedCategoryIds = new Set<string>();
if (params.section && !['all', 'favorites', 'dead'].includes(params.section)) {
  if (params.section.includes(',')) {
    params.section.split(',').forEach(s => selectedCategoryIds.add(s));
  } else {
    selectedCategoryIds.add(params.section);
  }
  activeSectionId = 'category';
}

let searchQuery = params.query || '';
let showLowSec = params.lowsec !== null ? params.lowsec : getSavedLowSec();
const activeTagFilters = new Set<string>(params.tags || []);
let isFilterDrawerOpen = false;

export function matchesTagFilters(site: IndexedSiteItem, activeTagFilters: Set<string>): boolean {
  if (activeTagFilters.size === 0) return true;
  const posText = site.positive.join(' ').toLowerCase();
  const infoText = site.info.toLowerCase();
  const combined = `${posText} ${infoText} ${site.name.toLowerCase()}`;
  return Array.from(activeTagFilters).every(tag => {
    if (tag === 'softsubs') return combined.includes('soft');
    if (tag === 'hardsubs') return combined.includes('hard');
    if (tag === 'dub') return combined.includes('dub');
    if (tag === 'no-ads') return combined.includes('no ad') || combined.includes('clean') || !site.negative.some(n => n.toLowerCase().includes('ad'));
    if (tag === 'high-quality') return combined.includes('quality') || combined.includes('1080p') || combined.includes('hd') || combined.includes('4k');
    if (tag === 'direct') return combined.includes('direct') || combined.includes('stream') || combined.includes('fast');
    if (tag === 'large-library') return combined.includes('library') || combined.includes('large');
    if (tag === 'app') return combined.includes('app') || combined.includes('mihon') || combined.includes('tachiyomi') || site.section === 'apps';
    if (tag === 'download') return combined.includes('download') || combined.includes('torrent') || combined.includes('ddl') || site.section === 'download';
    if (tag === 'player') return combined.includes('player') || combined.includes('reader') || combined.includes('interface');
    return combined.includes(tag);
  });
}

const FILTER_GROUPS = [
  {
    title: 'Subtitles & Audio',
    filters: [
      { id: 'softsubs', label: 'Softsubs', icon: () => icons.messageSquare(13) },
      { id: 'hardsubs', label: 'Hardsubs', icon: () => icons.fileText(13) },
      { id: 'dub', label: 'English Dub', icon: () => icons.mic(13) }
    ]
  },
  {
    title: 'Quality & Safety',
    filters: [
      { id: 'no-ads', label: 'Clean / No Ads', icon: () => icons.shieldCheck(13) },
      { id: 'high-quality', label: 'High Quality', icon: () => icons.sparkles(13) },
      { id: 'direct', label: 'Fast / Low Latency', icon: () => icons.zap(13) }
    ]
  },
  {
    title: 'Features & Access',
    filters: [
      { id: 'large-library', label: 'Large Library', icon: () => icons.library(13) },
      { id: 'app', label: 'Mihon / Mobile App', icon: () => icons.smartphone(13) },
      { id: 'download', label: 'Downloads / Torrents', icon: () => icons.download(13) },
      { id: 'player', label: 'Custom Reader/Player', icon: () => icons.playCircle(13) }
    ]
  }
];

const appEl = document.getElementById('app')!;

const debouncedSyncUrl = debounce((q: string, sec: string, lowsec: boolean, tags: Set<string>) => {
  syncUrlParams(q, sec, lowsec, tags);
}, 300);

async function ensureLowSecLoaded(secId: string) {
  if (!showLowSec) return;
  const isGlobal = secId === 'all' || secId === 'dead' || secId === 'favorites';
  const targetKey = isGlobal ? '__all__' : secId;
  if (loadedLowSec.has(targetKey) || loadedLowSec.has('__all__') || inFlightLowSec.has(targetKey)) return;

  inFlightLowSec.add(targetKey);
  try {
    const raw = isGlobal ? await fetchAllLowSec() : await fetchLowSecForSection(secId);
    loadedLowSec.add(targetKey);
    const newItems = indexSites(raw);

    if (newItems.length) {
      const existing = new Set(allSites.map(s => s.id));
      const unique = newItems.filter(s => !existing.has(s.id));
      if (unique.length) {
        allSites = [...allSites, ...unique];
        updateCategoryBar();
        renderFilteredContent();
      }
    }
  } finally {
    inFlightLowSec.delete(targetKey);
  }
}

function updateFilterDrawer() {
  const drawer = document.getElementById('filter-drawer');
  const toggleBtn = document.getElementById('filter-toggle-btn');
  if (!drawer || !toggleBtn) return;

  drawer.className = `filter-drawer ${isFilterDrawerOpen ? 'open' : ''}`;
  toggleBtn.className = `filter-toggle-btn ${activeTagFilters.size > 0 ? 'active' : ''}`;
  toggleBtn.innerHTML = `${icons.filter(14)} <span>Filter</span> ${activeTagFilters.size > 0 ? `<span class="filter-count-badge">${activeTagFilters.size}</span>` : ''}`;

  drawer.innerHTML = `
    ${FILTER_GROUPS.map(group => `
      <div class="filter-group-row">
        <span class="filter-group-title">${escapeHtml(group.title)}:</span>
        <div class="filter-group-chips">
          ${group.filters.map(f => `
            <button class="filter-chip ${activeTagFilters.has(f.id) ? 'active' : ''}" data-filter="${f.id}">
              ${f.icon()} ${escapeHtml(f.label)}
            </button>
          `).join('')}
        </div>
      </div>
    `).join('')}
    ${activeTagFilters.size > 0 ? `<div class="filter-drawer-footer"><button class="filter-chip-clear" id="clear-filters-btn">Clear All Filters (${activeTagFilters.size})</button></div>` : ''}
  `;

  drawer.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const filterId = chip.getAttribute('data-filter');
      if (filterId) {
        if (activeTagFilters.has(filterId)) activeTagFilters.delete(filterId);
        else activeTagFilters.add(filterId);
        displayedItemCount = ITEMS_PER_PAGE;
        updateFilterDrawer();
        updateCategoryBar();
        renderFilteredContent();
        const urlSec = selectedCategoryIds.size === 1 ? Array.from(selectedCategoryIds)[0] : (selectedCategoryIds.size > 1 ? Array.from(selectedCategoryIds).join(',') : activeSectionId);
        debouncedSyncUrl(searchQuery, urlSec, showLowSec, activeTagFilters);
      }
    });
  });

  document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
    activeTagFilters.clear();
    displayedItemCount = ITEMS_PER_PAGE;
    updateFilterDrawer();
    updateCategoryBar();
    renderFilteredContent();
    const urlSec = selectedCategoryIds.size === 1 ? Array.from(selectedCategoryIds)[0] : (selectedCategoryIds.size > 1 ? Array.from(selectedCategoryIds).join(',') : activeSectionId);
    debouncedSyncUrl(searchQuery, urlSec, showLowSec, activeTagFilters);
  });
}

function buildShellHTML() {
  const theme = getSavedTheme();
  const bookmarks = getBookmarks();

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
          <button class="btn btn-icon ${showLowSec ? 'btn-primary' : ''}" id="lowsec-toggle-btn" title="${showLowSec ? 'Low-Ranked Sites Enabled (Click to hide)' : 'Low-Ranked Sites Disabled (Click to show)'}" aria-label="Toggle Low-Ranked Sites">
            ${showLowSec ? icons.shieldAlert(18) : icons.alert(18)}
          </button>
          <button class="btn btn-icon" id="theme-toggle-btn" title="Toggle Theme" aria-label="Toggle Theme">${theme === 'dark' ? icons.sun(18) : icons.moon(18)}</button>
          <button class="btn btn-icon ${activeSectionId === 'favorites' ? 'btn-primary' : ''}" id="favorites-tab-btn" title="Bookmarks (${bookmarks.length})" aria-label="Bookmarks (${bookmarks.length})">
            ${icons.star(18, activeSectionId === 'favorites')}
            ${bookmarks.length > 0 ? `<span class="btn-badge">${bookmarks.length}</span>` : ''}
          </button>
        </div>
      </div>
    </header>
    <div class="hero-wrapper">
      <div class="search-box-container">
        <span class="search-icon-left">${icons.search(20)}</span>
        <input type="text" id="search-input" class="search-field" placeholder="Search 1,200+ main & low-ranked sites, softsubs, apps..." value="${escapeHtml(searchQuery)}" autocomplete="off" />
        <div class="search-actions-right">
          <button class="filter-toggle-btn ${activeTagFilters.size > 0 ? 'active' : ''}" id="filter-toggle-btn" title="Toggle Feature Filters">
            ${icons.filter(14)} <span>Filter</span> ${activeTagFilters.size > 0 ? `<span class="filter-count-badge">${activeTagFilters.size}</span>` : ''}
          </button>
          <div class="search-kbd-shortcut">${icons.command(12)} <span>/</span></div>
        </div>
      </div>
      <div class="filter-drawer ${isFilterDrawerOpen ? 'open' : ''}" id="filter-drawer"></div>
      <div class="search-meta-bar" id="search-meta-bar"></div>
    </div>
    <nav class="category-bar" id="category-bar"></nav>
    <main class="main-wrapper" id="content-container"></main>
  `;

  attachStaticEventListeners();
  updateFilterDrawer();
}

function updateCategoryBar() {
  const categoryBar = document.getElementById('category-bar');
  if (!categoryBar) return;

  const bookmarkCount = getBookmarks().length;
  const activeSites = allSites.filter(s => !s.isDead);
  const deadSites = allSites.filter(s => s.isDead);

  let candidateSites = showLowSec ? activeSites : activeSites.filter(s => !s.isLowSec);
  if (activeTagFilters.size > 0) {
    candidateSites = candidateSites.filter(site => matchesTagFilters(site, activeTagFilters));
  }

  const searchFiltered = searchQuery.trim() ? searchSites(searchQuery, candidateSites) : candidateSites;

  const categoryCounts: Record<string, number> = {};
  searchFiltered.forEach(s => {
    categoryCounts[s.section] = (categoryCounts[s.section] || 0) + 1;
  });

  const isAllActive = activeSectionId === 'all' || (activeSectionId === 'category' && selectedCategoryIds.size === 0);

  categoryBar.innerHTML = `
    <button class="cat-pill ${isAllActive ? 'active' : ''}" data-section="all">All Sites <span class="cat-pill-count">${searchFiltered.length}</span></button>
    <button class="cat-pill ${activeSectionId === 'favorites' ? 'active' : ''}" data-section="favorites">${icons.star(14, activeSectionId === 'favorites')} Bookmarks <span class="cat-pill-count">${bookmarkCount}</span></button>
    ${allSections.map(sec => `
      <button class="cat-pill ${selectedCategoryIds.has(sec.id) ? 'active' : ''}" data-section="${sec.id}">${getSectionIcon(sec.id, 14)} ${escapeHtml(sec.title)} <span class="cat-pill-count">${categoryCounts[sec.id] || 0}</span></button>
    `).join('')}
    <button class="cat-pill ${activeSectionId === 'dead' ? 'active' : ''}" data-section="dead">${getSectionIcon('dead', 14)} Dead / Offline <span class="cat-pill-count">${deadSites.length}</span></button>
  `;

  categoryBar.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const mouseEvt = e as MouseEvent;
      const section = btn.getAttribute('data-section');
      if (section) {
        if (section === 'all') {
          activeSectionId = 'all';
          selectedCategoryIds.clear();
        } else if (section === 'favorites' || section === 'dead') {
          activeSectionId = section;
          selectedCategoryIds.clear();
        } else {
          const isMultiToggle = mouseEvt.ctrlKey || mouseEvt.metaKey || mouseEvt.shiftKey || (activeSectionId === 'category' && selectedCategoryIds.size > 1);
          if (isMultiToggle) {
            activeSectionId = 'category';
            if (selectedCategoryIds.has(section)) {
              selectedCategoryIds.delete(section);
            } else {
              selectedCategoryIds.add(section);
            }
            if (selectedCategoryIds.size === 0) activeSectionId = 'all';
          } else {
            if (selectedCategoryIds.has(section) && selectedCategoryIds.size === 1) {
              activeSectionId = 'all';
              selectedCategoryIds.clear();
            } else {
              activeSectionId = 'category';
              selectedCategoryIds.clear();
              selectedCategoryIds.add(section);
            }
          }
        }
        displayedItemCount = ITEMS_PER_PAGE;
        updateHeaderButtons();
        updateCategoryBar();
        renderFilteredContent();
        if (section !== 'all' && section !== 'favorites' && section !== 'dead') {
          ensureLowSecLoaded(section);
        }
        const urlSec = selectedCategoryIds.size === 1 ? Array.from(selectedCategoryIds)[0] : (selectedCategoryIds.size > 1 ? Array.from(selectedCategoryIds).join(',') : activeSectionId);
        debouncedSyncUrl(searchQuery, urlSec, showLowSec, activeTagFilters);
      }
    });
  });
}

function updateHeaderButtons() {
  const lowsecBtn = document.getElementById('lowsec-toggle-btn');
  if (lowsecBtn) {
    lowsecBtn.className = `btn btn-icon ${showLowSec ? 'btn-primary' : ''}`;
    lowsecBtn.setAttribute('title', showLowSec ? 'Low-Ranked Sites Enabled (Click to hide)' : 'Low-Ranked Sites Disabled (Click to show)');
    lowsecBtn.innerHTML = showLowSec ? icons.shieldAlert(18) : icons.alert(18);
  }

  const favsBtn = document.getElementById('favorites-tab-btn');
  const favs = getBookmarks();
  if (favsBtn) {
    favsBtn.className = `btn btn-icon ${activeSectionId === 'favorites' ? 'btn-primary' : ''}`;
    favsBtn.setAttribute('title', `Bookmarks (${favs.length})`);
    favsBtn.innerHTML = `${icons.star(18, activeSectionId === 'favorites')}${favs.length > 0 ? `<span class="btn-badge">${favs.length}</span>` : ''}`;
  }

  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.setAttribute('title', `Toggle Theme (${getSavedTheme()})`);
    themeBtn.innerHTML = getSavedTheme() === 'dark' ? icons.sun(18) : icons.moon(18);
  }
}

function renderFilteredContent() {
  const contentContainer = document.getElementById('content-container');
  const metaBar = document.getElementById('search-meta-bar');
  if (!contentContainer || !metaBar) return;

  const bookmarks = getBookmarks();
  const activeSites = allSites.filter(s => !s.isDead);
  let sites: IndexedSiteItem[];

  if (activeSectionId === 'all' || (activeSectionId === 'category' && selectedCategoryIds.size === 0)) {
    sites = activeSites;
  } else if (activeSectionId === 'dead') {
    sites = allSites.filter(s => s.isDead);
  } else if (activeSectionId === 'favorites') {
    sites = activeSites.filter(s => bookmarks.includes(s.id));
  } else {
    sites = activeSites.filter(s => selectedCategoryIds.has(s.section));
  }

  if (!showLowSec) sites = sites.filter(s => !s.isLowSec);

  if (activeTagFilters.size > 0) {
    sites = sites.filter(site => matchesTagFilters(site, activeTagFilters));
  }

  if (searchQuery.trim()) sites = searchSites(searchQuery, sites);

  const total = sites.length;
  const visible = sites.slice(0, displayedItemCount);

  metaBar.innerHTML = searchQuery.trim()
    ? `<span class="search-counter">Found <strong class="highlight-cyan">${total}</strong> matches across <strong class="highlight-cyan">${activeSites.length}</strong> indexed resources</span>`
    : `<span class="search-counter">Indexed <strong class="highlight-cyan">${activeSites.length}</strong> resources across <strong class="highlight-cyan">${allSections.length}</strong> categories</span>`;

  if (!total) {
    contentContainer.innerHTML = `<div class="empty-state"><div class="empty-title">No resources found</div><div class="empty-desc">${searchQuery.trim() ? `No sites matched "${escapeHtml(searchQuery)}".` : 'No sites available.'}</div></div>`;
    return;
  }

  const loadMoreHTML = total > displayedItemCount
    ? `<div style="text-align: center; margin-block-start: 28px;"><button class="btn btn-primary" id="load-more-btn" style="padding: 12px 28px; font-size: 14px;">Load More (${total - displayedItemCount} remaining)</button></div>`
    : '';

  contentContainer.innerHTML = `
    <div class="site-grid">${visible.map((site, idx) => renderGridCard(site, bookmarks.includes(site.id), idx)).join('')}</div>
    ${loadMoreHTML}
  `;

  document.getElementById('load-more-btn')?.addEventListener('click', () => {
    displayedItemCount += ITEMS_PER_PAGE;
    renderFilteredContent();
  });

  attachDynamicCardListeners();
}

function attachStaticEventListeners() {
  const filterToggleBtn = document.getElementById('filter-toggle-btn');
  filterToggleBtn?.addEventListener('click', () => {
    isFilterDrawerOpen = !isFilterDrawerOpen;
    updateFilterDrawer();
  });

  const logoBtn = document.getElementById('logo-btn');
  logoBtn?.addEventListener('click', e => {
    e.preventDefault();
    activeSectionId = 'all';
    selectedCategoryIds.clear();
    searchQuery = '';
    const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    displayedItemCount = ITEMS_PER_PAGE;
    updateHeaderButtons();
    updateCategoryBar();
    renderFilteredContent();
    syncUrlParams('', 'all', showLowSec);
  });

  const lowsecBtn = document.getElementById('lowsec-toggle-btn');
  lowsecBtn?.addEventListener('click', () => {
    showLowSec = !showLowSec;
    setSavedLowSec(showLowSec);
    updateHeaderButtons();
    updateCategoryBar();
    renderFilteredContent();
    const urlSec = selectedCategoryIds.size === 1 ? Array.from(selectedCategoryIds)[0] : (selectedCategoryIds.size > 1 ? Array.from(selectedCategoryIds).join(',') : activeSectionId);
    debouncedSyncUrl(searchQuery, urlSec, showLowSec, activeTagFilters);
    if (showLowSec) ensureLowSecLoaded('all');
  });

  const themeBtn = document.getElementById('theme-toggle-btn');
  themeBtn?.addEventListener('click', () => {
    const current = getSavedTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setSavedTheme(next);
    updateHeaderButtons();
    updateCategoryBar();
    showToast(`Switched to ${next} mode`);
  });

  const favsHeaderBtn = document.getElementById('favorites-tab-btn');
  favsHeaderBtn?.addEventListener('click', () => {
    activeSectionId = 'favorites';
    selectedCategoryIds.clear();
    displayedItemCount = ITEMS_PER_PAGE;
    updateHeaderButtons();
    updateCategoryBar();
    renderFilteredContent();
    debouncedSyncUrl(searchQuery, 'favorites', showLowSec, activeTagFilters);
  });

  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value;
    displayedItemCount = ITEMS_PER_PAGE;
    updateCategoryBar();
    renderFilteredContent();
    const urlSec = selectedCategoryIds.size === 1 ? Array.from(selectedCategoryIds)[0] : (selectedCategoryIds.size > 1 ? Array.from(selectedCategoryIds).join(',') : activeSectionId);
    debouncedSyncUrl(searchQuery, urlSec, showLowSec, activeTagFilters);
  });

  const contentContainer = document.getElementById('content-container');
  if (contentContainer) {
    contentContainer.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const bookmarkBtn = target.closest('.bookmark-action-btn');
      if (bookmarkBtn) {
        e.stopPropagation();
        const siteId = bookmarkBtn.getAttribute('data-fav-id');
        if (siteId) {
          const isNowBookmarked = toggleBookmark(siteId);
          showToast(isNowBookmarked ? 'Added to Bookmarks' : 'Removed from Bookmarks');
          updateHeaderButtons();
          updateCategoryBar();

          const headerFavBtn = document.getElementById('favorites-tab-btn');
          if (headerFavBtn) {
            headerFavBtn.classList.add('animate-pop');
            setTimeout(() => headerFavBtn.classList.remove('animate-pop'), 350);
          }

          if (activeSectionId === 'favorites') renderFilteredContent();
          else {
            document.querySelectorAll(`.bookmark-action-btn[data-fav-id="${siteId}"]`).forEach(b => {
              b.classList.toggle('active', isNowBookmarked);
              b.innerHTML = icons.star(18, isNowBookmarked);
              b.classList.add('animate-pop');
              setTimeout(() => b.classList.remove('animate-pop'), 350);
            });
          }
        }
        return;
      }

      const recheckBtn = target.closest('.recheck-health-btn');
      if (recheckBtn) {
        e.stopPropagation();
        const wrapper = recheckBtn.closest('.status-wrapper');
        const container = wrapper?.querySelector('.status-container') as HTMLElement | null;
        const rawMirrors = container?.getAttribute('data-site-mirrors');
        if (!container || !rawMirrors) return;

        recheckBtn.classList.add('spinning');
        container.innerHTML = `<span class="status-badge checking">${icons.activity(12)} RECHECKING...</span>`;

        try {
          const mirrors: MirrorLink[] = JSON.parse(rawMirrors);
          checkAllMirrorsHealth(mirrors, true).then(res => {
            recheckBtn.classList.remove('spinning');
            applyHealthResultsToCard(container, res);
            showToast('Health rechecked for all mirrors');
          });
        } catch {
          recheckBtn.classList.remove('spinning');
        }
      }
    });

    contentContainer.addEventListener('error', e => {
      const img = e.target as HTMLImageElement | null;
      if (!img || (!img.classList.contains('site-logo') && !img.classList.contains('site-logo-sm'))) return;

      const fallbackIcon = img.getAttribute('data-fallback-icon');
      if (fallbackIcon && img.src !== fallbackIcon) {
        img.removeAttribute('data-fallback-icon');
        img.src = fallbackIcon;
        return;
      }

      const name = img.getAttribute('data-site-name') || 'M';
      const isSmall = img.getAttribute('data-is-small') === 'true';
      const avatarEl = document.createElement('div');
      avatarEl.className = isSmall ? 'site-logo-avatar-sm' : 'site-logo-avatar';
      avatarEl.style.cssText = getAvatarStyle(name);
      avatarEl.textContent = name.charAt(0).toUpperCase();
      img.replaceWith(avatarEl);
    }, true);
  }

  window.addEventListener('keydown', e => {
    const isEditable = document.activeElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || (document.activeElement as HTMLElement).isContentEditable);
    if (e.key === '/' && !isEditable) {
      e.preventDefault(); searchInput?.focus(); searchInput?.select();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault(); searchInput?.focus(); searchInput?.select();
    } else if (e.key === 'Escape' && document.activeElement === searchInput) {
      if (searchQuery.length > 0) {
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        renderFilteredContent();
        syncUrlParams('', activeSectionId, showLowSec);
      } else {
        searchInput?.blur();
      }
    }
  });

  window.addEventListener('storage', e => {
    if (e.key === 'everythingmoe_favorites_v2') {
      updateHeaderButtons(); updateCategoryBar(); renderFilteredContent();
    }
  });
}

function applyHealthResultsToCard(container: HTMLElement, res: AllMirrorsCheckResult) {
  const cardEl = container.closest('article, .table-row');
  const isLive = res.liveCount > 0;
  const pingText = res.bestPingMs ? ` (${res.bestPingMs}ms)` : '';

  container.innerHTML = `<span class="status-badge ${isLive ? 'online' : 'offline'}">${isLive ? icons.check(11) : icons.alert(11)} ${res.liveCount}/${res.totalCount} Live${pingText}</span>`;

  if (cardEl) {
    const mirrorBtns = cardEl.querySelectorAll('.mirror-button, .mirror-button-sm');
    res.mirrors.forEach((mResult, mIdx) => {
      const btn = mirrorBtns[mIdx] as HTMLAnchorElement | undefined;
      if (!btn) return;

      btn.querySelectorAll('.mirror-dot, .mirror-ping-label').forEach(el => el.remove());
      btn.classList.remove('mirror-offline');

      if (mResult.status === 'online') {
        const dot = document.createElement('span');
        dot.className = 'mirror-dot online';
        btn.appendChild(dot);
        if (mResult.pingMs) {
          const pingSpan = document.createElement('span');
          pingSpan.className = 'mirror-ping-label';
          pingSpan.textContent = `${mResult.pingMs}ms`;
          btn.appendChild(pingSpan);
        }
      } else {
        btn.classList.add('mirror-offline');
        const dot = document.createElement('span');
        dot.className = 'mirror-dot offline';
        btn.appendChild(dot);
      }
    });
  }
}

let activeStatusObserver: IntersectionObserver | null = null;

function getStatusObserver() {
  if (!activeStatusObserver) {
    activeStatusObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const container = entry.target as HTMLElement;
          observer.unobserve(container);
          const rawMirrors = container.getAttribute('data-site-mirrors');
          if (!rawMirrors) return;

          try {
            const mirrors: MirrorLink[] = JSON.parse(rawMirrors);
            checkAllMirrorsHealth(mirrors).then(res => applyHealthResultsToCard(container, res));
          } catch {}
        }
      });
    }, { rootMargin: '100px 0px', threshold: 0.1 });
  }
  return activeStatusObserver;
}

function attachDynamicCardListeners() {
  const observer = getStatusObserver();
  document.querySelectorAll('.status-container:not([data-status-cached="true"]):not([data-observed="true"])').forEach(container => {
    container.setAttribute('data-observed', 'true');
    observer.observe(container);
  });
}

async function init() {
  setSavedTheme(getSavedTheme());
  renderSkeletonState(appEl, searchQuery, showLowSec, getSavedTheme());

  try {
    const data = await fetchEverythingMoeData();
    allSites = [...indexSites(data.sites)];
    allSections = data.sections;

    buildShellHTML();
    updateHeaderButtons();
    updateCategoryBar();
    renderFilteredContent();

    if (showLowSec) ensureLowSecLoaded(activeSectionId);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('PWA SW registration failed:', err);
        });
      });
    }
  } catch (err) {
    appEl.innerHTML = `<div class="empty-state"><div class="empty-title">Connection Error</div><div class="empty-desc">${escapeHtml((err as Error).message)}</div></div>`;
  }
}

init();
