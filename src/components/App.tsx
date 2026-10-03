import { ArrowUp } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { UPSTREAM } from '../shared/home';
import {
  home,
  homeLoading,
  loadAllLow,
  loadHome,
  loadMeta,
  pendingScroll,
  query,
  route,
  setQuery,
  syncFromUrl
} from '../state';
import { nsfw, startPersistence } from '../store';
import { Header, searchInput } from './Header';
import { SectionBar } from './SectionBar';
import { SectionsSheet } from './SectionsSheet';
import { HomeView, LoadState, SavedView, SearchView, SectionView } from './views';

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 900);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      class="to-top"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUp size={20} />
    </button>
  );
}

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

export function App() {
  useEffect(() => {
    startPersistence();
    syncFromUrl();
    const sync = () => syncFromUrl();
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);

    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(document.activeElement);
      if ((e.key === '/' || (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey)) && !typing) {
        e.preventDefault();
        searchInput.value?.focus();
        searchInput.value?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.value?.focus();
        searchInput.value?.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInput.value) {
        if (query.value) setQuery('');
        else searchInput.value?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Reload the index when NSFW is toggled (upstream decides what to include).
  const showNsfw = nsfw.value;
  useEffect(() => {
    void loadHome();
  }, [showNsfw]);

  // Details and comment counts are secondary; fetch them once the index is on screen.
  const ready = home.value !== null;
  useEffect(() => {
    if (ready) void loadMeta();
  }, [ready]);

  // Search covers low ranks too, so fetch them the first time someone searches.
  const searching = query.value.trim().length > 0;
  useEffect(() => {
    if (searching && ready) void loadAllLow();
  }, [searching, ready]);

  useEffect(() => {
    document.title = searching ? `${query.value.trim()} · EverythingMoe` : 'EverythingMoe';
  }, [searching, query.value]);

  const r = route.value;
  // A new page starts at the top, unless a section chip asked to scroll somewhere on the overview.
  const pageKey = r.view === 'section' ? `s/${r.id}` : r.view;
  useEffect(() => {
    if (!pendingScroll.value) window.scrollTo({ top: 0 });
  }, [pageKey]);
  let view: ComponentChildren;
  if (!ready && (homeLoading.value || !home.value)) view = <LoadState />;
  else if (searching) view = <SearchView />;
  else if (r.view === 'section') view = <SectionView id={r.id} />;
  else if (r.view === 'saved') view = <SavedView />;
  else view = <HomeView />;

  return (
    <>
      <a class="skip" href="#main">
        Skip to content
      </a>
      <div class="topbar">
        <Header />
        <SectionBar />
      </div>
      <main id="main" class={`main ${r.view === 'home' && !searching ? 'main-wide' : 'main-narrow'}`}>
        {view}
      </main>
      <footer class="footer">
        <p>
          Rankings, notes and reviews come from{' '}
          <a href={UPSTREAM} target="_blank" rel="noopener noreferrer">
            EverythingMoe
          </a>
          . This is an unofficial viewer. Comments, corrections and new submissions live on the original site.
        </p>
      </footer>
      <SectionsSheet />
      <BackToTop />
    </>
  );
}
