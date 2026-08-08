import { expect, test, describe } from 'bun:test';
import { pingUrl, checkAllMirrorsHealth, getCachedSiteHealth } from '../health';

describe('Health Monitor (src/health.ts)', () => {
  test('checkAllMirrorsHealth returns empty results for empty links', async () => {
    const res = await checkAllMirrorsHealth([]);
    expect(res.liveCount).toBe(0);
    expect(res.totalCount).toBe(0);
    expect(res.mirrors).toEqual([]);
  });

  test('getCachedSiteHealth returns null when links are not cached', () => {
    const res = getCachedSiteHealth([{ label: 'Uncached', url: 'https://uncached-domain-test.xyz' }]);
    expect(res).toBeNull();
  });

  test('pingUrl handles invalid/unreachable URL gracefully without throwing', async () => {
    const res = await pingUrl('https://invalid-non-existent-domain-xyz-123456789.org');
    expect(res.status).toBe('offline');
    expect(res.pingMs).toBeUndefined();
  });

  test('pingUrl supports forceRefresh parameter', async () => {
    const url = 'https://invalid-non-existent-domain-force-refresh.org';
    const res1 = await pingUrl(url, false);
    expect(res1.status).toBe('offline');
    const res2 = await pingUrl(url, true);
    expect(res2.status).toBe('offline');
  });

  test('getCachedSiteHealth returns valid health results when cached', async () => {
    const url = 'https://cached-test-domain.org';
    await pingUrl(url, true);
    const cachedRes = getCachedSiteHealth([{ label: 'Test Cached', url }]);
    expect(cachedRes).not.toBeNull();
    expect(cachedRes?.totalCount).toBe(1);
    expect(cachedRes?.liveCount).toBe(0);
  });
});

