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

describe('pixels — noise', () => {
  it('estimates noise and smooths it away with a box blur', async () => {
    const { boxBlur, estimateNoise } = await import('./pixels');
    const w = 120;
    const h = 80;
    const data = new Uint8Array(w * h);
    let s = 7;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, Math.round(200 + (rnd() + rnd() + rnd() - 1.5) * 50)));
    const noisy = { width: w, height: h, data };
    const sigma = estimateNoise(noisy);
    expect(sigma).toBeGreaterThan(10);
    const smooth = boxBlur(noisy, 2);
    expect(estimateNoise(smooth)).toBeLessThan(sigma / 2);
    expect(estimateNoise({ width: w, height: h, data: new Uint8Array(w * h).fill(230) })).toBe(0);
    expect(boxBlur(noisy, 0)).toBe(noisy);
  });
});

describe('pixels — colour photos', () => {
  it('robust grey: dark ink stays dark, coloured paper / pen / stains turn light', async () => {
    const { toGrayRobust, toGrayMax } = await import('./pixels');
    const px = (r: number, g: number, b: number) => [r, g, b, 255];
    const rgba = new Uint8Array([
      ...px(20, 20, 25), // black ink
      ...px(245, 196, 240), // pink paper
      ...px(60, 90, 220), // blue pen
      ...px(25, 25, 80), // black ink under blue highlighter
      ...px(215, 190, 120), // coffee stain
      ...px(150, 120, 150), // faint grey-purple print
    ]);
    const g = toGrayRobust(rgba, 6, 1).data;
    expect(g[0]).toBeLessThan(40);
    expect(g[1]).toBeGreaterThan(190);
    expect(g[2]).toBeGreaterThan(190);
    expect(g[3]).toBeLessThan(60);
    expect(g[4]).toBeGreaterThan(190);
    expect(g[5]).toBeLessThan(g[1] - 60); // keeps the contrast the max channel loses
    expect(toGrayMax(rgba, 6, 1).data[2]).toBe(220);
  });
});
