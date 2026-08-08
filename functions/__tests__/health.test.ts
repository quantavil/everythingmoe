import { expect, test, describe } from 'bun:test';
import { onRequest } from '../api/health';

describe('Cloudflare Pages Function: health.ts', () => {
  test('returns 400 error when url param is missing', async () => {
    const request = new Request('https://everythingmoe.com/api/health');
    const response = await onRequest({ request });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Missing url param' });
  });

  test('blocks SSRF targets: localhost, loopback, private IPv4, metadata IPs, non-http schemes', async () => {
    const maliciousUrls = [
      'http://localhost:8080',
      'http://127.0.0.1:8000',
      'http://10.0.0.1',
      'http://172.16.0.1',
      'http://192.168.1.1',
      'http://169.254.169.254/latest/meta-data/',
      'ftp://example.com',
      'file:///etc/passwd'
    ];

    for (const target of maliciousUrls) {
      const request = new Request(`https://everythingmoe.com/api/health?url=${encodeURIComponent(target)}`);
      const response = await onRequest({ request });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: 'Invalid or restricted URL target' });
    }
  });

  test('allows safe public https URL targets', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(new Response('OK', { status: 200 }))
    ) as unknown as typeof fetch;

    try {
      const request = new Request('https://everythingmoe.com/api/health?url=https://example.com');
      const response = await onRequest({ request });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('online');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('recognizes Cloudflare 403 challenge targets like animepahe as online', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(new Response('Cloudflare Challenge', { status: 403 }))
    ) as unknown as typeof fetch;

    try {
      const request = new Request('https://everythingmoe.com/api/health?url=https://animepahe.com');
      const response = await onRequest({ request });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('online');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('verifies anikoto mirror links respond online', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(new Response('Anichi Home', { status: 200 }))
    ) as unknown as typeof fetch;

    try {
      const request = new Request('https://everythingmoe.com/api/health?url=https://anichi.to/home');
      const response = await onRequest({ request });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('online');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('correctly identifies 301 redirects such as animepahe.com -> animepahe.pw', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(new Response(null, {
        status: 301,
        headers: { Location: 'https://animepahe.pw/' }
      }))
    ) as unknown as typeof fetch;

    try {
      const request = new Request('https://everythingmoe.com/api/health?url=https://animepahe.com');
      const response = await onRequest({ request });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('redirected');
      expect(body.redirectHost).toBe('animepahe.pw');
      expect(body.redirectUrl).toBe('https://animepahe.pw/');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
