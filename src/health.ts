import { signal } from '@preact/signals';

export type HealthState = 'online' | 'redirected' | 'offline' | 'unknown';

export interface Health {
  state: HealthState;
  pingMs?: number;
  redirectHost?: string;
  checkedAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'everythingmoe_health_v3';
const CONCURRENCY = 4;

/** url -> latest result. Rows read this, so a finished probe updates every view of that url. */
export const health = signal<Record<string, Health>>(loadCache());
/** urls currently being probed. */
export const checking = signal<ReadonlySet<string>>(new Set());

function loadCache(): Record<string, Health> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, Health>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(parsed).filter(([, h]) => now - h.checkedAt < TTL_MS));
  } catch {
    return {};
  }
}

function persist() {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(health.value));
  } catch {
    /* ignore */
  }
}

let running = 0;
const waiting: Array<() => void> = [];
async function slot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= CONCURRENCY) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const inFlight = new Map<string, Promise<Health>>();

/**
 * Probes go through our edge function only. The browser never contacts a
 * listed site on its own, so scrolling or expanding a row cannot leak the
 * visitor's IP to third parties.
 */
export function checkUrl(url: string, force = false): Promise<Health> {
  const cached = health.value[url];
  if (!force && cached && Date.now() - cached.checkedAt < TTL_MS) return Promise.resolve(cached);
  const pending = inFlight.get(url);
  if (pending) return pending;

  checking.value = new Set(checking.value).add(url);
  const job = slot(async (): Promise<Health> => {
    try {
      const res = await fetch(`/api/health?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { status?: HealthState; pingMs?: number; redirectHost?: string };
      const state: HealthState = data.status === 'online' || data.status === 'redirected' ? data.status : 'offline';
      return { state, pingMs: data.pingMs, redirectHost: data.redirectHost, checkedAt: Date.now() };
    } catch {
      // Our own edge could not answer. That says nothing about the site, so don't record it.
      return { state: 'unknown', checkedAt: Date.now() };
    }
  })
    .then((result) => {
      if (result.state === 'unknown') return result;
      health.value = { ...health.value, [url]: result };
      persist();
      return result;
    })
    .finally(() => {
      inFlight.delete(url);
      const next = new Set(checking.value);
      next.delete(url);
      checking.value = next;
    });
  inFlight.set(url, job);
  return job;
}

export function checkMany(urls: string[], force = false): Promise<Health[]> {
  return Promise.all(urls.map((u) => checkUrl(u, force)));
}
