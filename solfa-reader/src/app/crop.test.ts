import { describe, expect, it } from 'vitest';
import { fullQuad, insetQuad, isFullQuad, isValidQuad, minCropSide, moveQuadCorner, overallProgress } from './crop';

describe('4-corner crop', () => {
  it('starts from the whole image or an inset, in TL TR BR BL order', () => {
    expect(fullQuad(100, 50)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);
    expect(insetQuad(100, 100, 0.1)[0]).toEqual({ x: 10, y: 10 });
    expect(isFullQuad(fullQuad(10, 10), 10, 10)).toBe(true);
    expect(isFullQuad(insetQuad(100, 100), 100, 100)).toBe(false);
  });

  it('moves one corner, clamped to the image', () => {
    const q = fullQuad(1000, 800);
    expect(moveQuadCorner(q, 0, 120.4, 60.6, 1000, 800)[0]).toEqual({ x: 120, y: 61 });
    expect(moveQuadCorner(q, 2, 5000, -50, 1000, 800)).toBe(q); // would fold onto the top edge
    expect(moveQuadCorner(q, 2, 5000, 900, 1000, 800)[2]).toEqual({ x: 1000, y: 800 });
    expect(moveQuadCorner(q, 3, 80, 700, 1000, 800)[3]).toEqual({ x: 80, y: 700 });
  });

  it('refuses folded, crossed or tiny shapes', () => {
    const q = fullQuad(1000, 800);
    expect(moveQuadCorner(q, 0, 900, 700, 1000, 800)).toBe(q); // TL past BR: not convex
    expect(isValidQuad([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }])).toBe(false);
    expect(isValidQuad(fullQuad(10, 10), 20)).toBe(false);
    expect(minCropSide(1000, 800)).toBe(64);
  });

  it('weights the reading stages into one progress', () => {
    expect(overallProgress('preprocessing', 0)).toBe(0);
    expect(overallProgress('loading-engine', 1)).toBeCloseTo(0.35);
    expect(overallProgress('recognizing', 0.5)).toBeGreaterThan(0.35);
    expect(overallProgress('done', 0)).toBe(1);
  });
});
