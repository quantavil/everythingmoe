import { ChevronDown, Filter, Maximize2, RefreshCw, Skull } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { checkMany } from '../health';
import { matchesFilters, type Section, UPSTREAM } from '../shared/home';
import {
  clearPanelFilters,
  loadLow,
  low,
  lowItems,
  navigate,
  panelFilters,
  togglePanelFilter,
  topItems
} from '../state';
import { collapsed, rowsPerPanel, toggleCollapsed } from '../store';
import { SectionIcon } from './icons';
import { Row } from './Row';

function linkGraveyard(text: string) {
  return text.split(/(Graveyard)/).map((part) =>
    part === 'Graveyard' ? (
      <a href={`${UPSTREAM}/graveyard`} target="_blank" rel="noopener noreferrer">
        Graveyard
      </a>
    ) : (
      part
    )
  );
}

export function Notes({ section }: { section: Section }) {
  if (!section.notes.length) return null;
  return (
    <p class="notes">
      {section.notes.map((t) =>
        t.id ? (
          <a href={`${UPSTREAM}/s/${encodeURIComponent(t.id)}`} target="_blank" rel="noopener noreferrer">
            {t.text}
          </a>
        ) : (
          <span>{linkGraveyard(t.text)}</span>
        )
      )}
    </p>
  );
}

export function FilterChips({
  section,
  active,
  onToggle,
  onClear,
  counts
}: {
  section: Section;
  active: string[];
  onToggle: (f: string) => void;
  onClear: () => void;
  counts?: Record<string, number>;
}) {
  return (
    <fieldset class="filter-chips">
      <legend class="sr-only">{`Filter ${section.short}`}</legend>
      {section.filterOptions.map((f) => (
        <button
          type="button"
          class={`chip-btn ${active.includes(f) ? 'on' : ''}`}
          aria-pressed={active.includes(f)}
          onClick={() => onToggle(f)}
        >
          {f}
          {counts && counts[f] !== undefined && <span class="count">{counts[f]}</span>}
        </button>
      ))}
      {active.length > 0 && (
        <button type="button" class="chip-btn clear" onClick={onClear}>
          Clear
        </button>
      )}
    </fieldset>
  );
}

export function Panel({ section }: { section: Section }) {
  const isCollapsed = collapsed.value.includes(section.id);
  const active = panelFilters.value[section.id] ?? [];
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [extra, setExtra] = useState(0);
  const [lowOpen, setLowOpen] = useState(false);

  const activeSet = new Set(active);
  const top = topItems(section).filter((i) => matchesFilters(i, activeSet));
  const limit = rowsPerPanel.value + extra;
  const shown = top.slice(0, limit);
  const hidden = top.length - shown.length;

  const lowState = low.value[section.id];
  const lowTotal =
    lowState?.status === 'ready' ? lowItems(section).length : Math.max(section.count - section.items.length, 0);
  const lowRows = lowOpen && hidden === 0 ? lowItems(section).filter((i) => matchesFilters(i, activeSet)) : [];
  const showFilterRow = section.filterOptions.length > 0 && (filtersOpen || active.length > 0);

  const toggleLow = () => {
    if (!lowOpen) void loadLow(section);
    setLowOpen(!lowOpen);
  };

  return (
    <section
      class={`panel ${isCollapsed ? 'is-collapsed' : ''}`}
      id={`sec-${section.id}`}
      data-sec={section.id}
      style={`--sec:${section.color}`}
    >
      <header class="panel-head">
        <button
          type="button"
          class="panel-toggle"
          aria-expanded={!isCollapsed}
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${section.title}`}
          onClick={() => toggleCollapsed(section.id)}
        >
          <ChevronDown size={18} class="caret" />
        </button>
        <a
          class="panel-title"
          href={`#/s/${section.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate({ view: 'section', id: section.id });
          }}
        >
          <SectionIcon id={section.id} size={17} />
          <h2>{section.title}</h2>
          <span class="panel-count">{section.count}</span>
        </a>
        <span class="panel-tools">
          {section.filterOptions.length > 0 && (
            <button
              type="button"
              class={`icon-btn ${showFilterRow ? 'on' : ''}`}
              aria-pressed={showFilterRow}
              aria-label={`Filter ${section.title}`}
              title="Filter"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Filter size={16} />
            </button>
          )}
          <button
            type="button"
            class="icon-btn"
            aria-label={`Check status of top ${section.title} sites`}
            title="Check which of these sites respond"
            onClick={() => void checkMany(shown.map((i) => i.url).filter(Boolean))}
          >
            <RefreshCw size={16} />
          </button>
          <a
            class="icon-btn open-btn"
            href={`#/s/${section.id}`}
            aria-label={`Open ${section.title} on its own page`}
            title="Open full list"
            onClick={(e) => {
              e.preventDefault();
              navigate({ view: 'section', id: section.id });
            }}
          >
            <Maximize2 size={16} />
          </a>
        </span>
      </header>

      {!isCollapsed && (
        <div class="panel-body">
          <Notes section={section} />
          {showFilterRow && (
            <FilterChips
              section={section}
              active={active}
              onToggle={(f) => togglePanelFilter(section.id, f)}
              onClear={() => clearPanelFilters(section.id)}
            />
          )}
          <div class="list">
            {shown.map((item) => (
              <Row key={item.id} item={item} section={section} />
            ))}
            {lowRows.map((item) => (
              <Row key={`low-${item.id}`} item={item} section={section} />
            ))}
            {top.length === 0 && <p class="empty-row">No sites here match those filters.</p>}
          </div>

          {lowOpen && lowState?.status === 'loading' && <p class="more-note">Loading low ranks…</p>}
          {lowOpen && lowState?.status === 'error' && (
            <p class="more-note">
              Could not load low ranks.{' '}
              <button type="button" class="link-btn" onClick={() => void loadLow(section)}>
                Retry
              </button>
            </p>
          )}
          {lowOpen && lowState?.status === 'ready' && lowState.dead.length > 0 && (
            <p class="more-note">
              <Skull size={14} /> {lowState.dead.length} shut down —{' '}
              <a href={`${UPSTREAM}/graveyard`} target="_blank" rel="noopener noreferrer">
                see the Graveyard
              </a>
            </p>
          )}

          {hidden > 0 && (
            <button type="button" class="more" onClick={() => setExtra(extra + rowsPerPanel.value)}>
              Show {Math.min(hidden, rowsPerPanel.value)} more <span class="more-meta">· {hidden} left</span>
            </button>
          )}
          {hidden === 0 && section.lowId && (
            <button type="button" class="more" aria-expanded={lowOpen} onClick={toggleLow}>
              {lowOpen ? 'Hide low ranks' : 'Low ranks'} {!lowOpen && <span class="more-meta">· {lowTotal}</span>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
