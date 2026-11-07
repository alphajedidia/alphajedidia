import { describe, expect, it } from 'vitest';
import {
  bh,
  bw,
  cx,
  cy,
  grow,
  identityTransform,
  median,
  quantile,
  twoMeans,
  union,
  unionAll,
  weightedMedian,
  workBoxToSource,
  workPointToSource,
  xOverlap,
  yOverlap,
} from './geometry';

describe('geometry', () => {
  const a = { x0: 0, y0: 0, x1: 10, y1: 4 };
  const b = { x0: 5, y0: 2, x1: 20, y1: 8 };

  it('measures and combines boxes', () => {
    expect([bw(a), bh(a), cx(a), cy(a)]).toEqual([10, 4, 5, 2]);
    expect(union(a, b)).toEqual({ x0: 0, y0: 0, x1: 20, y1: 8 });
    expect(unionAll([a, b])).toEqual({ x0: 0, y0: 0, x1: 20, y1: 8 });
    expect(unionAll([])).toBeNull();
    expect(xOverlap(a, b)).toBe(5);
    expect(yOverlap(a, b)).toBe(2);
    expect(xOverlap(a, { x0: 30, y0: 0, x1: 40, y1: 1 })).toBe(0);
    expect(grow(a, 2)).toEqual({ x0: -2, y0: -2, x1: 12, y1: 6 });
  });

  it('computes robust statistics', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
    // The heavy value wins the weighted median.
    expect(weightedMedian([1, 2, 10], [1, 1, 10])).toBe(10);
  });

  it('splits two height groups (x-height vs ascenders)', () => {
    const t = twoMeans([20, 21, 19, 29, 30, 20, 29]);
    expect(t.separated).toBe(true);
    expect(t.low).toBeCloseTo(20, 0);
    expect(t.high).toBeCloseTo(29, 0);
    expect(twoMeans([20, 20, 21]).separated).toBe(false);
  });

  it('maps working-image boxes back to the source canvas', () => {
    const id = identityTransform(100, 50);
    expect(workPointToSource(10, 20, id)).toEqual({ x: 10, y: 20 });
    // Scaled ×2, no rotation.
    const t = { scale: 2, angleDeg: 0, scaledW: 200, scaledH: 100, workW: 200, workH: 100 };
    expect(workBoxToSource({ x0: 20, y0: 10, x1: 40, y1: 30 }, t, 100, 50)).toEqual({ x0: 10, y0: 5, x1: 20, y1: 15 });
    // Rotated by 90°: the working image centre maps to the source centre.
    const r = { scale: 1, angleDeg: 90, scaledW: 100, scaledH: 50, workW: 50, workH: 100 };
    const p = workPointToSource(25, 50, r);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(25);
  });
});
