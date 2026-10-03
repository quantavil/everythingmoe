import { cached, proxyJson } from '../../src/shared/proxy';

type Ctx = Parameters<typeof cached>[0];

/** Comment thread counts keyed by "/s/{id}". Threads themselves live upstream. */
export const onRequest = (ctx: Ctx) => cached(ctx, () => proxyJson(['/comments/threadcount.json'], 600, {}));
