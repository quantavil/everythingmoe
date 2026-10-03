import { signal } from '@preact/signals';
import { LayoutGrid } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import { navigate, pendingScroll, route, sections } from '../state';
import { collapsed, toggleCollapsed } from '../store';
import { SectionIcon } from './icons';

export const sheetOpen = signal(false);
/** Section the reader is currently looking at on the overview, set by scroll-spy. */
export const spyId = signal<string | null>(null);

/** While a smooth scroll triggered by a click is running, scroll-spy must not fight it. */
export let spyLockedUntil = 0;

export function scrollToPanel(id: string) {
  spyId.value = id;
  spyLockedUntil = Date.now() + 1000;
  if (collapsed.value.includes(id)) toggleCollapsed(id);
  requestAnimationFrame(() => {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/** Jump to a section: scroll on the overview, switch on a section page, go home first otherwise. */
export function goToSection(id: string) {
  const r = route.value;
  if (r.view === 'home') scrollToPanel(id);
  else if (r.view === 'section') navigate({ view: 'section', id });
  else {
    pendingScroll.value = id;
    navigate({ view: 'home' });
  }
}

export function SectionBar() {
  const list = sections.value;
  const r = route.value;
  const activeId = r.view === 'section' ? r.id : r.view === 'home' ? spyId.value : null;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  return (
    <div class="sectionbar">
      <button
        type="button"
        class="all-btn"
        aria-haspopup="dialog"
        onClick={() => {
          sheetOpen.value = true;
        }}
      >
        <LayoutGrid size={16} /> <span>Sections</span>
      </button>
      <nav class="chips-scroll" aria-label="Sections" ref={scroller}>
        {list.map((s) => (
          <a
            key={s.id}
            class={`sec-chip ${activeId === s.id ? 'active' : ''}`}
            style={`--sec:${s.color}`}
            href={`#/s/${s.id}`}
            aria-current={activeId === s.id ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault();
              goToSection(s.id);
            }}
          >
            <SectionIcon id={s.id} size={14} />
            <span>{s.short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
