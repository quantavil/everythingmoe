import { Skull, Star } from 'lucide-preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { searchDocs } from '../search';
import { type Item, matchesFilters, type Section, UPSTREAM } from '../shared/home';
import {
  clearSectionFilters,
  docs,
  homeError,
  homeLoading,
  loadAllLow,
  loadHome,
  loadLow,
  low,
  lowItems,
  navigate,
  pendingScroll,
  query,
  sectionFilters,
  sections,
  toggleSectionFilter,
  topItems
} from '../state';
import { bookmarks, collapsed, ROW_CHOICES, rowsPerPanel } from '../store';
import { SectionIcon } from './icons';
import { FilterChips, Notes, Panel } from './Panel';
import { Row } from './Row';
import { scrollToPanel, spyId, spyLockedUntil } from './SectionBar';

/* ---------------------------------------------------------------- home */

const MIN_COLUMN = 400;
const GAP = 16;

function useColumnCount(ref: { current: HTMLElement | null }): number {
  const [count, setCount] = useState(3);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (width: number) =>
      setCount(Math.max(1, Math.min(4, Math.floor((width + GAP) / (MIN_COLUMN + GAP)))));
    measure(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return count;
}

/** Shortest-column-first, so reading order stays left-to-right across the first row. */
function distribute(list: Section[], columns: number, rows: number): Section[][] {
  const out: Section[][] = Array.from({ length: columns }, () => []);
  const height = new Array<number>(columns).fill(0);
  for (const s of list) {
    const isCollapsed = collapsed.value.includes(s.id);
    const est = 56 + (isCollapsed ? 0 : Math.min(topItems(s).length, rows) * 40 + 48);
    const target = height.indexOf(Math.min(...height));
    out[target].push(s);
    height[target] += est + GAP;
  }
  return out;
}

const SPY_LINE = 132;

/** The panel whose header is nearest the sticky bars is "where you are", whichever column it is in. */
function useScrollSpy(ids: string) {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < spyLockedUntil) return;
      let best: string | null = null;
      let bestDistance = Infinity;
      document.querySelectorAll<HTMLElement>('.panel[data-sec]').forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        if (rect.bottom < SPY_LINE || rect.top > window.innerHeight * 0.7) return;
        const distance = Math.abs(rect.top - SPY_LINE);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = panel.dataset.sec ?? null;
        }
      });
      if (best) spyId.value = best;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
}

