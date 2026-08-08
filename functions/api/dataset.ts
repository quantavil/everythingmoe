export async function onRequest(): Promise<Response> {
  const upstreamUrls = [
    'https://everythingmoe.com/dataset.json',
    'https://everythingmoe.com/data/cache/main.json'
  ];

  for (const url of upstreamUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'EverythingMoe-Cloudflare-Pages/2.0',
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const body = await res.text();
        return new Response(body, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, s-maxage=600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch {}
  }

  return new Response(JSON.stringify({ error: 'Upstream dataset fetch failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' }
  });
}
