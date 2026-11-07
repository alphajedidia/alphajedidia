import { describe, expect, it } from 'vitest';
import { joinBlocks, renderSystem, UNCERTAIN_BELOW } from './assemble';
import { alignSystem } from './align';
import { tokensFromText, type Token } from './tokens';
import { formatSolfa } from '../../core';

const toks = (line: string): Token[] => tokensFromText(line, { x0: 0, x1: line.length * 10, y0: 0, y1: 20 }).map((t) => ({ ...t, conf: 0.9, reason: undefined }));

describe('assemble — canonical text', () => {
  // SOLFA_FORMAT §1 example, first system (columns line up in the source).
  const system = [
    '| m  :m  :f  :s  | s  :f  :m  :r  |',
    '| d  :d  :d  :t, | d  :r  :d  :t, |',
    '| s  :s  :l  :s  | s  :l  :s  :s  |',
    '| d  :d  :f, :s, | m, :r, :d, :s, |',
  ];

  it('renders aligned voice lines (separators in the same columns)', () => {
    const lines = renderSystem(alignSystem(system.map(toks), 10), ['S', 'A', 'T', 'B']);
    expect(lines.map((l) => l.text)).toEqual([
      'S: | m :m :f  :s  | s  :f  :m  :r  |',
      'A: | d :d :d  :t, | d  :r  :d  :t, |',
      'T: | s :s :l  :s  | s  :l  :s  :s  |',
      'B: | d :d :f, :s, | m, :r, :d, :s, |',
    ]);
    const colsOf = (s: string) => [...s].map((ch, i) => (/[|:]/.test(ch) ? i : -1)).filter((i) => i >= 0);
    expect(new Set(lines.map((l) => colsOf(l.text).join(','))).size).toBe(1);
  });

  it('is already tidy: core formatSolfa leaves it unchanged', () => {
    const text = renderSystem(alignSystem(system.map(toks), 10), ['S', 'A', 'T', 'B']).map((l) => l.text).join('\n');
    expect(formatSolfa(text)).toBe(text);
  });

  it('reports uncertain tokens as spans on the right columns', () => {
    const rows = [toks('| m :m |'), toks('| d :d |')];
    rows[1][3] = { ...rows[1][3], conf: 0.3, reason: 'low-confidence' };
    const lines = renderSystem(alignSystem(rows, 10), ['S', 'A']);
    expect(lines[1].text).toBe('A: | d :d |');
    expect(lines[1].spans).toEqual([{ col: 8, endCol: 9, conf: 0.3, reason: 'low-confidence' }]);
    expect(lines[1].text.slice(8, 9)).toBe('d');
    expect(UNCERTAIN_BELOW).toBeGreaterThan(0.3);
  });

  it('keeps a pick-up column and joins blocks with blank lines', () => {
    const lines = renderSystem(alignSystem([toks(':s, | d :- |'), toks(':m  | m :- |')], 10), ['S', 'A']);
    expect(lines.map((l) => l.text)).toEqual(['S: :s, | d :- |', 'A: :m  | m :- |']);
    const doc = joinBlocks([
      [{ text: 'key: F', kind: 'header', voice: null, box: null, conf: 1, spans: [] }],
      lines.map((l) => ({ ...l, box: null })),
    ]);
    expect(doc.text).toBe('key: F\n\nS: :s, | d :- |\nA: :m  | m :- |\n');
    expect(doc.lines.map((l) => l.textLine)).toEqual([0, 2, 3]);
  });
});
