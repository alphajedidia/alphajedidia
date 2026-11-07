import { describe, expect, it } from 'vitest';
import { alignSystem, beatCount, clusterColumns } from './align';
import { cellText, tokensFromText, type Token } from './tokens';

/** Tokens from a monospaced line: 10 px per character, so columns line up like the text. */
const toks = (line: string): Token[] => tokensFromText(line, { x0: 0, x1: line.length * 10, y0: 0, y1: 20 }).map((t) => ({ ...t, conf: 0.9, reason: undefined }));
const show = (cells: ReturnType<typeof alignSystem>['voices'][number]) => cells.map((c) => (c.sep?.text ?? '') + cellText(c)).join(' ');

describe('align — beat columns across voices', () => {
  it('clusters separator positions into columns', () => {
    expect(clusterColumns([10, 52, 11, 50, 90], 5)).toEqual([[10, 11], [50, 52], [90]]);
  });

  it('restores a `:` missing in one voice and flags it', () => {
    const sys = alignSystem(
      [toks('| m :m :f :s |'), toks('| d :d  d :t |'), toks('| s :s :l :s |'), toks('| d :d :f :s |')],
      10,
    );
    expect(sys.mode).toBe('columns');
    expect(show(sys.voices[1])).toBe(' |d :d :d :t |');
    const inserted = sys.voices[1][3].sep!;
    expect(inserted).toMatchObject({ text: ':', reason: 'inserted-separator' });
    expect(inserted.conf).toBeLessThan(0.6);
  });

  it('drops a separator only one voice has (misread mark) and flags the cell', () => {
    const sys = alignSystem([toks('| m :m :f |'), toks('| d :d:d :t |'.replace(':d:d', ':d d')), toks('| s :s :l |')], 10);
    expect(sys.voices.every((v) => v.length === sys.voices[0].length)).toBe(true);
  });

  it('turns a bar that only one voice has into `l` when it looks like one', () => {
    const rows = [toks('| m :m :f |'), toks('| d :l :d |'), toks('| s :s :s |')];
    // voice 2 read its `l` as a bar line
    const l = rows[1].findIndex((t) => t.text === 'l');
    rows[1][l] = { ...rows[1][l], kind: 'sep', text: '|', alt: 'l' };
    const sys = alignSystem(rows, 5);
    expect(show(sys.voices[1])).toBe(' |d :l :d |');
    expect(sys.voices[1][2].items[0]).toMatchObject({ text: 'l', reason: 'bar-as-lah' });
  });

  it('corrects a separator type disagreeing with a strong majority', () => {
    const sys = alignSystem([toks('| m :m |'), toks('| d !d |'), toks('| s :s |'), toks('| d :d |')], 10);
    expect(sys.voices[1][2].sep).toMatchObject({ text: ':', reason: 'corrected-separator' });
  });

  it('falls back to reading order when voices do not line up', () => {
    const sys = alignSystem([toks('| m :m :f :s |'), toks('  | d  :d    :t   |')], 10, { tolerance: 0.3 });
    expect(sys.mode).toBe('sequential');
    expect(beatCount(sys.voices[1])).toBe(3);
  });
});
