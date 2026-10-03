import { json } from '../../src/shared/proxy';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

/** Public hostnames only: no IP literals, no single-label or internal names, ports 80/443. */
export function isSafeUrl(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== '80' && u.port !== '443') return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host.includes(':') || host.startsWith('[')) return false;
  if (/^[\d.]+$/.test(host) || /^0x/i.test(host)) return false;
  if (/(^|\.)(localhost|local|localdomain|internal|lan|home|corp|intranet|arpa)$/.test(host)) return false;
  return true;
}

export interface Probe {
  status: 'online' | 'redirected' | 'offline';
  code?: number;
  pingMs?: number;
  redirectHost?: string;
}

/** A 403/503 from a CDN challenge page still means the host is alive. */
export function classify(code: number): boolean {
  return (code >= 200 && code < 400) || code === 401 || code === 403 || code === 429 || code === 503;
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const raw = new URL(context.request.url).searchParams.get('url');
  if (!raw) return json({ error: 'Missing url param' }, 400);

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return json({ error: 'Invalid url' }, 400);
  }
  if (!isSafeUrl(target)) return json({ error: 'URL not allowed' }, 400);

  const start = Date.now();
  try {
    const res = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8' },
      signal: AbortSignal.timeout(4000)
    });
    const pingMs = Date.now() - start;
    void res.body?.cancel();

    let redirectHost: string | undefined;
    const location = res.headers.get('location');
    if (location) {
      try {
        const next = new URL(location, target);
        if (next.hostname.replace(/^www\./, '') !== target.hostname.replace(/^www\./, '')) redirectHost = next.hostname;
      } catch {
        /* malformed Location header */
      }
    }

    const probe: Probe = classify(res.status)
      ? { status: redirectHost ? 'redirected' : 'online', code: res.status, pingMs, redirectHost }
      : { status: 'offline', code: res.status };
    return json(probe, 200, 120);
  } catch {
    return json({ status: 'offline' } satisfies Probe, 200, 60);
  }
}
