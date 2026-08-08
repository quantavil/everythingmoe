function isSafeUrl(targetUrl: URL): boolean {
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return false;
  const hostname = targetUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const [, a, b] = match.map(Number);
    if (a === 0 || a === 127) return false;
    if (a === 10) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
  }

  if (hostname === '[::1]' || hostname === '::1' || hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) {
    return false;
  }

  return true;
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const urlParam = new URL(context.request.url).searchParams.get('url');
  if (!urlParam) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), { status: 400 });
  }

  try {
    const targetUrl = new URL(urlParam);
    if (!isSafeUrl(targetUrl)) {
      return new Response(JSON.stringify({ error: 'Invalid or restricted URL target' }), { status: 400 });
    }

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    const pingMs = Date.now() - start;
    const finalUrl = res.url ? new URL(res.url) : targetUrl;
    const isRedirected = res.redirected || finalUrl.hostname.toLowerCase() !== targetUrl.hostname.toLowerCase();

    if (res.ok || res.status < 400) {
      return new Response(JSON.stringify({
        status: isRedirected ? 'redirected' : 'online',
        pingMs,
        redirectUrl: isRedirected ? res.url : undefined,
        redirectHost: isRedirected ? finalUrl.hostname : undefined
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, s-maxage=600',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch {
    /* fallback */
  }

  return new Response(JSON.stringify({ status: 'offline' }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
