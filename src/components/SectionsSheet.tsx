import { X } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import { sections } from '../state';
import { SectionIcon } from './icons';
import { goToSection, sheetOpen } from './SectionBar';

export function SectionsSheet() {
  const ref = useRef<HTMLDialogElement>(null);
  const open = sheetOpen.value;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a backdrop click is only an extra way to close; Esc and the close button cover the keyboard
    <dialog
      ref={ref}
      class="sheet"
      aria-label="All sections"
      onClose={() => {
        sheetOpen.value = false;
      }}
      onClick={(e) => {
        if (e.target === ref.current) sheetOpen.value = false;
      }}
    >
      <div class="sheet-head">
        <h2>All sections</h2>
        <button
          type="button"
          class="icon-btn"
          aria-label="Close"
          onClick={() => {
            sheetOpen.value = false;
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div class="tiles">
        {sections.value.map((s) => (
          <a
            key={s.id}
            class="tile"
            style={`--sec:${s.color}`}
            href={`#/s/${s.id}`}
            onClick={(e) => {
              e.preventDefault();
              sheetOpen.value = false;
              goToSection(s.id);
            }}
          >
            <SectionIcon id={s.id} size={22} />
            <span class="tile-name">{s.short}</span>
            <span class="tile-count">{s.count}</span>
          </a>
        ))}
      </div>
    </dialog>
  );
}
