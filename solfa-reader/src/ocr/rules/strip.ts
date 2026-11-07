// "Letter strip": the note clusters of a row, cut out of the page (only their own pixels,
// without separators and small marks) and laid out with wide gaps, so the text engine reads
// each note as a separate word and cannot confuse it with `:` `|` `.` `,` around it.
import type { Labelled } from './components';
import { bh, bw, type Bitmap, type Box } from './geometry';
import type { RowMetrics } from './symbols';

export interface StripCluster {
  box: Box;
  /** Component ids (labels) that belong to the cluster. */
  ids: number[];
}

export interface StripPlacement {
  /** Index of the cluster in the input list. */
  index: number;
  src: Box;
  /** Position in the strip (same scale as the page). */
  dst: Box;
}

export interface StripPlan {
  width: number;
  height: number;
  placements: StripPlacement[];
}

/** Build the strip bitmap for one row. */
export function composeStrip(
  lab: Labelled,
  clusters: readonly StripCluster[],
  m: RowMetrics,
): { bitmap: Bitmap; plan: StripPlan } {
  const xh = Math.max(2, m.xHeight);
  const gap = Math.round(1.3 * xh);
  const pad = Math.round(0.8 * xh);
  const above = Math.max(m.ascHeight * 1.25, ...clusters.map((c) => m.baseline - c.box.y0));
  const below = Math.max(0.3 * xh, ...clusters.map((c) => c.box.y1 - m.baseline));
  const base = Math.ceil(pad + above);
  const height = Math.ceil(base + below + pad);
  const placements: StripPlacement[] = [];
  let cursor = pad;
  clusters.forEach((c, index) => {
    const w = bw(c.box);
    const dy = base - (m.baseline - c.box.y0);
    placements.push({ index, src: c.box, dst: { x0: cursor, y0: Math.round(dy), x1: cursor + w, y1: Math.round(dy) + bh(c.box) } });
    cursor += w + gap;
  });
  const width = Math.max(1, cursor - gap + pad);
  const data = new Uint8Array(width * height);
  for (const p of placements) {
    const ids = new Set(clusters[p.index].ids);
    for (let y = p.src.y0; y < p.src.y1; y++) {
      const ty = p.dst.y0 + (y - p.src.y0);
      if (ty < 0 || ty >= height || y < 0 || y >= lab.height) continue;
      for (let x = p.src.x0; x < p.src.x1; x++) {
        if (x < 0 || x >= lab.width) continue;
        if (ids.has(lab.labels[y * lab.width + x])) data[ty * width + p.dst.x0 + (x - p.src.x0)] = 1;
      }
    }
  }
  return { bitmap: { width, height, data }, plan: { width, height, placements } };
}

/** A recognised character with its box in strip pixels (after the adapter's scaling). */
export interface StripSymbol {
  text: string;
  /** 0..100 as reported by Tesseract. */
  confidence: number;
  box: Box;
}

/** Reading of one cluster. Empty text when the engine returned nothing for it. */
export interface ClusterReading {
  text: string;
  /** 0..1 */
  conf: number;
}

/** Attribute recognised symbols to the clusters they overlap (strip was scaled by `scale`). */
export function assignReadings(plan: StripPlan, symbols: readonly StripSymbol[], scale = 1): ClusterReading[] {
  const parts: { x: number; text: string; conf: number }[][] = plan.placements.map(() => []);
  for (const s of symbols) {
    const t = s.text.trim();
    if (!t) continue;
    const x0 = s.box.x0 / scale;
    const x1 = s.box.x1 / scale;
    const mid = (x0 + x1) / 2;
    let best = -1;
    let bestScore = -Infinity;
    plan.placements.forEach((p, i) => {
      const ov = Math.max(0, Math.min(x1, p.dst.x1) - Math.max(x0, p.dst.x0));
      const dist = mid < p.dst.x0 ? p.dst.x0 - mid : mid > p.dst.x1 ? mid - p.dst.x1 : 0;
      const score = ov > 0 ? ov : -dist;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    const p = plan.placements[best];
    if (best >= 0 && bestScore > -0.6 * bh(p.src)) parts[best].push({ x: mid, text: t, conf: s.confidence / 100 });
  }
  return parts.map((ps) => {
    if (ps.length === 0) return { text: '', conf: 0 };
    ps.sort((a, b) => a.x - b.x);
    return { text: ps.map((p) => p.text).join(''), conf: Math.min(...ps.map((p) => p.conf)) };
  });
}
