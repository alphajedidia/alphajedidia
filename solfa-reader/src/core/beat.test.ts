import { describe, expect, it } from 'vitest';
import { parseBeatText, readNoteName } from './beat';
import type { Diagnostic, SolfaNote } from './model';
import { parseSolfa } from './parser';
import { partsOf } from './test-helpers';

// §4–§5 of SOLFA_FORMAT.md: beats, divisions, comma rule, chromatics, octave marks, holds.

const codes = (ds: Diagnostic[]): string[] => ds.map((d) => d.code);
/** Parse one soprano line and return its beats. */
const beatsOf = (music: string) => parseSolfa(`S: ${music}`).song.systems[0]?.lines.S?.beats ?? [];
/** Parse a single beat written between bar lines. */
const oneBeat = (text: string) => {
  const r = parseSolfa(`S: | ${text} |`);
  return { beat: r.song.systems[0]?.lines.S?.beats[0], diagnostics: r.diagnostics };
};
const noteAt = (text: string, part = 0): SolfaNote => {
  const item = oneBeat(text).beat?.parts[part]?.item;
  if (item?.kind !== 'note') throw new Error(`no note in "${text}"`);
  return item;
};

describe('readNoteName', () => {
  it('reads diatonic and chromatic names', () => {
    expect(readNoteName('d')).toEqual({ degree: 'd', alter: 0 });
    expect(readNoteName('fe')).toEqual({ degree: 'f', alter: 1 });
    expect(readNoteName('si')).toEqual({ degree: 's', alter: 1 });
    expect(readNoteName('ta')).toEqual({ degree: 't', alter: -1 });
    expect(readNoteName('lo')).toEqual({ degree: 'l', alter: -1 });
    expect(readNoteName('te')).toEqual({ degree: 't', alter: -1 });
  });
  it.each(['', 'x', 'rr', 'dm', 'D', 'dee', 'du'])('rejects %j', (w) => {
    expect(readNoteName(w)).toBeNull();
  });
});

describe('parseBeatText', () => {
  it('returns parts with item columns and line-relative diagnostics', () => {
    const r = parseBeatText(' d.,x ', 10);
    expect(partsOf({ parts: r.parts, accent: 'weak' })).toEqual([
      ['d', 0, 0.75],
      ['_', 0.75, 0.25],
    ]);
    expect(r.cols).toEqual([11, 14]);
    expect(r.diagnostics).toEqual([
      { severity: 'error', code: 'bad-note', message: expect.any(String), col: 14, endCol: 15 },
    ]);
  });
  it('makes an empty beat one rest', () => {
    expect(parseBeatText('   ', 0).parts).toEqual([{ item: { kind: 'rest' }, start: 0, length: 1 }]);
    expect(parseBeatText(' . ', 0).parts).toEqual([{ item: { kind: 'rest' }, start: 0, length: 1 }]);
  });
});

describe('§4 pulse separators', () => {
  it('| d :- :m.r :d | is 4 beats', () => {
    const beats = beatsOf('| d :- :m.r :d |');
    expect(beats.map((b) => b.accent)).toEqual(['bar', 'weak', 'weak', 'weak']);
    expect(beats.map(partsOf)).toEqual([
      [['d', 0, 1]],
      [['-', 0, 1]],
      [
        ['m', 0, 0.5],
        ['r', 0.5, 0.5],
      ],
      [['d', 0, 1]],
    ]);
  });

  it(':s, | d :- | starts with a one-beat pick-up', () => {
    const beats = beatsOf(':s, | d :- |');
    expect(beats).toHaveLength(3);
    expect(beats[0]?.accent).toBe('weak');
    expect(partsOf(beats[0])).toEqual([['s,', 0, 1]]);
  });

  it('non-empty text before the first separator is a beat with accent none', () => {
    const beats = beatsOf('s, | d |');
    expect(beats.map((b) => b.accent)).toEqual(['none', 'bar']);
  });

  it('empty text between separators is a rest beat', () => {
    const beats = beatsOf('| d : :m |');
    expect(beats.map(partsOf)).toEqual([[['d', 0, 1]], [['_', 0, 1]], [['m', 0, 1]]]);
  });

  it('reads double bars and medium accents', () => {
    const beats = beatsOf('| d :r !m ¦f || s :l');
    expect(beats.map((b) => b.accent)).toEqual(['bar', 'weak', 'medium', 'medium', 'bar', 'weak']);
  });
});

