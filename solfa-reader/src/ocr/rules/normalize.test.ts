import { describe, expect, it } from 'vitest';
import { guessFromShape, normalizeMusicLine, normalizeNote, readLabel, NOTE_RE } from './normalize';

describe('normalize — note readings (confusion map)', () => {
  const cases: [string, string, Parameters<typeof normalizeNote>[2], string][] = [
    ['valid note', 'd', {}, 'd'],
    ['chromatic', 'fe', {}, 'fe'],
    ['cl → d', 'cl', {}, 'd'],
    ['rn → m', 'rn', {}, 'm'],
    ['5 → s', '5', {}, 's'],
    ['S (upper case) → s', 'S', {}, 's'],
    ['T → t', 'T', {}, 't'],
    ['+ → t', '+', {}, 't'],
    ['1 → l', '1', {}, 'l'],
    ['I → l', 'I', {}, 'l'],
    ['| → l', '|', {}, 'l'],
    ['lah shape wins over a misreading', 'i', { lahShape: true }, 'l'],
    ['a short glyph is not l', 'l', { tall: false, width: 0.95 }, 'm'],
    ['too long: keep a valid prefix', 'dr', {}, 'd'],
    ['nothing read: guess from shape', '', { tall: true, width: 0.7 }, 'd'],
  ];
  for (const [name, raw, geo, want] of cases) {
    it(`${name}: "${raw}" → ${want}`, () => {
      const r = normalizeNote(raw, 0.9, geo);
      expect(r.text).toBe(want);
      expect(NOTE_RE.test(r.text)).toBe(true);
    });
  }
  it('lowers confidence when the reading was changed', () => {
    expect(normalizeNote('d', 0.9).conf).toBeCloseTo(0.9);
    expect(normalizeNote('cl', 0.9).conf).toBeLessThan(0.9);
    expect(normalizeNote('', 0.9, {}).conf).toBeLessThan(0.4);
  });
  it('guesses letters from the glyph shape', () => {
    expect(guessFromShape({ lahShape: true })).toBe('l');
    expect(guessFromShape({ tall: true, width: 0.45 })).toBe('t');
    expect(guessFromShape({ tall: false, width: 1 })).toBe('m');
    expect(guessFromShape({ tall: false, width: 0.35 })).toBe('r');
  });
});

describe('normalize — labels and plain-text lines', () => {
  it('reads voice labels', () => {
    expect(readLabel('S.')).toBe('S');
    expect(readLabel('A:')).toBe('A');
    expect(readLabel('Ten')).toBe('T');
    expect(readLabel('Basse')).toBe('B');
    expect(readLabel('s')).toBeNull();
  });
  const lines: [string, string][] = [
    ['| d ;m :s |', '| d :m :s |'],
    ["| d’ :t :l |", "| d' :t :l |"],
    ['| s – :– |', '| s - :- |'],
    ['I d :cl :rn I', '| d :d :m |'],
    ['| 5 :+ :l. |', '| s :t :l. |'],
    ['| d :m ll', '| d :m ||'],
    ['| d :m ¦ s :f |', '| d :m ! s :f |'],
    ['| d :xyz |', '| d : |'],
  ];
  for (const [raw, want] of lines) it(`"${raw}" → "${want}"`, () => expect(normalizeMusicLine(raw)).toBe(want));
});
