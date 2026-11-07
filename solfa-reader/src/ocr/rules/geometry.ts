// Plain-data geometry shared by the OCR rules. Pure: no DOM, runs in node tests.

/** Axis-aligned box in pixels; x1/y1 are exclusive. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Binary image, row-major, 1 = ink, 0 = paper. */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Grey image, row-major, 0 = black … 255 = white. */
export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** A connected component of ink pixels. */
export interface Component extends Box {
  /** Label in the label image (1-based). */
  id: number;
  /** Number of ink pixels. */
  area: number;
}

/** Box width. */
export const bw = (b: Box): number => b.x1 - b.x0;
/** Box height. */
export const bh = (b: Box): number => b.y1 - b.y0;
/** Horizontal centre. */
export const cx = (b: Box): number => (b.x0 + b.x1) / 2;
/** Vertical centre. */
export const cy = (b: Box): number => (b.y0 + b.y1) / 2;

/** Smallest box containing both boxes. */
export function union(a: Box, b: Box): Box {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

/** Union of many boxes (null for an empty list). */
export function unionAll(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  let u: Box = { x0: boxes[0].x0, y0: boxes[0].y0, x1: boxes[0].x1, y1: boxes[0].y1 };
  for (let i = 1; i < boxes.length; i++) u = union(u, boxes[i]);
  return u;
}

/** Length of the horizontal overlap (0 when apart). */
export function xOverlap(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
}

/** Length of the vertical overlap (0 when apart). */
export function yOverlap(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
}

/** Copy of a box grown by `m` on every side. */
export function grow(b: Box, m: number): Box {
  return { x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m };
}

/** Quantile (0..1) of a list of numbers, linear interpolation; NaN for an empty list. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = Math.min(1, Math.max(0, q)) * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Median of a list of numbers; NaN for an empty list. */
export const median = (values: readonly number[]): number => quantile(values, 0.5);

/** Median where each value counts `weight` times (weights > 0). */
export function weightedMedian(values: readonly number[], weights: readonly number[]): number {
  if (values.length === 0) return NaN;
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  for (const i of idx) {
    acc += weights[i];
    if (acc >= total / 2) return values[i];
  }
  return values[idx[idx.length - 1]];
}

/**
 * Split values into a low and a high group (1-D 2-means). Returns the group means and the
 * threshold between them; `separated` is false when the groups are not clearly distinct.
 */
export function twoMeans(values: readonly number[], minRatio = 1.2): {
  low: number;
  high: number;
  threshold: number;
  separated: boolean;
} {
  if (values.length === 0) return { low: NaN, high: NaN, threshold: NaN, separated: false };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) return { low: lo, high: hi, threshold: lo, separated: false };
  for (let it = 0; it < 20; it++) {
    const t = (lo + hi) / 2;
    const a = values.filter((v) => v <= t);
    const b = values.filter((v) => v > t);
    if (a.length === 0 || b.length === 0) break;
    const nlo = median(a);
    const nhi = median(b);
    if (nlo === lo && nhi === hi) break;
    lo = nlo;
    hi = nhi;
  }
  return { low: lo, high: hi, threshold: (lo + hi) / 2, separated: hi >= lo * minRatio };
}

/** A point transform from the working image back to the caller's canvas. */
export interface WorkTransform {
  /** working-before-rotation = source × scale */
  scale: number;
  /** The working image is the scaled image rotated by -angleDeg around its centre. */
  angleDeg: number;
  /** Size of the scaled (unrotated) image. */
  scaledW: number;
  scaledH: number;
  /** Size of the working (rotated, expanded) image. */
  workW: number;
  workH: number;
}

/** Identity-like transform for an image used as is. */
export function identityTransform(w: number, h: number): WorkTransform {
  return { scale: 1, angleDeg: 0, scaledW: w, scaledH: h, workW: w, workH: h };
}

/** Map a point of the working image back to the source canvas. */
export function workPointToSource(x: number, y: number, t: WorkTransform): { x: number; y: number } {
  // The working image was produced by rotating by -angle: undo with +angle.
  const a = (t.angleDeg * Math.PI) / 180;
  const dx = x - t.workW / 2;
  const dy = y - t.workH / 2;
  const sx = dx * Math.cos(a) - dy * Math.sin(a) + t.scaledW / 2;
  const sy = dx * Math.sin(a) + dy * Math.cos(a) + t.scaledH / 2;
  return { x: sx / t.scale, y: sy / t.scale };
}

/** Map a box of the working image to the enclosing box in the source canvas (clamped). */
export function workBoxToSource(b: Box, t: WorkTransform, srcW: number, srcH: number): Box {
  const pts = [
    workPointToSource(b.x0, b.y0, t),
    workPointToSource(b.x1, b.y0, t),
    workPointToSource(b.x0, b.y1, t),
    workPointToSource(b.x1, b.y1, t),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  return {
    x0: clamp(Math.floor(Math.min(...xs)), srcW),
    y0: clamp(Math.floor(Math.min(...ys)), srcH),
    x1: clamp(Math.ceil(Math.max(...xs)), srcW),
    y1: clamp(Math.ceil(Math.max(...ys)), srcH),
  };
}
