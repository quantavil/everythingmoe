const MODERN_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300, s-maxage=600'
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function isSafeUrl(targetUrl: URL): boolean {
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return false;
  const hostname = targetUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;

  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (match) {
    const [, a, b] = match.map(Number);
    if (a === 0 || a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
      return false;
    }
  }

  if (hostname === '[::1]' || hostname === '::1' || hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) {
    return false;
  }

  return true;
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const urlParam = new URL(context.request.url).searchParams.get('url');
  if (!urlParam) {
    return jsonResponse({ error: 'Missing url param' }, 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
    if (!isSafeUrl(targetUrl)) {
      return jsonResponse({ error: 'Invalid or restricted URL target' }, 400);
    }
  } catch {
    return jsonResponse({ error: 'Invalid or restricted URL target' }, 400);
  }

  const start = Date.now();

  // 1. Direct Edge probe with modern Chrome 133 User-Agent & manual redirect capture
  try {
    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': MODERN_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Sec-Ch-Ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      },
      signal: AbortSignal.timeout(3500)
    });

    const pingMs = Date.now() - start;
    const locationHeader = res.headers.get('location');
    let redirectUrl: string | undefined;
    let redirectHost: string | undefined;
    let isRedirected = false;

    if (locationHeader) {
      try {
        const resolved = new URL(locationHeader, targetUrl);
        redirectUrl = resolved.toString();
        redirectHost = resolved.hostname;
        if (redirectHost.toLowerCase() !== targetUrl.hostname.toLowerCase()) {
          isRedirected = true;
        }
      } catch { /* ignore malformed location */ }
    } else if (res.redirected) {
      const finalUrl = res.url ? new URL(res.url) : targetUrl;
      redirectUrl = res.url;
      redirectHost = finalUrl.hostname;
      if (finalUrl.hostname.toLowerCase() !== targetUrl.hostname.toLowerCase()) {
        isRedirected = true;
      }
    }

    if (res.ok || (res.status >= 300 && res.status < 400) || res.status === 403 || res.status === 503) {
      return jsonResponse({
        status: isRedirected ? 'redirected' : 'online',
        pingMs,
        redirectUrl: isRedirected ? redirectUrl : undefined,
        redirectHost: isRedirected ? redirectHost : undefined
      });
    }
  } catch {
    /* Direct edge probe failed / connection reset — try Google S2 Favicon CDN fallback */
  }

  // 2. Google S2 Favicon CDN fallback probe
  try {
    const favRes = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(targetUrl.hostname)}&sz=32`, {
      signal: AbortSignal.timeout(2500)
    });
    if (favRes.ok) {
      return jsonResponse({
        status: 'online',
        pingMs: Date.now() - start
      });
    }
  } catch {
    /* Fallback failed */
  }

  return jsonResponse({ status: 'offline' });
}

