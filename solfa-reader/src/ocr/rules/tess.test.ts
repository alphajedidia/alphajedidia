import { describe, expect, it } from 'vitest';
import { flattenPage, pageSymbols, pageText } from './tess';

const bbox = (x0: number) => ({ x0, y0: 0, x1: x0 + 10, y1: 20 });
const page = {
  blocks: [
    {
      paragraphs: [
        {
          lines: [
            {
              text: 'd m\n',
              confidence: 90,
              bbox: bbox(0),
              words: [
                { text: 'd', confidence: 92, bbox: bbox(0), symbols: [{ text: 'd', confidence: 92, bbox: bbox(0) }] },
                { text: 'm', confidence: 80, bbox: bbox(40), symbols: [{ text: 'm', confidence: 80, bbox: bbox(40) }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('tess — flatten Tesseract.js blocks output', () => {
  it('flattens lines, words and symbols', () => {
    const lines = flattenPage(page);
    expect(lines).toHaveLength(1);
    expect(lines[0].words.map((w) => w.text)).toEqual(['d', 'm']);
    expect(pageSymbols(page).map((s) => [s.text, s.box.x0])).toEqual([
      ['d', 0],
      ['m', 40],
    ]);
  });
  it('gives the plain text and mean confidence', () => {
    const t = pageText(page);
    expect(t.text).toBe('d m');
    expect(t.conf).toBeCloseTo(0.86);
  });
  it('is defensive with odd data', () => {
    expect(flattenPage(null)).toEqual([]);
    expect(flattenPage({ blocks: 'x' })).toEqual([]);
    expect(pageText({}).text).toBe('');
  });
});
