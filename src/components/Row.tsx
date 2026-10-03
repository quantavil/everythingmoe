import { useComputed } from '@preact/signals';
import { Check, ChevronDown, Link as LinkIcon, MessageSquare, RefreshCw, Star } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import { checking, checkMany, type Health, health } from '../health';
import { splitByRanges } from '../search';
import { type Item, RANK_COLORS, type Section, UPSTREAM } from '../shared/home';
import { commentCount, expanded, getDetail, itemKey, rawDetails, toggleExpanded } from '../state';
import { bookmarks, toggleBookmark } from '../store';
import { memo } from './memo';

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function SiteIcon({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false);
  if (!item.icon || failed || /\/default\.png$/.test(item.icon)) {
    return (
      <span class="icon icon-fallback" style={`--hue:${hue(item.name)}`} aria-hidden="true">
        {item.name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      class="icon"
      src={item.icon}
      alt=""
      width="24"
      height="24"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function describe(h: Health | undefined, busy: boolean): { cls: string; label: string } {
  if (busy) return { cls: 'checking', label: 'Checking…' };
  if (!h || h.state === 'unknown') return { cls: 'none', label: 'Not checked' };
  if (h.state === 'online') return { cls: 'up', label: h.pingMs ? `Up · ${h.pingMs} ms` : 'Up' };
  if (h.state === 'redirected') return { cls: 'moved', label: h.redirectHost ? `Moved to ${h.redirectHost}` : 'Moved' };
  return { cls: 'down', label: 'No response from our check' };
}

function normalize(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

function MirrorLink({ label, url }: { label: string; url: string }) {
  const state = useComputed(() => ({ h: health.value[url], busy: checking.value.has(url) }));
  const { h, busy } = state.value;
  const { cls, label: statusLabel } = describe(h, busy);
  const detail =
    h?.state === 'redirected' && h.redirectHost
      ? `→ ${h.redirectHost}`
      : h?.state === 'online' && h.pingMs
        ? `${h.pingMs} ms`
        : '';
  return (
    <a class="mirror" href={url} target="_blank" rel="noopener noreferrer" title={`${url} · ${statusLabel}`}>
      <span class={`status ${cls}`}>
        <span class="dot" />
      </span>
      <span class="mirror-label">{label}</span>
      {detail && <span class="mirror-meta">{detail}</span>}
      <LinkIcon size={14} />
    </a>
  );
}

function Detail({ item }: { item: Item }) {
  const detail = getDetail(item.id);
  const loaded = rawDetails.value !== null;
  const saved = bookmarks.value.includes(item.id);
  const count = commentCount(item.id);

  const mirrors: Array<{ label: string; url: string }> = [];
  if (item.url) mirrors.push({ label: item.name, url: item.url });
  for (const m of detail?.mirrors ?? []) {
    if (!mirrors.some((x) => normalize(x.url) === normalize(m.url))) mirrors.push(m);
  }
  const urls = mirrors.map((m) => m.url);
  const anyBusy = urls.some((u) => checking.value.has(u));

  return (
    <div class="detail">
      <div class="detail-info">
        {detail && (detail.positive.length > 0 || detail.negative.length > 0) && (
          <ul class="traits">
            {detail.positive.map((t) => (
              <li class="pos">{t}</li>
            ))}
            {detail.negative.map((t) => (
              <li class="neg">{t}</li>
            ))}
          </ul>
        )}
        {detail?.note && <p class="note">{detail.note}</p>}
        {item.licensed && <p class="note">Licensed, official service.</p>}
        {detail?.dead && <p class="note warn">{detail.dead}</p>}
        {!detail && <p class="note muted">{loaded ? 'No notes for this site yet.' : 'Loading details…'}</p>}
      </div>
      <div class="detail-links">
        {mirrors.length === 0 && (
          <p class="note muted">Upstream shares links for this site through its comments page.</p>
        )}
        <div class="mirrors">
          {mirrors.map((m) => (
            <MirrorLink label={m.label} url={m.url} />
          ))}
        </div>
        {detail && detail.extra.length > 0 && (
          <details class="extra">
            <summary>Related links ({detail.extra.length})</summary>
            <div class="mirrors">
              {detail.extra.map((m) => (
                <a class="mirror" href={m.url} target="_blank" rel="noopener noreferrer" title={m.url}>
                  <span class="mirror-label">{m.label}</span>
                  <LinkIcon size={14} />
                </a>
              ))}
            </div>
          </details>
        )}
        <div class="detail-actions">
          <button
            type="button"
            class={`btn ${saved ? 'btn-on' : ''}`}
            aria-pressed={saved}
            onClick={() => toggleBookmark(item.id)}
          >
            {saved ? <Check size={15} /> : <Star size={15} />} {saved ? 'Saved' : 'Save'}
          </button>
          <a
            class="btn"
            href={`${UPSTREAM}/s/${encodeURIComponent(item.id)}#comments`}
            target="_blank"
            rel="noopener noreferrer"
            title="Read and write comments on EverythingMoe"
          >
            <MessageSquare size={15} /> {count > 0 ? count : 'Comments'}
          </a>
          {urls.length > 0 && (
            <button
              type="button"
              class="btn"
              disabled={anyBusy}
              onClick={() => checkMany(urls, true)}
              title="Ask our server whether these links respond"
            >
              <RefreshCw size={15} class={anyBusy ? 'spin' : ''} /> {anyBusy ? 'Checking' : 'Check status'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  item: Item;
  section: Section;
  ranges?: number[] | null;
  showSection?: boolean;
}

function RowView({ item, section, ranges = null, showSection = false }: RowProps) {
  const key = itemKey(section.id, item.id);
  const openSignal = useComputed(() => expanded.value.has(key));
  const savedSignal = useComputed(() => bookmarks.value.includes(item.id));
  const statusSignal = useComputed(() => {
    if (!item.url) return { cls: '', label: '' };
    const { cls, label } = describe(health.value[item.url], checking.value.has(item.url));
    return cls === 'none' ? { cls: '', label: '' } : { cls, label };
  });
  const rowStatus = statusSignal.value;
  const open = openSignal.value;
  const saved = savedSignal.value;
  const href = item.url || `${UPSTREAM}/s/${encodeURIComponent(item.id)}#comments`;
  const topRank = !item.low && item.rank >= 1 && item.rank <= RANK_COLORS.length;

  const detail = open ? getDetail(item.id) : null;
  const mirrorKey = open ? (detail?.mirrors.map((m) => m.url).join('|') ?? '') : '';
  useEffect(() => {
    if (!open) return;
    const urls = [item.url, ...(detail?.mirrors.map((m) => m.url) ?? [])].filter(Boolean).slice(0, 8);
    if (urls.length) void checkMany([...new Set(urls)]);
  }, [open, item.url, mirrorKey]);

  const parts = splitByRanges(item.name, ranges);
  const hasChips = item.tags.length > 0 || item.torrent || item.nsfw || !item.url;

  return (
    <div
      class={`item ${open ? 'open' : ''} ${item.low ? 'low' : ''} ${item.licensed ? 'licensed' : ''} ${rowStatus.cls ? `is-${rowStatus.cls}` : ''}`}
    >
      <div class="row">
        <span class="rank" style={topRank ? `color:${RANK_COLORS[item.rank - 1]}` : undefined}>
          {item.rank}.
        </span>
        <a
          class="name-link"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={item.licensed ? `${item.name} (licensed, official service)` : undefined}
        >
          <SiteIcon item={item} />
          {rowStatus.label && <span class="sr-only">{rowStatus.label}. </span>}
          <span class="name">{parts.map((p) => (p.hit ? <mark>{p.text}</mark> : p.text))}</span>
        </a>
        {hasChips && (
          <span class="chips">
            {item.tags.map((t) => (
              <span class="chip">{t}</span>
            ))}
            {item.torrent && <span class="chip chip-torrent">TORRENT</span>}
            {item.nsfw && <span class="chip chip-nsfw">NSFW</span>}
            {!item.url && <span class="chip">DM FOR LINKS</span>}
          </span>
        )}
        <span class="grow" />
        {showSection && <span class="where">{section.short}</span>}
        <button
          type="button"
          class={`icon-btn star ${saved ? 'on' : ''}`}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
          onClick={() => toggleBookmark(item.id)}
        >
          <Star size={17} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          class="icon-btn chevron"
          aria-expanded={open}
          aria-label={`Details for ${item.name}`}
          onClick={() => toggleExpanded(key)}
        >
          <ChevronDown size={18} />
        </button>
      </div>
      {open && <Detail item={item} />}
    </div>
  );
}

export const Row = memo(RowView);
