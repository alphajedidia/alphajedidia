import { describe, expect, it } from 'vitest';
import type { Diagnostic, SolfaNote } from './model';
import { parseSolfa } from './parser';
import { SPEC_EXAMPLE, partsOf, randomSolfa, rng } from './test-helpers';

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

describe('§1 complete example', () => {
  const { song, diagnostics } = parseSolfa(SPEC_EXAMPLE);

  it('parses without diagnostics', () => {
    expect(diagnostics).toEqual([]);
  });

  it('reads the headers', () => {
    expect(song.title).toBe('Hira fiderana (example)');
    expect(song.key).toEqual({ tonic: 7, name: 'G' });
    expect(song.time).toEqual({ beats: 4, unit: 4 });
    expect(song.tempo).toBe(84);
    expect(song.voices).toEqual(['S', 'A', 'T', 'B']);
    expect(song.meta).toEqual({});
  });

  it('builds two systems of 8 beats with words', () => {
    expect(song.systems).toHaveLength(2);
    expect(song.systems.map((s) => [s.startBeat, s.beatCount])).toEqual([
      [0, 8],
      [8, 8],
    ]);
    expect(song.systems[0]?.words).toEqual(['Ry To-mpo ô, de-ra-in-ay i-an-ao']);
    expect(song.systems[1]?.words).toEqual([]);
    for (const sys of song.systems) {
      for (const v of ['S', 'A', 'T', 'B'] as const) expect(sys.lines[v]?.beats).toHaveLength(8);
    }
  });

  it('reads notes, octave marks, accents and holds', () => {
    const s1 = song.systems[0]?.lines;
    expect(s1?.S?.beats.map((b) => partsOf(b)[0]?.[0])).toEqual(['m', 'm', 'f', 's', 's', 'f', 'm', 'r']);
    expect(s1?.S?.beats.map((b) => b.accent)).toEqual(['bar', 'weak', 'weak', 'weak', 'bar', 'weak', 'weak', 'weak']);
    const t = s1?.A?.beats[3]?.parts[0]?.item;
    expect(t).toEqual({ kind: 'note', degree: 't', alter: 0, octave: -1, text: 't,' });
    const s2 = song.systems[1]?.lines;
    expect(s2?.S?.beats[0]?.parts[0]?.item).toMatchObject({ degree: 'd', octave: 1, text: "d'" });
    expect(s2?.B?.beats.slice(4).map((b) => partsOf(b)[0]?.[0])).toEqual(['s,', '-', '-', '-']);
    expect(s2?.S?.endsWithBar).toBe(true);
  });

  it('keeps source spans on beats', () => {
    const lines = SPEC_EXAMPLE.split('\n');
    const beat = song.systems[0]?.lines.A?.beats[3];
    const src = beat?.source;
    expect(src?.line).toBe(6);
    expect(lines[6]?.slice(src?.col, src?.endCol)).toBe('t,');
  });
});

