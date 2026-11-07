// Crop rectangle maths for the scan "crop" step (pure: image pixel space, no DOM).

export interface QuadPoint {
  x: number;
  y: number;
}

/** Four corners in the order the OCR expects: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [QuadPoint, QuadPoint, QuadPoint, QuadPoint];

export const CORNER_KEYS = ['tl', 'tr', 'br', 'bl'] as const;
export type CornerKey = (typeof CORNER_KEYS)[number];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** The whole image. */
export function fullQuad(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

/** Rectangle inset by `f` of each side (fallback when the page outline is not found). */
export function insetQuad(width: number, height: number, f = 0.04): Quad {
  const dx = width * f;
  const dy = height * f;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

/** Twice the signed area of triangle (a, b, c). */
function cross(a: QuadPoint, b: QuadPoint, c: QuadPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** True when the corners make a convex, clockwise (on screen) quadrilateral of usable size. */
export function isValidQuad(q: readonly QuadPoint[], minSide = 1): boolean {
  if (q.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    const c = q[(i + 2) % 4]!;
    if (cross(a, b, c) <= 0) return false;
    if (Math.hypot(b.x - a.x, b.y - a.y) < minSide) return false;
  }
  return true;
}

/** Smallest side of the crop, in image pixels (a few characters). */
export function minCropSide(width: number, height: number): number {
  return Math.max(16, Math.round(Math.min(width, height) * 0.08));
}

/** Move corner `i` to (x, y) inside the image; a move that would fold the shape is refused. */
export function moveQuadCorner(q: Quad, i: number, x: number, y: number, width: number, height: number): Quad {
  const next = q.map((p, j) => (j === i ? { x: Math.round(clamp(x, 0, width)), y: Math.round(clamp(y, 0, height)) } : p)) as Quad;
  return isValidQuad(next, minCropSide(width, height)) ? next : q;
}

/** True when the quad is (almost) the whole image: no need to warp a copy. */
export function isFullQuad(q: readonly QuadPoint[], width: number, height: number): boolean {
  const full = fullQuad(width, height);
  return q.every((p, i) => Math.abs(p.x - full[i]!.x) <= 2 && Math.abs(p.y - full[i]!.y) <= 2);
}

/** Free a canvas's pixel memory now (phones keep large canvases alive until GC). */
export function releaseCanvas(c: HTMLCanvasElement | null | undefined): void {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

/** Weighted overall progress of the reading stages, 0..1. */
export const STAGE_ORDER = ['preprocessing', 'loading-engine', 'recognizing', 'analyzing'] as const;
export type ReadStage = (typeof STAGE_ORDER)[number];
const STAGE_SPAN: Record<ReadStage, [number, number]> = {
  preprocessing: [0, 0.15],
  'loading-engine': [0.15, 0.35],
  recognizing: [0.35, 0.92],
  analyzing: [0.92, 1],
};

/** Overall progress from the current stage and its own 0..1 progress. */
export function overallProgress(stage: ReadStage | 'done', progress: number): number {
  if (stage === 'done') return 1;
  const [a, b] = STAGE_SPAN[stage];
  return a + (b - a) * clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
}
