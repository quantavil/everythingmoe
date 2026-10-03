import uFuzzy from '@leeoniya/ufuzzy';
import type { Detail, Item } from './shared/home';

export interface Doc {
  sectionId: string;
  item: Item;
  /** Everything else worth matching: tags, facets, domains and notes. */
  text: string;
}

export interface Hit {
  doc: Doc;
  /** Character ranges to highlight in the item name, as [start, end, start, end...]. */
  ranges: number[] | null;
}

const fuzzy = new uFuzzy({ intraMode: 1, intraIns: 1 });

export function buildDoc(sectionId: string, item: Item, detail?: Detail): Doc {
  const bits = [item.name, ...item.tags, ...item.filters];
  if (item.url) bits.push(item.url);
  if (detail) {
    bits.push(...detail.positive, ...detail.negative, detail.note);
    for (const m of detail.mirrors) bits.push(m.label, m.url);
  }
  return { sectionId, item, text: bits.join(' ') };
}

/** Name matches first (best match first), then matches found anywhere else. */
export function searchDocs(docs: Doc[], query: string): Hit[] {
  const needle = query.trim();
  if (!needle) return [];
  const hits: Hit[] = [];
  const seen = new Set<number>();

  const names = docs.map((d) => d.item.name);
  const [idxs, info, order] = fuzzy.search(names, needle);
  if (idxs && info && order) {
    for (const o of order) {
      const i = info.idx[o];
      seen.add(i);
      hits.push({ doc: docs[i], ranges: info.ranges[o] });
    }
  } else if (idxs) {
    for (const i of idxs) {
      seen.add(i);
      hits.push({ doc: docs[i], ranges: null });
    }
  }

  const [rest, restInfo, restOrder] = fuzzy.search(
    docs.map((d) => d.text),
    needle
  );
  if (rest) {
    const ordered = restInfo && restOrder ? restOrder.map((o) => restInfo.idx[o]) : rest;
    for (const i of ordered) if (!seen.has(i)) hits.push({ doc: docs[i], ranges: null });
  }
  return hits;
}

/** Split text into alternating plain / matched pieces. */
export function splitByRanges(text: string, ranges: number[] | null): Array<{ text: string; hit: boolean }> {
  if (!ranges || !ranges.length) return [{ text, hit: false }];
  const out: Array<{ text: string; hit: boolean }> = [];
  let at = 0;
  for (let i = 0; i < ranges.length; i += 2) {
    const [start, end] = [ranges[i], ranges[i + 1]];
    if (start > at) out.push({ text: text.slice(at, start), hit: false });
    out.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}
