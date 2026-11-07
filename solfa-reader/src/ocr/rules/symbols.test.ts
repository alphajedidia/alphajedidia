import { describe, expect, it } from 'vitest';
import { classifyShape, glyphFeatures, looksLikeLah, measureRow, type RowMetrics } from './symbols';
import { labelComponents } from './components';
import { blank, drawRow } from './testing';

const m: RowMetrics = { baseline: 100, xHeight: 20, ascHeight: 29, measured: true };
const box = (x0: number, y0: number, w: number, h: number, fill = 1) => ({ x0, y0, x1: x0 + w, y1: y0 + h, area: Math.round(w * h * fill) });

describe('symbols — row metrics', () => {
  it('measures baseline, x-height and ascender height from letters', () => {
    const c = blank(500, 160);
    drawRow(c, '| d :m :s :d | r :l :t :f |', 10, 100, 20);
    const r = measureRow(labelComponents(c).components);
    expect(r).not.toBeNull();
    expect(r!.baseline).toBe(100);
    expect(r!.xHeight).toBeCloseTo(20, 0);
    expect(r!.ascHeight).toBeGreaterThanOrEqual(25);
    expect(r!.measured).toBe(true);
  });

  it('falls back on the page x-height when a row has only one letter height', () => {
    const c = blank(300, 160);
    drawRow(c, 'd :d :d', 10, 100, 20);
    const r = measureRow(labelComponents(c).components, 20)!;
    expect(r.xHeight).toBe(20);
    expect(r.measured).toBe(false);
    expect(measureRow([])).toBeNull();
  });
});

describe('symbols — classifyShape', () => {
  const cases: [string, ReturnType<typeof box>, string][] = [
    ['bar |', box(0, 60, 3, 50), 'bar'],
    ['lah l', box(0, 71, 4, 29), 'glyph'],
    ['letter m', box(0, 80, 22, 20), 'glyph'],
    ['letter d', box(0, 71, 13, 29), 'glyph'],
    ['period', box(0, 96, 4, 4), 'dot-low'],
    ['colon top dot', box(0, 82, 4, 4), 'dot-high'],
    ['comma', box(0, 96, 3, 9), 'comma'],
    ['apostrophe', box(0, 71, 3, 8), 'high-mark'],
    ['hyphen', box(0, 89, 10, 3), 'dash'],
    ['underscore', box(0, 99, 12, 3), 'dash'],
    ['! stroke', box(0, 72, 3, 18), 'stroke'],
    ['speck', box(0, 50, 1, 1), 'noise'],
    ['thick final bar', box(0, 60, 9, 50), 'bar'],
    ['stubby hand-drawn hold dash', box(0, 86, 7, 5), 'dash'],
    ['superscript ¹ octave mark', box(0, 70, 5, 12), 'high-mark'],
    ['parenthesis (curved, below baseline)', box(0, 68, 8, 38, 0.3), 'noise'],
  ];
  for (const [name, b, kind] of cases) {
    it(`${name} → ${kind}`, () => expect(classifyShape(b, m).kind).toBe(kind));
  }

  it('tells `l` (stands on the baseline) from a bar line', () => {
    expect(looksLikeLah({ x0: 0, y0: 71, x1: 4, y1: 100 }, m)).toBe(true);
    expect(looksLikeLah({ x0: 0, y0: 60, x1: 3, y1: 110 }, m)).toBe(false);
  });

  it('describes glyphs in x-height units', () => {
    const f = glyphFeatures(box(0, 71, 13, 29), m);
    expect(f.tall).toBe(true);
    expect(f.w).toBeCloseTo(0.65);
    expect(glyphFeatures(box(0, 80, 13, 20), m).tall).toBe(false);
  });
});
