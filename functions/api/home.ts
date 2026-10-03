import { type MenuEntry, parseHome, UPSTREAM } from '../../src/shared/home';
import { cached, firstOk, json } from '../../src/shared/proxy';

type Ctx = Parameters<typeof cached>[0];

/**
 * Ranked lists only exist in upstream's server-rendered page, so we read that
 * page once, cache it at the edge, and hand the client plain JSON.
 */
export function onRequest(ctx: Ctx): Promise<Response> {
  return cached(ctx, () => build(ctx.request));
}

async function build(request: Request): Promise<Response> {
  const nsfw = new URL(request.url).searchParams.get('nsfw') === '1';
  const [html, menuRaw] = await Promise.all([
    firstOk(['/'], nsfw ? { headers: { Cookie: 'nsfw=true' } } : {}),
    firstOk(['/data/cache/menu.json'])
  ]);
  if (!html) return json({ error: 'Upstream page unavailable' }, 502);

  let menu: MenuEntry[] = [];
  try {
    menu = menuRaw ? JSON.parse(menuRaw) : [];
  } catch {
    /* menu is optional */
  }

  const sections = parseHome(html, menu);
  if (!sections.length) return json({ error: 'Upstream layout changed' }, 502);
  return json({ sections, menu, source: UPSTREAM }, 200, 300);
}