describe('§5 inside a beat', () => {
  it.each([
    ['d', [['d', 0, 1]]],
    ['d.r', [['d', 0, 0.5], ['r', 0.5, 0.5]]],
    ['d.,r', [['d', 0, 0.75], ['r', 0.75, 0.25]]],
    ['d,r.m', [['d', 0, 0.25], ['r', 0.25, 0.25], ['m', 0.5, 0.5]]],
    ['d.r,m', [['d', 0, 0.5], ['r', 0.5, 0.25], ['m', 0.75, 0.25]]],
    ['d,r.m,f', [['d', 0, 0.25], ['r', 0.25, 0.25], ['m', 0.5, 0.25], ['f', 0.75, 0.25]]],
    ['d,r,m', [['d', 0, 1 / 3], ['r', 1 / 3, 1 / 3], ['m', 2 / 3, 1 / 3]]],
    ['.r', [['_', 0, 0.5], ['r', 0.5, 0.5]]],
    ['-.r', [['-', 0, 0.5], ['r', 0.5, 0.5]]],
  ])('table row %s', (text, expected) => {
    // After a note, so that "-" has something to hold.
    const r = parseSolfa(`S: | d :${text} |`);
    expect(r.diagnostics.filter((d) => d.severity !== 'info')).toEqual([]);
    expect(partsOf(r.song.systems[0]?.lines.S?.beats[1])).toEqual(expected);
  });

  it('reads a rest after a half and a quarter division after a space', () => {
    expect(partsOf(oneBeat('d. ,r').beat)).toEqual([
      ['d', 0, 0.5],
      ['_', 0.5, 0.25],
      ['r', 0.75, 0.25],
    ]);
    expect(partsOf(oneBeat('d.-').beat)).toEqual([
      ['d', 0, 0.5],
      ['-', 0.5, 0.5],
    ]);
  });

  describe('comma rule', () => {
    it('rule 1: division after a space, after "." or at the start', () => {
      expect(partsOf(oneBeat('d ,r').beat)).toEqual([
        ['d', 0, 0.25],
        ['r', 0.25, 0.75],
      ]);
      expect(oneBeat('d ,r').diagnostics).toEqual([]);
      expect(partsOf(oneBeat(',r').beat)).toEqual([
        ['_', 0, 0.25],
        ['r', 0.25, 0.75],
      ]);
      expect(partsOf(oneBeat('d.,r').beat)).toEqual([
        ['d', 0, 0.75],
        ['r', 0.75, 0.25],
      ]);
    });

    it('rule 2: d,r is a division with an info diagnostic', () => {
      const { beat, diagnostics } = oneBeat('d,r');
      expect(partsOf(beat)).toEqual([
        ['d', 0, 0.25],
        ['r', 0.25, 0.75],
      ]);
      expect(diagnostics).toEqual([
        expect.objectContaining({ code: 'comma-as-division', severity: 'info', line: 0, col: 6, endCol: 7 }),
      ]);
    });

    it('rule 3: otherwise an octave mark', () => {
      expect(noteAt('t,')).toMatchObject({ degree: 't', octave: -1, text: 't,' });
      expect(partsOf(oneBeat('s,.d').beat)).toEqual([
        ['s,', 0, 0.5],
        ['d', 0.5, 0.5],
      ]);
      expect(partsOf(oneBeat('d, .r').beat)).toEqual([
        ['d,', 0, 0.5],
        ['r', 0.5, 0.5],
      ]);
      expect(noteAt('s,,')).toMatchObject({ octave: -2, text: 's,,' });
      expect(oneBeat('t,').diagnostics).toEqual([]);
    });

    it('d,,r is a low d then a quarter division', () => {
      const { beat, diagnostics } = oneBeat('d,,r');
      expect(partsOf(beat)).toEqual([
        ['d,', 0, 0.25],
        ['r', 0.25, 0.75],
      ]);
      expect(diagnostics).toEqual([]);
    });
  });

  describe('chromatic notes', () => {
    it.each(['de', 'di', 're', 'ri', 'fe', 'fi', 'se', 'si', 'le', 'li', 'me', 'ti'])('%s is raised', (n) => {
      expect(noteAt(n)).toMatchObject({ degree: n.charAt(0), alter: 1, octave: 0, text: n });
    });
    it.each(['ra', 'ma', 'la', 'lo', 'ta', 'da', 'sa', 'ro'])('%s is lowered', (n) => {
      expect(noteAt(n)).toMatchObject({ degree: n.charAt(0), alter: -1, text: n });
    });
    it('te is lowered t (the one exception)', () => {
      expect(noteAt('te')).toMatchObject({ degree: 't', alter: -1 });
    });
    it('chromatics take octave marks', () => {
      expect(noteAt("fe'")).toMatchObject({ degree: 'f', alter: 1, octave: 1 });
      expect(noteAt('ta,')).toMatchObject({ degree: 't', alter: -1, octave: -1 });
    });
  });

  describe('octave marks', () => {
    it.each([
      ["d'", 1],
      ['d’', 1],
      ['d`', 1],
      ['d¹', 1],
      ["d''", 2],
      ['d²', 2],
      ['d,', -1],
      ['d₁', -1],
      ['d,,', -2],
      ['d₂', -2],
    ])('%s has octave %i', (text, octave) => {
      const { diagnostics } = oneBeat(text);
      expect(diagnostics).toEqual([]);
      expect(noteAt(text)).toMatchObject({ degree: 'd', octave, text });
    });
  });

  describe('holds and rests', () => {
    it.each(['-', '–', '—', '_'])('"%s" is a hold', (h) => {
      const beats = beatsOf(`| d :${h} |`);
      expect(partsOf(beats[1])).toEqual([['-', 0, 1]]);
    });

    it('a hold with nothing to hold is a rest and a warning', () => {
      const r = parseSolfa('S: | - :d |');
      expect(partsOf(r.song.systems[0]?.lines.S?.beats[0])).toEqual([['_', 0, 1]]);
      expect(r.diagnostics).toEqual([
        expect.objectContaining({ code: 'hold-without-note', severity: 'warning', line: 0, col: 5, endCol: 6, voice: 'S', bar: 1 }),
      ]);
    });

    it('a hold after a rest has nothing to hold', () => {
      const r = parseSolfa('S: | d : :- |');
      expect(codes(r.diagnostics)).toEqual(['hold-without-note']);
    });

    it('a hold continues across systems', () => {
      const r = parseSolfa('S: | d |\n\nS: | - |');
      expect(r.diagnostics).toEqual([]);
    });
  });

  it('ignores text in braces', () => {
    const r = parseSolfa('S: {f} | d {rall.} :r | {D.C. :|}');
    expect(r.diagnostics).toEqual([]);
    expect(r.song.systems[0]?.lines.S?.beats.map(partsOf)).toEqual([[['d', 0, 1]], [['r', 0, 1]]]);
  });
});
