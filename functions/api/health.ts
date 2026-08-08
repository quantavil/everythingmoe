export async function onRequest(context: { request: Request }): Promise<Response> {
  const urlParam = new URL(context.request.url).searchParams.get('url');
  if (!urlParam) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), { status: 400 });
  }

  try {
    const targetUrl = new URL(urlParam);
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
    const finalUrl = new URL(res.url);
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
