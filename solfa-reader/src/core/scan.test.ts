import { describe, expect, it } from 'vitest';
import { maskBraces, scanMusic } from './scan';

describe('maskBraces', () => {
  it('blanks brace groups and reports stray braces', () => {
    expect(maskBraces('d {f} :r')).toEqual({ masked: 'd     :r', stray: [] });
    expect(maskBraces('} d { r')).toEqual({ masked: '  d   r', stray: [0, 4] });
  });
});

describe('scanMusic', () => {
  it('splits a line into cells with accents and columns', () => {
    const s = scanMusic('S: | d :r || m !f ¦s', 2);
    expect(s.cells.map((c) => [c.sep, c.accent, c.raw.trim(), c.isBeat, c.sepCol])).toEqual([
      ['', 'none', '', false, 2],
      ['|', 'bar', 'd', true, 3],
      [':', 'weak', 'r', true, 7],
      ['||', 'bar', 'm', true, 10],
      ['!', 'medium', 'f', true, 15],
      ['¦', 'medium', 's', true, 18],
    ]);
    expect(s.endsWithBar).toBe(false);
  });
  it('treats empty text after the last separator as a closing separator', () => {
    const s = scanMusic('| d :- |', 0);
    expect(s.cells.map((c) => c.isBeat)).toEqual([false, true, true, false]);
    expect(s.endsWithBar).toBe(true);
    expect(scanMusic('| d :', 0).endsWithBar).toBe(false);
  });
  it('ignores separators inside braces', () => {
    const s = scanMusic('| d {D.C. :|} :r |', 0);
    expect(s.cells.filter((c) => c.isBeat).map((c) => [c.raw.trim(), c.masked.trim()])).toEqual([
      ['d {D.C. :|}', 'd'],
      ['r', 'r'],
    ]);
  });
});
