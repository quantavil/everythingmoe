import { UPSTREAM } from './home';

const UA = 'EverythingMoe-Reskin/3.0 (+https://github.com/quantavil/everythingmoe)';

export interface ProxyOptions {
  ttl?: number;
  headers?: Record<string, string>;
}

export function json(body: unknown, status = 200, ttl = 0): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ttl > 0 ? `public, max-age=${Math.min(ttl, 300)}, s-maxage=${ttl}` : 'no-store'
    }
  });
}

/** First upstream URL that answers 200 with a non-empty body. */
export async function firstOk(paths: string[], opts: ProxyOptions = {}): Promise<string | null> {
  for (const p of paths) {
    try {
      const res = await fetch(p.startsWith('http') ? p : `${UPSTREAM}${p}`, {
        headers: { 'User-Agent': UA, Accept: '*/*', ...opts.headers },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const text = await res.text();
        if (text.trim()) return text;
      }
    } catch {
      /* try the next one */
    }
  }
  return null;
}

export async function proxyJson(paths: string[], ttl: number, emptyFallback?: unknown): Promise<Response> {
  const body = await firstOk(paths);
  if (body) {
    try {
      JSON.parse(body);
      return json(body, 200, ttl);
    } catch {
      /* fall through */
    }
  }
  if (emptyFallback !== undefined) return json(emptyFallback, 200, 60);
  return json({ error: 'Upstream fetch failed' }, 502);
}

interface EdgeContext {
  request: Request;
  waitUntil?: (p: Promise<unknown>) => void;
}

/**
 * Pages Functions responses are not CDN-cached on their own. Use the Workers
 * Cache API when it exists so one upstream fetch serves everyone for `ttl`.
 */
export async function cached(ctx: EdgeContext, produce: () => Promise<Response>): Promise<Response> {
  const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!edge) return produce();
  const key = new Request(ctx.request.url, { method: 'GET' });
  const hit = await edge.match(key);
  if (hit) return hit;
  const res = await produce();
  if (res.ok) {
    const store = edge.put(key, res.clone());
    if (ctx.waitUntil) ctx.waitUntil(store);
    else await store;
  }
  return res;
}
