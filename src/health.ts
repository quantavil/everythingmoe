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
  } catch {}
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
    } catch {}
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

async function probeImage(url: string, timeoutMs = 2500): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const img = new Image();
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        img.onload = img.onerror = null;
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      img.onload = () => { clearTimeout(timer); finish(true); };
      img.onerror = () => {
        const fallbackImg = new Image();
        fallbackImg.onload = () => { clearTimeout(timer); finish(true); };
        fallbackImg.onerror = () => { clearTimeout(timer); finish(false); };
        fallbackImg.src = `${parsed.origin}/favicon.png?_t=${Date.now()}`;
      };
      img.src = `${parsed.origin}/favicon.ico?_t=${Date.now()}`;
    } catch {
      resolve(false);
    }
  });
}

export async function pingUrl(url: string, forceRefresh = false): Promise<{ status: 'online' | 'offline'; pingMs?: number }> {
  if (!forceRefresh) {
    const cached = healthCache.get(url);
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
      return { status: cached.status, pingMs: cached.pingMs };
    }
    if (inFlightProbes.has(url)) return inFlightProbes.get(url)!;
  }

  const probeTask: Promise<{ status: 'online' | 'offline'; pingMs?: number }> = healthCheckQueue.run(async () => {
    const start = performance.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 2500);
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

  if (!forceRefresh) inFlightProbes.set(url, probeTask);
  return probeTask;
}

export async function checkAllMirrorsHealth(altlinks: MirrorLink[], forceRefresh = false): Promise<AllMirrorsCheckResult> {
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
