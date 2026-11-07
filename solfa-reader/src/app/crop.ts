// Crop rectangle maths for the scan "crop" step (pure: image pixel space, no DOM).

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** Smallest crop side, in image pixels (a few characters). */
export function minCropSide(width: number, height: number): number {
  return Math.max(16, Math.round(Math.min(width, height) * 0.08));
}

/** The whole image. */
export function fullCrop(width: number, height: number): CropRect {
  return { x: 0, y: 0, w: width, h: height };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Move one corner to (px, py); the opposite corner stays; result stays inside the image. */
export function moveCorner(rect: CropRect, corner: Corner, px: number, py: number, width: number, height: number): CropRect {
  const min = minCropSide(width, height);
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.w;
  let bottom = rect.y + rect.h;
  if (corner === 'tl' || corner === 'bl') left = clamp(px, 0, right - min);
  else right = clamp(px, left + min, width);
  if (corner === 'tl' || corner === 'tr') top = clamp(py, 0, bottom - min);
  else bottom = clamp(py, top + min, height);
  return { x: Math.round(left), y: Math.round(top), w: Math.round(right - left), h: Math.round(bottom - top) };
}

/** Move the whole rectangle by (dx, dy), kept inside the image. */
export function moveRect(rect: CropRect, dx: number, dy: number, width: number, height: number): CropRect {
  return {
    x: Math.round(clamp(rect.x + dx, 0, width - rect.w)),
    y: Math.round(clamp(rect.y + dy, 0, height - rect.h)),
    w: rect.w,
    h: rect.h,
  };
}

/** Position of a corner. */
export function cornerPoint(rect: CropRect, corner: Corner): { x: number; y: number } {
  return {
    x: corner === 'tl' || corner === 'bl' ? rect.x : rect.x + rect.w,
    y: corner === 'tl' || corner === 'tr' ? rect.y : rect.y + rect.h,
  };
}

/** True when the crop is (almost) the whole image: no need to copy pixels. */
export function isFullCrop(rect: CropRect, width: number, height: number): boolean {
  return rect.x <= 1 && rect.y <= 1 && rect.w >= width - 2 && rect.h >= height - 2;
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
