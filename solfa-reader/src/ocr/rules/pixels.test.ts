import { describe, expect, it } from 'vitest';
import {
  binarizeSauvola,
  downsampleBitmap,
  estimateSkew,
  flattenIllumination,
  majorityFilter,
  otsuThreshold,
  rotateBitmap,
  toGray,
} from './pixels';
import { blank, drawRow } from './testing';
import type { GrayImage } from './geometry';

/** A grey page: dark "text" bars on a background that gets darker to the right. */
function shadedPage(): GrayImage {
  const w = 200;
  const h = 100;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const paper = 240 - Math.round((x / w) * 120); // 240 → 120
      const ink = y >= 40 && y < 50 && x % 20 < 8;
      data[y * w + x] = ink ? Math.round(paper * 0.35) : paper;
    }
  return { width: w, height: h, data };
}

describe('pixels', () => {
  it('converts RGBA to grey, transparent = paper', () => {
    const g = toGray(new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0]), 3, 1);
    expect(Array.from(g.data)).toEqual([0, 255, 255]);
  });

  it('finds a global Otsu threshold between two populations', () => {
    const g: GrayImage = { width: 4, height: 1, data: new Uint8Array([10, 20, 200, 210]) };
    const t = otsuThreshold(g);
    expect(t).toBeGreaterThanOrEqual(20);
    expect(t).toBeLessThan(200);
  });

  it('flattens uneven lighting', () => {
    const f = flattenIllumination(shadedPage(), 16);
    // Paper on the dark side becomes close to white again.
    expect(f.data[10 * 200 + 190]).toBeGreaterThan(220);
    expect(f.data[45 * 200 + 181]).toBeLessThan(140);
  });

  it('binarizes with Sauvola despite a shadow', () => {
    const b = binarizeSauvola(flattenIllumination(shadedPage(), 16), { radius: 12 });
    let inkOnText = 0;
    let inkOnPaper = 0;
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 200; x++) {
        const v = b.data[y * 200 + x];
        if (y >= 40 && y < 50 && x % 20 < 8) inkOnText += v;
        else inkOnPaper += v;
      }
    expect(inkOnText).toBeGreaterThan(0.9 * 10 * 80);
    expect(inkOnPaper).toBeLessThan(50);
  });

  it('removes speckles with the majority filter', () => {
    const c = blank(10, 10).rect(2, 2, 4, 4);
    c.data[8 * 10 + 8] = 1; // speckle
    const f = majorityFilter(c);
    expect(f.data[8 * 10 + 8]).toBe(0);
    expect(f.data[3 * 10 + 3]).toBe(1);
  });

  it('downsamples with OR pooling', () => {
    const c = blank(4, 4).rect(3, 3, 1, 1);
    const d = downsampleBitmap(c, 2);
    expect([d.width, d.height]).toEqual([2, 2]);
    expect(Array.from(d.data)).toEqual([0, 0, 0, 1]);
  });

  it('detects the skew of rotated text lines (±15°)', () => {
    const page = blank(600, 400);
    for (let row = 0; row < 6; row++) drawRow(page, '| d :m :s :d | r :- :t :l |', 40, 80 + row * 50, 14);
    for (const deg of [0, 3, -5.5, 9]) {
      const rotated = rotateBitmap(page, deg);
      const { angle, confidence } = estimateSkew(rotated);
      expect(Math.abs(angle - deg)).toBeLessThan(0.35);
      expect(confidence).toBeGreaterThan(0);
    }
  });

  it('reports no skew on an empty page', () => {
    expect(estimateSkew(blank(50, 50))).toEqual({ angle: 0, confidence: 0 });
  });
});
