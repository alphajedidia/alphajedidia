// Perspective (keystone) correction and page-outline detection (X-15). Pure: works on plain
// RGBA buffers and bitmaps; the canvas adapter is in ../image.ts.
import type { Bitmap } from './geometry';
import { labelComponents } from './components';

export interface Point {
  x: number;
  y: number;
}

/** 3×3 homography, row-major. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Solve the homography mapping 4 source points to 4 destination points (null if degenerate). */
export function homography(src: readonly Point[], dst: readonly Point[]): Homography | null {
  // 8 equations, unknowns h0..h7 (h8 = 1); Gaussian elimination with partial pivoting.
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-10) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const h = A.map((row, i) => row[8] / row[i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Apply a homography to a point. */
export function applyHomography(H: Homography, p: Point): Point {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output size for straightening a quad (top-left, top-right, bottom-right, bottom-left). */
export function quadSize(q: readonly Point[]): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((dist(q[0], q[1]) + dist(q[3], q[2])) / 2)),
    height: Math.max(1, Math.round((dist(q[0], q[3]) + dist(q[1], q[2])) / 2)),
  };
}

/**
 * Straighten the quad `q` (TL, TR, BR, BL) of an RGBA image into a width×height rectangle
 * (inverse mapping, bilinear sampling, white outside the source).
 */
export function warpRgba(
  src: Uint8ClampedArray | Uint8Array,
  sw: number,
  sh: number,
  q: readonly Point[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const rect = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const H = homography(rect, q);
  if (!H) return out.fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = applyHomography(H, { x: x + 0.5, y: y + 0.5 });
      const fx = p.x - 0.5;
      const fy = p.y - 0.5;
      const o = (y * width + x) * 4;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= sw || y0 + 1 >= sh) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 255;
        continue;
      }
      const tx = fx - x0;
      const ty = fy - y0;
      for (let k = 0; k < 4; k++) {
        const a = src[(y0 * sw + x0) * 4 + k];
        const b = src[(y0 * sw + x0 + 1) * 4 + k];
        const c = src[((y0 + 1) * sw + x0) * 4 + k];
        const d = src[((y0 + 1) * sw + x0 + 1) * 4 + k];
        out[o + k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
      }
    }
  }
  return out;
}

/**
 * Find the page outline in a small "paper" mask (1 = bright paper): the largest component,
 * its 4 extreme corners. Returns null when no page-like region (≥ 20 % of the image) exists.
 */
export function findPageQuad(paper: Bitmap): { corners: Point[]; coverage: number } | null {
  const lab = labelComponents(paper);
  let best = lab.components[0];
  for (const c of lab.components) if (!best || c.area > best.area) best = c;
  if (!best) return null;
  const coverage = best.area / (paper.width * paper.height);
  if (coverage < 0.2) return null;
  let tl = { x: 0, y: 0, s: Infinity };
  let br = { x: 0, y: 0, s: -Infinity };
  let tr = { x: 0, y: 0, s: -Infinity };
  let bl = { x: 0, y: 0, s: Infinity };
  for (let y = best.y0; y < best.y1; y++) {
    for (let x = best.x0; x < best.x1; x++) {
      if (lab.labels[y * paper.width + x] !== best.id) continue;
      const s = x + y;
      const d = x - y;
      if (s < tl.s) tl = { x, y, s };
      if (s > br.s) br = { x: x + 1, y: y + 1, s };
      if (d > tr.s) tr = { x: x + 1, y, s: d };
      if (d < bl.s) bl = { x, y: y + 1, s: d };
    }
  }
  const corners = [tl, tr, br, bl].map(({ x, y }) => ({ x, y }));
  // A page that runs off the photo (or merges with other sheets behind it) has corners on the
  // border: its outline is unknown, so do not guess.
  const mx = 0.01 * paper.width + 1;
  const my = 0.01 * paper.height + 1;
  const onBorder = corners.filter((p) => p.x <= mx || p.y <= my || p.x >= paper.width - mx || p.y >= paper.height - my);
  if (onBorder.length > 0) return null;
  // Must be a convex quadrilateral (cross products of consecutive edges share one sign).
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const c = corners[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (z === 0 || (sign !== 0 && Math.sign(z) !== sign)) return null;
    sign = Math.sign(z);
  }
  return { corners, coverage };
}
