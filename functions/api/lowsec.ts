export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const sec = url.searchParams.get('sec') || 'anime';
  const cleanSec = sec.replace(/[^a-z0-9_-]/gi, '');

  const upstreamUrls = [
    `https://everythingmoe.com/lowsec/${cleanSec}.json`,
    `https://everythingmoe.com/data/lowsec/${cleanSec}.json`
  ];

  for (const upstream of upstreamUrls) {
    try {
      const res = await fetch(upstream, {
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

  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