describe('§2 lines and systems', () => {
  it('ignores comments and keeps words', () => {
    const r = parseSolfa('# comment\n// other\nS: | d :r |\nW: la la\nWords: lo\nTonony: ry');
    expect(r.diagnostics).toEqual([]);
    expect(r.song.systems[0]?.words).toEqual(['la la', 'lo', 'ry']);
  });

  it('attaches words written before the music to the first system', () => {
    const r = parseSolfa('W: first\n\nS: | d |');
    expect(r.song.systems[0]?.words).toEqual(['first']);
  });

  it('splits systems on one or more blank lines and continues voices', () => {
    const r = parseSolfa('S: | d :r |\nA: | m :f |\n\n\n  \nS: | s :l :t |\nA: | d :r :m |');
    expect(r.song.systems).toHaveLength(2);
    expect(r.song.systems[1]?.startBeat).toBe(2);
    expect(r.song.systems[1]?.beatCount).toBe(3);
  });

  it('assigns unlabelled lines by order (default S A T B)', () => {
    const r = parseSolfa('| d |\n| m |\n| s |\n| d |');
    expect(Object.keys(r.song.systems[0]?.lines ?? {})).toEqual(['S', 'A', 'T', 'B']);
  });

  it('uses the voices: header for unlabelled lines', () => {
    const r = parseSolfa('voices: S A B\n| d |\n| m |\n| s |');
    expect(r.song.voices).toEqual(['S', 'A', 'B']);
    expect(r.song.systems[0]?.lines.B?.beats[0]?.parts[0]?.item).toMatchObject({ degree: 's' });
  });

  it('gives a short system the first voices of the list', () => {
    const r = parseSolfa('| d |\n| m |');
    expect(r.song.voices).toEqual(['S', 'A']);
  });

  it.each([
    ['S', 'S'],
    ['S:', 'S'],
    ['S.', 'S'],
    ['S=', 'S'],
    ['Sop', 'S'],
    ['Soprano:', 'S'],
    ['Alt.', 'A'],
    ['Alto=', 'A'],
    ['Ten', 'T'],
    ['Tenor:', 'T'],
    ['Ténor:', 'T'],
    ['Bas', 'B'],
    ['Bass:', 'B'],
    ['Basse.', 'B'],
    ['TENOR:', 'T'],
  ])('label "%s" means voice %s', (label, voice) => {
    const r = parseSolfa(`${label} | d :r |`);
    expect(r.diagnostics).toEqual([]);
    expect(r.song.voices).toEqual([voice]);
  });

  it('accepts a label directly followed by a bar line', () => {
    const r = parseSolfa('S:| d :r |\nA|m :f|');
    expect(r.diagnostics).toEqual([]);
    expect(r.song.voices).toEqual(['S', 'A']);
  });

  it('mixes labelled and unlabelled lines', () => {
    const r = parseSolfa('A: | m |\n| d |\n| s |');
    expect(r.song.systems[0]?.lines.S?.beats[0]?.parts[0]?.item).toMatchObject({ degree: 'd' });
    expect(r.song.systems[0]?.lines.T?.beats[0]?.parts[0]?.item).toMatchObject({ degree: 's' });
  });

  it('starts a new system when a labelled voice repeats without a blank line', () => {
    const r = parseSolfa('S: | d :r |\nS: | m :f |');
    expect(r.song.systems).toHaveLength(2);
    expect(r.song.systems[1]?.startBeat).toBe(2);
  });

  it('pads shorter voices with rest beats and warns', () => {
    const r = parseSolfa('S: | d :r :m :f |\nA: | d :r :m |');
    expect(codes(r.diagnostics)).toEqual(['beat-count-mismatch']);
    expect(r.diagnostics[0]).toMatchObject({ line: 1, col: 3, endCol: 14, voice: 'A', severity: 'warning' });
    const a = r.song.systems[0]?.lines.A?.beats ?? [];
    expect(a).toHaveLength(4);
    expect(partsOf(a[3])).toEqual([['_', 0, 1]]);
  });
});

