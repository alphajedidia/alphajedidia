// Connected components of a binary image + page-level filters (ruled lines, speckles).
import { bh, bw, weightedMedian, type Bitmap, type Box, type Component } from './geometry';

/** Result of labelling: the components and the label image (0 = paper). */
export interface Labelled {
  components: Component[];
  labels: Int32Array;
  width: number;
  height: number;
}

/** 8-connected component labelling (two passes with union-find). */
export function labelComponents(b: Bitmap): Labelled {
  const { width: w, height: h, data } = b;
  const labels = new Int32Array(w * h);
  let parent = new Int32Array(1024);
  let next = 1;
  const find = (a: number): number => {
    let r = a;
    while (parent[r] !== r) r = parent[r];
    while (parent[a] !== r) {
      const n = parent[a];
      parent[a] = r;
      a = n;
    }
    return r;
  };
  const unite = (a: number, b2: number): number => {
    const ra = find(a);
    const rb = find(b2);
    if (ra === rb) return ra;
    if (ra < rb) {
      parent[rb] = ra;
      return ra;
    }
    parent[ra] = rb;
    return rb;
  };
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      if (!data[o + x]) continue;
      let l = 0;
      // neighbours already visited: W, NW, N, NE
      const cand: number[] = [];
      if (x > 0 && labels[o + x - 1]) cand.push(labels[o + x - 1]);
      if (y > 0) {
        const p = o - w;
        if (x > 0 && labels[p + x - 1]) cand.push(labels[p + x - 1]);
        if (labels[p + x]) cand.push(labels[p + x]);
        if (x + 1 < w && labels[p + x + 1]) cand.push(labels[p + x + 1]);
      }
      if (cand.length === 0) {
        if (next >= parent.length) {
          const np = new Int32Array(parent.length * 2);
          np.set(parent);
          parent = np;
        }
        parent[next] = next;
        l = next++;
      } else {
        l = cand[0];
        for (let i = 1; i < cand.length; i++) l = unite(l, cand[i]);
        l = find(l);
      }
      labels[o + x] = l;
    }
  }
  // Second pass: resolve roots to compact ids and measure the components.
  const remap = new Int32Array(next);
  const comps: Component[] = [];
  for (let i = 1; i < next; i++) {
    const r = find(i);
    if (remap[r] === 0) {
      comps.push({ id: comps.length + 1, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, area: 0 });
      remap[r] = comps.length;
    }
    remap[i] = remap[r];
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const l = labels[o + x];
      if (!l) continue;
      const id = remap[l];
      labels[o + x] = id;
      const c = comps[id - 1];
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (y < c.y0) c.y0 = y;
      if (x + 1 > c.x1) c.x1 = x + 1;
      if (y + 1 > c.y1) c.y1 = y + 1;
    }
  }
  return { components: comps, labels, width: w, height: h };
}

/**
 * Typical character height on the page: area-weighted median height of non-tiny components.
 * Weighting by area keeps the many small colon dots from dominating.
 */
export function estimateCharHeight(comps: readonly Component[]): number {
  const sel = comps.filter((c) => c.area >= 6 && bh(c) >= 3);
  if (sel.length === 0) return 0;
  // Ignore very large blobs (pictures, ruled lines) when weighting.
  const hs = sel.map((c) => bh(c));
  const ws = sel.map((c) => Math.min(c.area, 4 * bh(c) * bh(c)));
  return weightedMedian(hs, ws);
}

/** Page-level split of components into ruled lines, speckles and the rest. */
export interface PageSplit {
  /** Long thin vertical lines (graphic bar lines spanning one or more rows). */
  vertical: Component[];
  /** Long thin horizontal lines (rules, underlines, frames). */
  horizontal: Component[];
  /** Tiny speckles (noise). */
  noise: Component[];
  /** Everything else (letters, separators, marks). */
  rest: Component[];
}

/** Separate ruled lines and speckles from text, given the typical character height. */
export function splitPageComponents(comps: readonly Component[], charH: number, loose = 1): PageSplit {
  const out: PageSplit = { vertical: [], horizontal: [], noise: [], rest: [] };
  const minNoise = Math.max(2, (charH * charH) / 400) * loose;
  for (const c of comps) {
    const w = bw(c);
    const h = bh(c);
    if (c.area < minNoise && Math.max(w, h) < Math.max(3, charH * 0.12)) out.noise.push(c);
    else if (h >= 2.6 * charH && w <= Math.max(3, 0.35 * charH) && c.area >= 0.5 * h) out.vertical.push(c);
    // The heavy stroke of a ruled final double bar is wider but solid.
    else if (h >= 3.5 * charH && w <= 0.7 * charH && c.area >= 0.85 * w * h) out.vertical.push(c);
    // Long thin pieces: rules, pieces of table lines (a hold dash is at most ~1.5 x-heights).
    else if (w >= 3 * charH && h <= Math.max(3, 0.3 * charH)) out.horizontal.push(c);
    else out.rest.push(c);
  }
  return out;
}

/** Ink fill ratio of a component inside its box (0..1). */
export function fillRatio(c: Component): number {
  const a = bw(c) * bh(c);
  return a > 0 ? c.area / a : 0;
}

/** Count ink pixels of component `id` inside a box (used for shape features). */
export function inkIn(l: Labelled, id: number, box: Box): number {
  let n = 0;
  const x0 = Math.max(0, box.x0);
  const y0 = Math.max(0, box.y0);
  const x1 = Math.min(l.width, box.x1);
  const y1 = Math.min(l.height, box.y1);
  for (let y = y0; y < y1; y++) {
    const o = y * l.width;
    for (let x = x0; x < x1; x++) if (l.labels[o + x] === id) n++;
  }
  return n;
}
