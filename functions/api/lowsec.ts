import { cached, json, proxyJson } from '../../src/shared/proxy';

type Ctx = Parameters<typeof cached>[0];

export function onRequest(ctx: Ctx): Promise<Response> | Response {
  const sec = new URL(ctx.request.url).searchParams.get('sec') ?? '';
  if (!/^[a-z0-9_-]{1,32}$/i.test(sec)) return json({ error: 'Invalid section' }, 400);
  return cached(ctx, () => proxyJson([`/data/lowsec/${sec}.json`], 600, []));
}
