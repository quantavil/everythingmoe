import { afterEach, describe, expect, test } from 'bun:test';
import { classify, isSafeUrl, onRequest } from '../../functions/api/health';
import { checkUrl, health } from '../health';

describe('edge health guard', () => {
  const safe = (u: string) => isSafeUrl(new URL(u));

  test('allows public hostnames', () => {
    expect(safe('https://example.com/')).toBe(true);
    expect(safe('http://sub.example.co.uk/path?x=1')).toBe(true);
    expect(safe('https://example.com:443/')).toBe(true);
  });

  test('blocks IP literals, internal names, odd ports, credentials and other protocols', () => {
    for (const u of [
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://0x7f.1/',
      'http://2130706433/',
      'http://localhost/',
      'http://intranet/',
      'http://printer.local/',
      'http://db.internal/',
      'https://example.com:8443/',
      'https://user:pass@example.com/',
      'ftp://example.com/',
      'file:///etc/passwd'
    ])
      expect(safe(u)).toBe(false);
  });

  test('a challenge page still counts as alive', () => {
    for (const code of [200, 301, 302, 401, 403, 429, 503]) expect(classify(code)).toBe(true);
    for (const code of [404, 410, 500, 502, 504]) expect(classify(code)).toBe(false);
  });

  test('rejects bad requests before any network call', async () => {
    const call = (qs: string) => onRequest({ request: new Request(`https://x.test/api/health${qs}`) });
    expect((await call('')).status).toBe(400);
    expect((await call('?url=not-a-url')).status).toBe(400);
    expect((await call('?url=http://127.0.0.1/')).status).toBe(400);
  });
});

describe('client health checks', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    health.value = {};
  });

  test('records a probe and answers repeats from cache', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return Response.json({ status: 'online', pingMs: 42 });
    }) as unknown as typeof fetch;
    const first = await checkUrl('https://a.example/');
    const second = await checkUrl('https://a.example/');
    expect(first).toMatchObject({ state: 'online', pingMs: 42 });
    expect(second.state).toBe('online');
    expect(calls).toBe(1);
  });

  test('shares one request between simultaneous checks', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return Response.json({ status: 'offline' });
    }) as unknown as typeof fetch;
    const [a, b] = await Promise.all([checkUrl('https://b.example/'), checkUrl('https://b.example/')]);
    expect(a.state).toBe('offline');
    expect(b.state).toBe('offline');
    expect(calls).toBe(1);
  });

  test('an edge failure is unknown, not offline, and is not cached', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await checkUrl('https://c.example/');
    expect(result.state).toBe('unknown');
    expect(health.value['https://c.example/']).toBeUndefined();
  });
});
