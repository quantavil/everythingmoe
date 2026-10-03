import type { Home } from './shared/home';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchHome = (nsfw: boolean) => getJson<Home>(nsfw ? '/api/home?nsfw=1' : '/api/home');
export const fetchDetails = () => getJson<Record<string, unknown>>('/api/dataset');
export const fetchLow = (lowId: string) => getJson<unknown>(`/api/lowsec?sec=${encodeURIComponent(lowId)}`);
export const fetchComments = () => getJson<Record<string, number>>('/api/comments');
