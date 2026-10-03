import { cached, proxyJson } from '../../src/shared/proxy';

type Ctx = Parameters<typeof cached>[0];

/** Per-site details (pros, cons, note, mirrors) keyed by site id. */
export const onRequest = (ctx: Ctx) => cached(ctx, () => proxyJson(['/data/cache/main.json'], 600));