function Skeleton() {
  return (
    <div class="columns" aria-hidden="true">
      {[0, 1, 2].map((c) => (
        <div class="column" key={c}>
          {[0, 1].map((p) => (
            <div class="panel skeleton" key={p}>
              <div class="panel-head" />
              {Array.from({ length: 8 }, (_, i) => (
                <div class="row skeleton-row" key={i} style={`--w:${50 + ((i * 37 + c * 13) % 40)}%`}>
                  <span />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadState() {
  if (homeError.value) {
    return (
      <div class="state">
        <h2>Couldn’t load the index</h2>
        <p>{homeError.value}</p>
        <button type="button" class="btn btn-solid" onClick={() => void loadHome()}>
          Try again
        </button>
      </div>
    );
  }
  return <Skeleton />;
}

export function HomeView() {
  const list = sections.value;
  const host = useRef<HTMLDivElement>(null);
  const cols = useColumnCount(host);
  const rows = rowsPerPanel.value;
  const columns = distribute(list, cols, rows);
  const total = list.reduce((n, s) => n + s.count, 0);
  const allCollapsed = list.length > 0 && list.every((s) => collapsed.value.includes(s.id));

  useScrollSpy(list.map((s) => s.id).join(','));
  useEffect(() => {
    const id = pendingScroll.value;
    if (id) {
      pendingScroll.value = null;
      scrollToPanel(id);
    }
  }, []);

  return (
    <>
      <div class="strip">
        <p class="strip-meta">
          <strong>{total.toLocaleString()}</strong> sites in <strong>{list.length}</strong> sections, ranked by
          EverythingMoe
        </p>
        <div class="strip-tools">
          <span class="strip-label" id="rows-label">
            Rows per list
          </span>
          <fieldset class="segmented" aria-labelledby="rows-label">
            {ROW_CHOICES.map((n) => (
              <button
                type="button"
                class={rows === n ? 'on' : ''}
                aria-pressed={rows === n}
                onClick={() => {
                  rowsPerPanel.value = n;
                }}
              >
                {n}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            class="btn"
            onClick={() => {
              collapsed.value = allCollapsed ? [] : list.map((s) => s.id);
            }}
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      </div>
      <div class="columns" ref={host}>
        {columns.map((col, i) => (
          <div class="column" key={i}>
            {col.map((s) => (
              <Panel key={s.id} section={s} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- section */

function facetOptions(section: Section, items: Item[]): { options: string[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const item of items) for (const f of item.filters) counts[f] = (counts[f] ?? 0) + 1;
  const extra = Object.keys(counts)
    .filter((f) => !section.filterOptions.includes(f))
    .sort((a, b) => counts[b] - counts[a]);
  const options = [...section.filterOptions, ...extra].filter((f) => counts[f]).slice(0, 14);
  return { options, counts };
}

export function SectionView({ id }: { id: string }) {
  const section = sections.value.find((s) => s.id === id);
  useEffect(() => {
    if (section) void loadLow(section);
  }, [section?.id]);

  if (!section) {
    if (homeLoading.value || homeError.value) return <LoadState />;
    return (
      <div class="state">
        <h2>That section doesn’t exist</h2>
        <p>It may be hidden because NSFW sites are off, or it has been renamed upstream.</p>
        <button type="button" class="btn btn-solid" onClick={() => navigate({ view: 'home' })}>
          Back to all sections
        </button>
      </div>
    );
  }

  const lowState = low.value[section.id];
  const items = [...topItems(section), ...lowItems(section)];
  const active = sectionFilters.value;
  const activeSet = new Set(active);
  const shown = items.filter((i) => matchesFilters(i, activeSet));
  const { options, counts } = facetOptions(section, items);
  const facetSection = { ...section, filterOptions: options };

  return (
    <article class="focus" style={`--sec:${section.color}`}>
      <header class="focus-head">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="#/">All sections</a>
          <span aria-hidden="true">/</span>
          <span>{section.title}</span>
        </nav>
        <h1>
          <SectionIcon id={section.id} size={24} /> {section.title}
        </h1>
        <p class="focus-meta">
          {shown.length === items.length ? `${items.length} sites` : `${shown.length} of ${items.length} sites`}
          {lowState?.status === 'loading' && ' · loading low ranks…'}
        </p>
        <Notes section={section} />
        {options.length > 0 && (
          <FilterChips
            section={facetSection}
            active={active}
            counts={counts}
            onToggle={toggleSectionFilter}
            onClear={clearSectionFilters}
          />
        )}
      </header>

      <div class="panel focus-list">
        <div class="list">
          {shown.map((item) => (
            <Row key={`${item.low ? 'low' : 'top'}-${item.id}`} item={item} section={section} />
          ))}
          {shown.length === 0 && <p class="empty-row">No sites here match those filters.</p>}
        </div>
      </div>

      {lowState?.status === 'error' && (
        <p class="more-note">
          Could not load low ranks.{' '}
          <button type="button" class="link-btn" onClick={() => void loadLow(section)}>
            Retry
          </button>
        </p>
      )}
      {lowState?.status === 'ready' && lowState.dead.length > 0 && (
        <p class="more-note">
          <Skull size={14} /> {lowState.dead.length} shut down —{' '}
          <a href={`${UPSTREAM}/graveyard`} target="_blank" rel="noopener noreferrer">
            see the Graveyard
          </a>
        </p>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------- saved */

export function SavedView() {
  const ids = bookmarks.value;
  const found = new Set<string>();
  const groups: Array<{ section: Section; items: Item[] }> = [];
  for (const s of sections.value) {
    const items = [...topItems(s), ...lowItems(s)].filter((i) => ids.includes(i.id) && !found.has(i.id));
    for (const i of items) found.add(i.id);
    if (items.length) groups.push({ section: s, items });
  }
  const missing = ids.filter((id) => !found.has(id));
  const lowPending =
    sections.value.some((s) => s.lowId && !low.value[s.id]) ||
    sections.value.some((s) => low.value[s.id]?.status === 'loading');

  useEffect(() => {
    if (missing.length) void loadAllLow();
  }, [missing.length > 0]);

  if (ids.length === 0) {
    return (
      <div class="state">
        <Star size={28} />
        <h2>Nothing saved yet</h2>
        <p>Tap the star on any site to keep it here. Saved sites stay on this device.</p>
        <button type="button" class="btn btn-solid" onClick={() => navigate({ view: 'home' })}>
          Browse sites
        </button>
      </div>
    );
  }

  return (
    <article class="focus">
      <header class="focus-head">
        <h1>
          <Star size={24} fill="currentColor" /> Saved
        </h1>
        <p class="focus-meta">
          {ids.length} {ids.length === 1 ? 'site' : 'sites'}, stored on this device
        </p>
      </header>
      {groups.map((g) => (
        <section class="panel group" style={`--sec:${g.section.color}`} key={g.section.id}>
          <header class="panel-head group-head">
            <span class="panel-title">
              <SectionIcon id={g.section.id} size={16} />
              <h2>{g.section.title}</h2>
            </span>
          </header>
          <div class="list">
            {g.items.map((item) => (
              <Row key={item.id} item={item} section={g.section} />
            ))}
          </div>
        </section>
      ))}
      {missing.length > 0 && (
        <p class="more-note">
          {lowPending
            ? `Looking for ${missing.length} more…`
            : `${missing.length} saved ${missing.length === 1 ? 'site is' : 'sites are'} no longer listed upstream.`}
          {!lowPending && (
            <>
              {' '}
              <button
                type="button"
                class="link-btn"
                onClick={() => {
                  bookmarks.value = bookmarks.value.filter((id) => found.has(id));
                }}
              >
                Remove
              </button>
            </>
          )}
        </p>
      )}
    </article>
  );
}

/* --------------------------------------------------------------- search */

const PER_GROUP = 6;

export function SearchView() {
  const q = query.value;
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const allDocs = docs.value;
  const hits = useMemo(() => searchDocs(allDocs, q), [allDocs, q]);
  const loadingLow = sections.value.some(
    (s) => s.lowId && low.value[s.id]?.status !== 'ready' && low.value[s.id]?.status !== 'error'
  );

  const bySection = new Map<string, typeof hits>();
  for (const h of hits) {
    const list = bySection.get(h.doc.sectionId) ?? [];
    list.push(h);
    bySection.set(h.doc.sectionId, list);
  }
  const groups = sections.value.filter((s) => bySection.has(s.id));

  return (
    <article class="focus">
      <header class="focus-head">
        <h1>Results for “{q.trim()}”</h1>
        <p class="focus-meta">
          {hits.length} {hits.length === 1 ? 'match' : 'matches'}
          {loadingLow && ' · still searching low ranks…'}
        </p>
      </header>
      {hits.length === 0 && !loadingLow && (
        <div class="state compact">
          <h2>No sites match</h2>
          <p>Try fewer letters, or search by a tag such as “soft-sub” or “DDL”.</p>
        </div>
      )}
      {groups.map((s) => {
        const list = bySection.get(s.id)!;
        const expandedGroup = showAll[s.id];
        const visible = expandedGroup ? list : list.slice(0, PER_GROUP);
        return (
          <section class="panel group" style={`--sec:${s.color}`} key={s.id}>
            <header class="panel-head group-head">
              <span class="panel-title">
                <SectionIcon id={s.id} size={16} />
                <h2>{s.title}</h2>
                <span class="panel-count">{list.length}</span>
              </span>
            </header>
            <div class="list">
              {visible.map((h) => (
                <Row
                  key={`${h.doc.item.low ? 'low' : 'top'}-${h.doc.item.id}`}
                  item={h.doc.item}
                  section={s}
                  ranges={h.ranges}
                />
              ))}
            </div>
            {list.length > PER_GROUP && (
              <button type="button" class="more" onClick={() => setShowAll({ ...showAll, [s.id]: !expandedGroup })}>
                {expandedGroup ? 'Show fewer' : `Show all ${list.length}`}
              </button>
            )}
          </section>
        );
      })}
    </article>
  );
}
