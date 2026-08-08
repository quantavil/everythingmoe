import { MirrorLink } from './types';

export interface MirrorStatusResult {
  url: string;
  label: string;
  status: 'online' | 'offline';
  pingMs?: number;
}

export interface AllMirrorsCheckResult {
  liveCount: number;
  totalCount: number;
  bestPingMs?: number;
  mirrors: MirrorStatusResult[];
}

interface CachedHealthEntry {
  status: 'online' | 'offline';
  pingMs?: number;
  checkedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const PROBE_TIMEOUT_MS = 2500;
const SESSION_CACHE_KEY = 'everythingmoe_health_cache_v1';

function loadHealthCache(): Map<string, CachedHealthEntry> {
  const map = new Map<string, CachedHealthEntry>();
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_CACHE_KEY) : null;
    if (raw) {
      const parsed: Record<string, CachedHealthEntry> = JSON.parse(raw);
      const now = Date.now();
      for (const [url, entry] of Object.entries(parsed)) {
        if (now - entry.checkedAt < CACHE_TTL_MS) map.set(url, entry);
      }
    }
  } catch { /* ignore corrupt cache */ }
  return map;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveHealthCache() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const obj: Record<string, CachedHealthEntry> = {};
      const now = Date.now();
      healthCache.forEach((entry, url) => {
        if (now - entry.checkedAt < CACHE_TTL_MS) obj[url] = entry;
      });
      sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(obj));
    } catch { /* ignore */ }
  }, 400);
}

const healthCache = loadHealthCache();
const inFlightProbes = new Map<string, Promise<{ status: 'online' | 'offline'; pingMs?: number }>>();

function setHealthCache(url: string, entry: CachedHealthEntry) {
  if (healthCache.size >= 2500 && !healthCache.has(url)) {
    const oldestKey = healthCache.keys().next().value;
    if (oldestKey) healthCache.delete(oldestKey);
  }
  healthCache.set(url, entry);
  saveHealthCache();
}

export function getCachedSiteHealth(altlinks: MirrorLink[]): AllMirrorsCheckResult | null {
  if (!altlinks?.length) return null;
  const now = Date.now();
  const results: MirrorStatusResult[] = [];

  for (const m of altlinks) {
    const cached = healthCache.get(m.url);
    if (!cached || now - cached.checkedAt >= CACHE_TTL_MS) return null;
    results.push({ url: m.url, label: m.label, status: cached.status, pingMs: cached.pingMs });
  }

  const live = results.filter(r => r.status === 'online');
  const validPings = live.map(m => m.pingMs).filter((p): p is number => p !== undefined);

  return {
    liveCount: live.length,
    totalCount: altlinks.length,
    bestPingMs: validPings.length ? Math.min(...validPings) : undefined,
    mirrors: results
  };
}

class ConcurrencyQueue {
  private running = 0;
  private queue: (() => void)[] = [];
  constructor(private concurrency = 5) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>(res => this.queue.push(res));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      this.queue.shift()?.();
    }
  }
}

const healthCheckQueue = new ConcurrencyQueue(5);
const siteCheckQueue = new ConcurrencyQueue(4);

/** Favicon & DNS probe — multi-tier reachability heuristic. */
async function probeImage(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);

      const img1 = new Image();
      img1.onload = () => { clearTimeout(timer); finish(true); };
      img1.onerror = () => {
        const img2 = new Image();
        img2.onload = () => { clearTimeout(timer); finish(true); };
        img2.onerror = () => {
          const img3 = new Image();
          img3.onload = () => { clearTimeout(timer); finish(true); };
          img3.onerror = () => { clearTimeout(timer); finish(false); };
          img3.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32&_t=${Date.now()}`;
        };
        img2.src = `${parsed.origin}/favicon.png?_t=${Date.now()}`;
      };
      img1.src = `${parsed.origin}/favicon.ico?_t=${Date.now()}`;
    } catch {
      resolve(false);
    }
  });
}

/**
 * Browser-side reachability estimate.
 * no-cors fetch only proves the host answered — not that the site is usable.
 */
export async function pingUrl(
  url: string,
  forceRefresh = false
): Promise<{ status: 'online' | 'offline'; pingMs?: number }> {
  if (!forceRefresh) {
    const cached = healthCache.get(url);
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
      return { status: cached.status, pingMs: cached.pingMs };
    }
    const inflight = inFlightProbes.get(url);
    if (inflight) return inflight;
  }

  const probeTask = healthCheckQueue.run(async () => {
    const start = performance.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-cache', signal: controller.signal });
      const pingMs = Math.round(performance.now() - start);
      setHealthCache(url, { status: 'online', pingMs, checkedAt: Date.now() });
      return { status: 'online' as const, pingMs };
    } catch {
      const probeStart = performance.now();
      const isAlive = await probeImage(url);
      if (isAlive) {
        const pingMs = Math.round(performance.now() - probeStart);
        setHealthCache(url, { status: 'online', pingMs, checkedAt: Date.now() });
        return { status: 'online' as const, pingMs };
      }
      setHealthCache(url, { status: 'offline', checkedAt: Date.now() });
      return { status: 'offline' as const };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }).finally(() => inFlightProbes.delete(url));

  inFlightProbes.set(url, probeTask);
  return probeTask;
}

export async function checkAllMirrorsHealth(
  altlinks: MirrorLink[],
  forceRefresh = false
): Promise<AllMirrorsCheckResult> {
  if (!altlinks?.length) return { liveCount: 0, totalCount: 0, mirrors: [] };

  const runCheck = async () => {
    const results = await Promise.all(
      altlinks.map(async m => {
        const res = await pingUrl(m.url, forceRefresh);
        return { url: m.url, label: m.label, status: res.status, pingMs: res.pingMs };
      })
    );

    const live = results.filter(r => r.status === 'online');
    const validPings = live.map(m => m.pingMs).filter((p): p is number => p !== undefined);

    return {
      liveCount: live.length,
      totalCount: altlinks.length,
      bestPingMs: validPings.length ? Math.min(...validPings) : undefined,
      mirrors: results
    };
  };

  return forceRefresh ? runCheck() : siteCheckQueue.run(runCheck);
}
