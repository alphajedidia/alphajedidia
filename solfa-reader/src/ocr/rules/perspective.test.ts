import { describe, expect, it } from 'vitest';
import { applyHomography, findPageQuad, homography, quadSize, warpRgba } from './perspective';
import { blank } from './testing';

describe('perspective', () => {
  it('solves a homography that maps 4 points exactly', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];
    const dst = [
      { x: 10, y: 5 },
      { x: 120, y: 0 },
      { x: 130, y: 70 },
      { x: 0, y: 60 },
    ];
    const H = homography(src, dst)!;
    src.forEach((p, i) => {
      const q = applyHomography(H, p);
      expect(q.x).toBeCloseTo(dst[i].x, 6);
      expect(q.y).toBeCloseTo(dst[i].y, 6);
    });
    expect(homography(src, [dst[0], dst[0], dst[0], dst[0]])).toBeNull();
  });

  it('straightens a quad of an image', () => {
    // 20×20 image: black square in the top-left 10×10.
    const w = 20;
    const src = new Uint8ClampedArray(w * w * 4).fill(255);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) src.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3);
    const q = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    expect(quadSize(q)).toEqual({ width: 20, height: 20 });
    const out = warpRgba(src, w, w, q, 10, 10); // shrink ×2
    expect(out[(2 * 10 + 2) * 4]).toBeLessThan(60); // top-left is black
    expect(out[(7 * 10 + 7) * 4]).toBeGreaterThan(200); // bottom-right is white
  });

  it('finds the corners of a page on a dark background, and refuses a page that fills the photo', () => {
    const m = blank(100, 120);
    // a slightly rotated page: rows shifted
    for (let y = 20; y < 100; y++) m.rect(15 + Math.round((y - 20) / 10), y, 70, 1);
    const q = findPageQuad(m)!;
    expect(q.corners[0].x).toBeLessThan(20);
    expect(q.corners[2].y).toBeGreaterThanOrEqual(99);
    expect(findPageQuad(blank(50, 50).rect(0, 0, 50, 50))).toBeNull();
    expect(findPageQuad(blank(50, 50))).toBeNull();
  });
});
