import { signal } from '@preact/signals';
import { Eye, EyeOff, Menu as MenuIcon, Moon, Search, Star, Sun, X } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { UPSTREAM } from '../shared/home';
import { query, route, setQuery } from '../state';
import { bookmarks, nsfw, theme } from '../store';

export const searchInput = signal<HTMLInputElement | null>(null);

const LINKS: Array<[string, string]> = [
  ['Graveyard', `${UPSTREAM}/graveyard`],
  ['Activity', `${UPSTREAM}/activity.html`],
  ['Monitor', `${UPSTREAM}/monitor`],
  ['Articles', `${UPSTREAM}/post/`],
  ['About EverythingMoe', `${UPSTREAM}/post/info.html`]
];

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div class="menu" ref={ref}>
      <button
        type="button"
        class="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More"
        onClick={() => setOpen(!open)}
      >
        <MenuIcon size={19} />
      </button>
      {open && (
        <div class="menu-pop" role="menu">
          <button
            type="button"
            role="menuitem"
            class="menu-item"
            onClick={() => {
              theme.value = theme.value === 'dark' ? 'light' : 'dark';
              setOpen(false);
            }}
          >
            {theme.value === 'dark' ? <Sun size={16} /> : <Moon size={16} />}{' '}
            {theme.value === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
          <hr />
          <p class="menu-label">On EverythingMoe</p>
          {LINKS.map(([label, href]) => (
            <a role="menuitem" class="menu-item" href={href} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const saved = bookmarks.value.length;
  const onSaved = route.value.view === 'saved';
  return (
    <div class="header">
      {/* biome-ignore lint/a11y/useValidAnchor: "#/" is the overview route, a real navigation target */}
      <a class="brand" href="#/" aria-label="EverythingMoe home" onClick={() => setQuery('')}>
        <span class="brand-mark" aria-hidden="true">
          E
        </span>
        <span class="brand-name">EverythingMoe</span>
      </a>

      <label class="search">
        <Search size={17} aria-hidden="true" />
        <input
          ref={(el) => {
            if (searchInput.value !== el) searchInput.value = el;
          }}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autocomplete="off"
          spellcheck={false}
          placeholder="Search every site"
          aria-label="Search every site"
          value={query.value}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        {query.value ? (
          <button
            type="button"
            class="search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              searchInput.value?.focus();
            }}
          >
            <X size={15} />
          </button>
        ) : (
          <kbd class="search-kbd">/</kbd>
        )}
      </label>

      <nav class="header-actions" aria-label="Tools">
        <button
          type="button"
          class={`pill ${nsfw.value ? 'on' : ''}`}
          aria-pressed={nsfw.value}
          title={nsfw.value ? 'NSFW sites are shown' : 'NSFW sites are hidden'}
          onClick={() => {
            nsfw.value = !nsfw.value;
          }}
        >
          {nsfw.value ? <Eye size={16} /> : <EyeOff size={16} />}
          <span class="pill-text">NSFW</span>
        </button>
        <a class={`pill ${onSaved ? 'on' : ''}`} href="#/saved" aria-label={`Saved sites (${saved})`}>
          <Star size={16} fill={onSaved ? 'currentColor' : 'none'} />
          <span class="pill-text">Saved</span>
          {saved > 0 && <span class="pill-count">{saved}</span>}
        </a>
        <button
          type="button"
          class="icon-btn theme-btn"
          aria-label="Toggle theme"
          onClick={() => {
            theme.value = theme.value === 'dark' ? 'light' : 'dark';
          }}
        >
          {theme.value === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <MoreMenu />
      </nav>
    </div>
  );
}
