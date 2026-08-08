import { MirrorLink } from './types';

export interface MirrorStatusResult {
  url: string;
  label: string;
  status: 'online' | 'offline' | 'redirected';
  pingMs?: number;
  redirectUrl?: string;
  redirectHost?: string;
}

export interface AllMirrorsCheckResult {
  liveCount: number;
  totalCount: number;
  bestPingMs?: number;
  mirrors: MirrorStatusResult[];
}

interface CachedHealthEntry {
  status: 'online' | 'offline' | 'redirected';
  pingMs?: number;
  redirectUrl?: string;
  redirectHost?: string;
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
const inFlightProbes = new Map<string, Promise<{ status: 'online' | 'offline' | 'redirected'; pingMs?: number; redirectUrl?: string; redirectHost?: string }>>();

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
    results.push({
      url: m.url,
      label: m.label,
      status: cached.status,
      pingMs: cached.pingMs,
      redirectUrl: cached.redirectUrl,
      redirectHost: cached.redirectHost
    });
  }

  const live = results.filter(r => r.status === 'online' || r.status === 'redirected');
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

      const tryFavicon = (src: string, onErr: () => void, checkNaturalWidth = false) => {
        const img = new Image();
        img.onload = () => {
          clearTimeout(timer);
          finish(checkNaturalWidth ? img.naturalWidth > 16 : true);
        };
        img.onerror = onErr;
        img.src = src;
      };

      tryFavicon(`${parsed.origin}/favicon.ico?_t=${Date.now()}`, () => {
        tryFavicon(`${parsed.origin}/favicon.png?_t=${Date.now()}`, () => {
          tryFavicon(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32&_t=${Date.now()}`, () => {
            clearTimeout(timer);
            finish(false);
          }, true);
        });
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Browser-side reachability and redirect estimate.
 */
export async function pingUrl(
  url: string,
  forceRefresh = false
): Promise<{ status: 'online' | 'offline' | 'redirected'; pingMs?: number; redirectUrl?: string; redirectHost?: string }> {
  if (!forceRefresh) {
    const cached = healthCache.get(url);
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
      return { status: cached.status, pingMs: cached.pingMs, redirectUrl: cached.redirectUrl, redirectHost: cached.redirectHost };
    }
    const inflight = inFlightProbes.get(url);
    if (inflight) return inflight;
  }

  const probeTask = healthCheckQueue.run(async () => {
    const start = performance.now();

    // Probe Edge serverless health function first for redirect detection
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        const edgeRes = await fetch(`/api/health?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3000) });
        if (edgeRes.ok) {
          const data = await edgeRes.json();
          if (data.status === 'online' || data.status === 'redirected') {
            const entry: CachedHealthEntry = {
              status: data.status,
              pingMs: data.pingMs || Math.round(performance.now() - start),
              redirectUrl: data.redirectUrl,
              redirectHost: data.redirectHost,
              checkedAt: Date.now()
            };
            setHealthCache(url, entry);
            return entry;
          }
        }
      }
    } catch { /* fallback to browser probes */ }

    try {
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-cache', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
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
        return {
          url: m.url,
          label: m.label,
          status: res.status,
          pingMs: res.pingMs,
          redirectUrl: res.redirectUrl,
          redirectHost: res.redirectHost
        };
      })
    );

    const live = results.filter(r => r.status === 'online' || r.status === 'redirected');
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
