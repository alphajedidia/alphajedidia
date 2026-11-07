import { describe, expect, it } from 'vitest';
import { formatSolfa } from './format';
import { parseSolfa } from './parser';
import { buildSequence } from './sequencer';
import { SPEC_EXAMPLE, partsOf, randomSolfa, rng } from './test-helpers';

/** Everything the player hears (sources are left out: columns move when formatting). */
function meaning(text: string): unknown {
  const { song, diagnostics } = parseSolfa(text);
  const seq = buildSequence(song);
  return {
    events: seq.events.map((e) => [e.voice, e.midi, e.startBeat, e.durationBeats, e.bar]),
    bars: seq.bars,
    totalBeats: seq.totalBeats,
    beatsPerBar: seq.beatsPerBar,
    voices: seq.voices,
    systems: song.systems.map((s) => ({
      key: s.key,
      words: s.words,
      startBeat: s.startBeat,
      beatCount: s.beatCount,
      lines: Object.values(s.lines).map((l) => [l?.voice, l?.endsWithBar, l?.beats.map((b) => [b.accent, partsOf(b)])]),
    })),
    head: [song.title, song.composer, song.key, song.time, song.tempo, song.meta],
    codes: diagnostics.map((d) => [d.code, d.line, d.voice, d.bar]),
  };
}

/** Columns of every separator of a line. */
const sepCols = (line: string): number[] =>
  [...line.matchAll(/\|\|?|:|!|¦/g)].map((m) => m.index ?? -1);

describe('formatSolfa', () => {
  it('aligns beat columns across voices and spaces separators canonically', () => {
    const input = 'title: X\nS:|d:r.m|f:-|\nAlto: | d :t, | l, :- ||';
    expect(formatSolfa(input)).toBe('title: X\nS:    | d :r.m | f  :- |\nAlto: | d :t,  | l, :- ||');
  });

  it('puts every separator of a system at the same column', () => {
    const out = formatSolfa(SPEC_EXAMPLE).split('\n');
    const sys1 = out.slice(5, 9);
    const sys2 = out.slice(11, 15);
    for (const sys of [sys1, sys2]) {
      const ref = sepCols(sys[0] ?? '');
      expect(ref.length).toBeGreaterThan(0);
      for (const line of sys) expect(sepCols(line)).toEqual(ref);
    }
    expect(out[5]).toBe('S: | m :m :f  :s  | s  :f  :m  :r  |');
    expect(out[8]).toBe('B: | d :d :f, :s, | m, :r, :d, :s, |');
  });

  it('keeps headers, words, comments and blank lines unchanged', () => {
    const input = 'title:   Spaced   \n# comment  \n\n   \nS: | d :r |\nW:  words  here\n// end';
    const out = formatSolfa(input).split('\n');
    expect(out[0]).toBe('title:   Spaced   ');
    expect(out[1]).toBe('# comment  ');
    expect(out[2]).toBe('');
    expect(out[3]).toBe('   ');
    expect(out[5]).toBe('W:  words  here');
    expect(out[6]).toBe('// end');
  });

  it('aligns the closing bar line of a shorter voice under the others', () => {
    const out = formatSolfa('S: | d :r :m |\nA: | d :r |').split('\n');
    expect(out).toEqual(['S: | d :r :m |', 'A: | d :r |']);
  });

  it('aligns a pick-up with and without a leading separator', () => {
    const out = formatSolfa('S: :s, | d |\nA: m | d |').split('\n');
    expect(out).toEqual(['S: :s, | d |', 'A:  m  | d |']);
  });

  it('pads labels and unlabelled lines', () => {
    const out = formatSolfa('Soprano: | d |\n| m |').split('\n');
    expect(out).toEqual(['Soprano: | d |', '         | m |']);
  });

  it('keeps braces, rest beats and mixed separators', () => {
    const input = 'S: {f} | d {rall.} : !m | {D.C.}\nA: | d : !m |';
    const out = formatSolfa(input);
    expect(out).toBe('S: {f} | d {rall.} : !m | {D.C.}\nA:     | d         : !m |');
    expect(meaning(out)).toEqual(meaning(input));
  });

  it('never glues separators together', () => {
    expect(formatSolfa('S: | | d ::')).toBe('S: |  | d : :');
    expect(meaning('S: | | d ::')).toEqual(meaning(formatSolfa('S: | | d ::')));
  });

  it('is idempotent and keeps the meaning of the spec example', () => {
    const once = formatSolfa(SPEC_EXAMPLE);
    expect(formatSolfa(once)).toBe(once);
    expect(meaning(once)).toEqual(meaning(SPEC_EXAMPLE));
  });

  it('formats each system on its own', () => {
    const out = formatSolfa('S: | dddd |\n\nS: | d |\nA: | m |').split('\n');
    expect(out[2]).toBe('S: | d |');
  });

  it('normalises line endings to \\n and keeps a final newline', () => {
    expect(formatSolfa('S: |d|\r\nA: |m|\r\n')).toBe('S: | d |\nA: | m |\n');
  });

  it('is idempotent and meaning-preserving on random input (fuzz)', () => {
    const next = rng(42);
    for (let i = 0; i < 2000; i++) {
      const text = randomSolfa(next);
      const once = formatSolfa(text);
      expect(formatSolfa(once), JSON.stringify(text)).toBe(once);
      expect(meaning(once), JSON.stringify(text)).toEqual(meaning(text));
    }
  });
});