describe('§3 headers', () => {
  it('reads all headers and keeps unknown ones in meta', () => {
    const r = parseSolfa(
      'title: Fihirana\ncomposer: R. Rakoto\nlyricist: Jean\ntime: 3/4\ntempo: 72\nArranger: Me\ncopyright: 2026\n| d |',
    );
    expect(r.diagnostics).toEqual([]);
    expect(r.song.title).toBe('Fihirana');
    expect(r.song.composer).toBe('R. Rakoto');
    expect(r.song.time).toEqual({ beats: 3, unit: 4 });
    expect(r.song.tempo).toBe(72);
    expect(r.song.meta).toEqual({ lyricist: 'Jean', arranger: 'Me', copyright: '2026' });
  });

  it('understands the header aliases', () => {
    const r = parseSolfa('author: A\nmpanoratra: B\n| d |');
    expect(r.song.composer).toBe('A');
    expect(r.song.meta.lyricist).toBe('B');
    expect(parseSolfa('mpamoron-kira: C\n| d |').song.composer).toBe('C');
  });

  it('uses defaults', () => {
    const r = parseSolfa('| d |');
    expect(r.song.title).toBe('Untitled');
    expect(r.song.key).toEqual({ tonic: 0, name: 'C' });
    expect(r.song.tempo).toBe(90);
  });

  it.each(['key: G', 'Doh is G', 'Doh = G', 'Do = Sol', 'Do dia Sol', 'Key of G', 'Key G', 'Do: G', 'doh: G', 'do: G'])(
    'key line "%s" sets doh to G',
    (line) => {
      const r = parseSolfa(`${line}\nS: | d |`);
      expect(r.diagnostics).toEqual([]);
      expect(r.song.key).toEqual({ tonic: 7, name: 'G' });
    },
  );

  it('keeps a lower-case "do" voice line as music', () => {
    const r = parseSolfa('do :r :m');
    expect(r.diagnostics).toEqual([]);
    expect(r.song.systems[0]?.lines.S?.beats).toHaveLength(3);
  });

  it('changes key from the next system on', () => {
    const r = parseSolfa('key: G\nS: | d |\n\nkey: D\nS: | d |\n\nS: | d |');
    expect(r.song.key.name).toBe('G');
    expect(r.song.systems.map((s) => s.key.name)).toEqual(['G', 'D', 'D']);
  });

  it('applies a key header inside a system to the next system', () => {
    const r = parseSolfa('S: | d |\nkey: F\nA: | d |\n\nS: | d |');
    expect(r.song.systems.map((s) => s.key.name)).toEqual(['C', 'F']);
  });

  it('accepts time values', () => {
    expect(parseSolfa('time: 6/8\n| d |').song.time).toEqual({ beats: 6, unit: 8 });
    expect(parseSolfa('time: 2/2\n| d |').song.time).toEqual({ beats: 2, unit: 2 });
    expect(parseSolfa('time: C\n| d |').song.time).toEqual({ beats: 4, unit: 4 });
  });

  it('infers time from the first complete bar of the first voice', () => {
    expect(parseSolfa(':s, | d :- :m | r :- :- |').song.time).toEqual({ beats: 3, unit: 4 });
    expect(parseSolfa('| d :r | m :f |').song.time).toEqual({ beats: 2, unit: 4 });
    expect(parseSolfa('| d :r :m').song.time).toBeUndefined();
  });

  it('reads tempo leniently but warns when out of range', () => {
    expect(parseSolfa('tempo: 100 bpm\n| d |').song.tempo).toBe(100);
    const bad = parseSolfa('tempo: 500\n| d |');
    expect(bad.song.tempo).toBe(90);
    expect(bad.diagnostics).toEqual([
      expect.objectContaining({ code: 'bad-tempo', severity: 'warning', line: 0, col: 7, endCol: 10 }),
    ]);
    expect(codes(parseSolfa('tempo: fast\n| d |').diagnostics)).toEqual(['bad-tempo']);
  });

  it('warns on a bad key and keeps the previous key', () => {
    const r = parseSolfa('key: G\nkey: H#\n| d |');
    expect(r.song.key.name).toBe('G');
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ code: 'bad-key', severity: 'warning', line: 1, col: 5, endCol: 7 }),
    ]);
  });

  it('warns on unknown words in voices:', () => {
    const r = parseSolfa('voices: S X B\n| d |\n| m |');
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ code: 'unknown-voice', line: 0, col: 10, endCol: 11 }),
    ]);
    expect(r.song.voices).toEqual(['S', 'B']);
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

