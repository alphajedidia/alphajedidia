import { describe, expect, it } from 'vitest';
import { fullCrop, isFullCrop, minCropSide, moveCorner, moveRect, overallProgress } from './crop';

describe('crop', () => {
  it('moves a corner, keeping the opposite one and the bounds', () => {
    const r = fullCrop(1000, 800);
    expect(moveCorner(r, 'tl', 100, 50, 1000, 800)).toEqual({ x: 100, y: 50, w: 900, h: 750 });
    expect(moveCorner(r, 'br', 2000, -5, 1000, 800)).toEqual({ x: 0, y: 0, w: 1000, h: minCropSide(1000, 800) });
    expect(moveCorner(r, 'tr', 500, 400, 1000, 800)).toEqual({ x: 0, y: 400, w: 500, h: 400 });
  });

  it('moves the rectangle inside the image', () => {
    expect(moveRect({ x: 10, y: 10, w: 100, h: 100 }, 1000, -50, 500, 500)).toEqual({ x: 400, y: 0, w: 100, h: 100 });
    expect(isFullCrop(fullCrop(10, 10), 10, 10)).toBe(true);
    expect(isFullCrop({ x: 5, y: 0, w: 5, h: 10 }, 10, 10)).toBe(false);
  });

  it('weights the reading stages into one progress', () => {
    expect(overallProgress('preprocessing', 0)).toBe(0);
    expect(overallProgress('loading-engine', 1)).toBeCloseTo(0.35);
    expect(overallProgress('recognizing', 0.5)).toBeGreaterThan(0.35);
    expect(overallProgress('done', 0)).toBe(1);
  });
});