describe('§8 diagnostics', () => {
  it('unknown-char: skips the character', () => {
    const r = parseSolfa('S: | d :r* |');
    expect(r.diagnostics).toEqual([
      { severity: 'error', code: 'unknown-char', message: expect.any(String), line: 0, col: 9, endCol: 10, voice: 'S', bar: 1 },
    ]);
    expect(partsOf(r.song.systems[0]?.lines.S?.beats[1])).toEqual([['r', 0, 1]]);
  });

  it('unknown-char: unmatched braces', () => {
    const r = parseSolfa('S: | d } :r { |');
    expect(r.diagnostics.map((d) => [d.code, d.col, d.endCol])).toEqual([
      ['unknown-char', 7, 8],
      ['unknown-char', 12, 13],
    ]);
  });

  it('bad-note: letters that are not a note', () => {
    const r = parseSolfa('S: | x :rr | D |');
    expect(r.diagnostics.map((d) => [d.code, d.severity, d.col, d.endCol, d.bar])).toEqual([
      ['bad-note', 'error', 5, 6, 1],
      ['bad-note', 'error', 8, 10, 1],
      ['bad-note', 'error', 13, 14, 2],
    ]);
    expect(partsOf(r.song.systems[0]?.lines.S?.beats[0])).toEqual([['_', 0, 1]]);
  });

  it('bad-division: marks out of order, beat split equally', () => {
    const r = parseSolfa('S: | d.r.m |');
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ code: 'bad-division', severity: 'warning', col: 5, endCol: 10 }),
    ]);
    expect(partsOf(r.song.systems[0]?.lines.S?.beats[0])).toEqual([
      ['d', 0, 1 / 3],
      ['r', 1 / 3, 1 / 3],
      ['m', 2 / 3, 1 / 3],
    ]);
  });

  it('bad-division: two notes with no division mark', () => {
    const r = parseSolfa("S: | d'r |");
    expect(codes(r.diagnostics)).toEqual(['bad-division']);
    expect(partsOf(r.song.systems[0]?.lines.S?.beats[0])).toEqual([
      ["d'", 0, 0.5],
      ['r', 0.5, 0.5],
    ]);
  });

  it('bad-division: four commas are split equally', () => {
    const r = parseSolfa('S: | ,d,r,m |');
    expect(codes(r.diagnostics.filter((d) => d.severity !== 'info'))).toEqual(['bad-division']);
    expect(r.song.systems[0]?.lines.S?.beats[0]?.parts).toHaveLength(4);
  });

  it('beat-count-mismatch and bar-count-mismatch', () => {
    const r = parseSolfa('S: | d :r | m :f |\nA: | d :r : m :f |\nT: | d :r | m |');
    expect(r.diagnostics.map((d) => [d.code, d.line, d.voice])).toEqual([
      ['bar-count-mismatch', 1, 'A'],
      ['beat-count-mismatch', 2, 'T'],
    ]);
  });

  it('unknown-voice: more lines than voices', () => {
    const r = parseSolfa('voices: S A\n| d |\n| m |\n  | s |');
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ code: 'unknown-voice', severity: 'warning', line: 3, col: 2, endCol: 7 }),
    ]);
    expect(r.song.voices).toEqual(['S', 'A']);
  });

  it('empty-song: no voice lines at all', () => {
    for (const text of ['', 'title: x\nkey: G', '# only a comment\n\n']) {
      const r = parseSolfa(text);
      expect(r.diagnostics).toEqual([expect.objectContaining({ code: 'empty-song', severity: 'error' })]);
      expect(r.song.systems).toEqual([]);
      expect(r.song.voices).toEqual([]);
    }
  });

  it('reports diagnostics sorted by line and column', () => {
    const r = parseSolfa('S: | x :* |\nA: | y |');
    const pos = r.diagnostics.map((d) => [d.line, d.col]);
    expect(pos).toEqual([...pos].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0)));
  });
});

describe('robustness', () => {
  it('handles CRLF line endings', () => {
    const r = parseSolfa(SPEC_EXAMPLE.replace(/\n/g, '\r\n'));
    expect(r.diagnostics).toEqual([]);
    expect(r.song.systems).toHaveLength(2);
  });

  it('never throws on random input (fuzz)', () => {
    const next = rng(20261106);
    for (let i = 0; i < 3000; i++) {
      const text = randomSolfa(next);
      const r = parseSolfa(text);
      expect(codes(r.diagnostics)).not.toContain('internal-error');
      const lines = text.split(/\r\n|\n|\r/);
      for (const d of r.diagnostics) {
        expect(d.col).toBeGreaterThanOrEqual(0);
        expect(d.endCol).toBeGreaterThanOrEqual(d.col);
        expect(d.endCol).toBeLessThanOrEqual(Math.max(0, lines[d.line]?.length ?? 0));
      }
      for (const sys of r.song.systems) {
        for (const line of Object.values(sys.lines)) {
          expect(line?.beats).toHaveLength(sys.beatCount);
          for (const beat of line?.beats ?? []) {
            const total = beat.parts.reduce((s, p) => s + p.length, 0);
            expect(total).toBeCloseTo(1, 9);
          }
        }
      }
    }
  });

  it('never throws on random unicode', () => {
    const next = rng(7);
    for (let i = 0; i < 500; i++) {
      let s = '';
      const len = Math.floor(next() * 60);
      for (let k = 0; k < len; k++) s += String.fromCharCode(Math.floor(next() * 0x3000));
      expect(() => parseSolfa(s)).not.toThrow();
      expect(codes(parseSolfa(s).diagnostics)).not.toContain('internal-error');
    }
  });
});
