import { describe, expect, it } from 'vitest';
import type { NoteEvent, Song } from './model';
import { parseSolfa } from './parser';
import { buildSequence, computeBars } from './sequencer';
import { SPEC_EXAMPLE } from './test-helpers';

const seqOf = (text: string, opts?: Parameters<typeof buildSequence>[1]) => buildSequence(parseSolfa(text).song, opts);
/** [midi, startBeat, durationBeats, bar] of one voice. */
const notes = (events: NoteEvent[], voice = 'S') =>
  events.filter((e) => e.voice === voice).map((e) => [e.midi, e.startBeat, e.durationBeats, e.bar]);

describe('buildSequence', () => {
  it('sequences the §1 example', () => {
    const seq = seqOf(SPEC_EXAMPLE);
    expect(seq.totalBeats).toBe(16);
    expect(seq.beatsPerBar).toBe(4);
    expect(seq.voices).toEqual(['S', 'A', 'T', 'B']);
    expect(seq.bars).toEqual([
      { number: 1, startBeat: 0, system: 0 },
      { number: 2, startBeat: 4, system: 0 },
      { number: 3, startBeat: 8, system: 1 },
      { number: 4, startBeat: 12, system: 1 },
    ]);
    expect(notes(seq.events, 'S')).toEqual([
      [71, 0, 1, 1],
      [71, 1, 1, 1],
      [72, 2, 1, 1],
      [74, 3, 1, 1],
      [74, 4, 1, 2],
      [72, 5, 1, 2],
      [71, 6, 1, 2],
      [69, 7, 1, 2],
      [79, 8, 1, 3],
      [78, 9, 1, 3],
      [76, 10, 1, 3],
      [74, 11, 1, 3],
      [74, 12, 4, 4],
    ]);
    expect(notes(seq.events, 'B').map((n) => n[0])).toEqual([55, 55, 48, 50, 47, 45, 43, 50, 55, 50, 52, 55, 50]);
    expect(notes(seq.events, 'B').at(-1)).toEqual([50, 12, 4, 4]);
  });

  it('sorts events by start beat, then voice order', () => {
    const seq = seqOf(SPEC_EXAMPLE);
    const keys = seq.events.map((e) => [e.startBeat, 'SATB'.indexOf(e.voice)]);
    expect(keys).toEqual([...keys].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0)));
  });

  it('keeps the beat source on events', () => {
    const seq = seqOf('S: | d :r |');
    expect(seq.events[1]?.source).toEqual({ line: 0, col: 8, endCol: 9 });
  });

  it('merges holds into the previous note, also across bars', () => {
    const seq = seqOf('| d :r :m :f | - :- :s :- |');
    expect(notes(seq.events)).toEqual([
      [60, 0, 1, 1],
      [62, 1, 1, 1],
      [64, 2, 1, 1],
      [65, 3, 3, 1],
      [67, 6, 2, 2],
    ]);
  });

  it('merges holds across systems', () => {
    const seq = seqOf('S: | d :r |\n\nS: | - :m |');
    expect(notes(seq.events)).toEqual([
      [60, 0, 1, 1],
      [62, 1, 2, 1],
      [64, 3, 1, 2],
    ]);
  });

  it('merges holds inside a beat', () => {
    expect(notes(seqOf('| d.- :-.r |').events)).toEqual([
      [60, 0, 1.5, 1],
      [62, 1.5, 0.5, 1],
    ]);
  });

  it('skips rests', () => {
    expect(notes(seqOf('| d : :m |').events)).toEqual([
      [60, 0, 1, 1],
      [64, 2, 1, 1],
    ]);
    expect(notes(seqOf('| .d :m |').events)).toEqual([
      [60, 0.5, 0.5, 1],
      [64, 1, 1, 1],
    ]);
  });

  it('puts a pick-up in bar 0', () => {
    const seq = seqOf(':s, | d :- :m | r :- :- |');
    expect(seq.beatsPerBar).toBe(3);
    expect(seq.bars).toEqual([
      { number: 0, startBeat: 0, system: 0 },
      { number: 1, startBeat: 1, system: 0 },
      { number: 2, startBeat: 4, system: 0 },
    ]);
    expect(notes(seq.events)).toEqual([
      [55, 0, 1, 0],
      [60, 1, 2, 1],
      [64, 3, 1, 1],
      [62, 4, 3, 2],
    ]);
  });

  it('uses time: for beatsPerBar, else the first complete bar, else 4', () => {
    expect(seqOf('time: 6/8\n| d :r |').beatsPerBar).toBe(6);
    expect(seqOf('| d :r | m :f |').beatsPerBar).toBe(2);
    expect(seqOf('d :r :m').beatsPerBar).toBe(4);
  });

  it('starts a new bar after a system that ends with a bar line', () => {
    const seq = seqOf('S: | d :r |\n\nS: m :f |');
    expect(seq.bars.map((b) => [b.number, b.startBeat, b.system])).toEqual([
      [1, 0, 0],
      [2, 2, 1],
    ]);
  });

  it('continues a bar across systems when the line does not end with a bar line', () => {
    const seq = seqOf('S: | d :r\n\nS: :m :f | s |');
    expect(seq.bars.map((b) => [b.number, b.startBeat])).toEqual([
      [1, 0],
      [2, 4],
    ]);
  });

  it('makes regular bars when there is no bar line at all', () => {
    const seq = seqOf('time: 2/4\nd :r :m :f :s');
    expect(seq.bars.map((b) => [b.number, b.startBeat])).toEqual([
      [1, 0],
      [2, 2],
      [3, 4],
    ]);
    expect(notes(seq.events).map((n) => n[3])).toEqual([1, 1, 2, 2, 3]);
  });

  it('applies transpose and per-voice octave shift', () => {
    const text = 'S: | d |\nT: | d |';
    const seq = seqOf(text, { transpose: 2, octaveShift: { T: 1 } });
    expect(notes(seq.events, 'S')).toEqual([[62, 0, 1, 1]]);
    expect(notes(seq.events, 'T')).toEqual([[62, 0, 1, 1]]);
  });

  it('uses the key of each system', () => {
    const seq = seqOf('key: G\nS: | d |\n\nkey: D\nS: | d |');
    expect(notes(seq.events).map((n) => n[0])).toEqual([67, 62]);
  });

  it('closes a held note when the voice is missing from a system', () => {
    const seq = seqOf('S: | d |\nA: | m |\n\nS: | - |\n\nS: | - |\nA: | - |');
    expect(notes(seq.events, 'S')).toEqual([[60, 0, 3, 1]]);
    expect(notes(seq.events, 'A')).toEqual([[64, 0, 1, 1]]);
  });

  it('handles an empty song', () => {
    const seq = seqOf('');
    expect(seq).toEqual({ events: [], totalBeats: 0, bars: [], beatsPerBar: 4, voices: [] });
  });

  it('tolerates hand-built songs with short lines and no voices list', () => {
    const song: Song = {
      title: 'x',
      key: { tonic: 0, name: 'C' },
      tempo: 90,
      voices: [],
      meta: {},
      systems: [
        {
          key: { tonic: 0, name: 'C' },
          words: [],
          startBeat: 0,
          beatCount: 3,
          lines: {
            S: {
              voice: 'S',
              line: 0,
              beats: [
                { accent: 'bar', parts: [{ item: { kind: 'note', degree: 'd', alter: 0, octave: 0, text: 'd' }, start: 0, length: 1 }] },
                { accent: 'weak', parts: [{ item: { kind: 'hold' }, start: 0, length: 1 }] },
              ],
            },
          },
        },
      ],
    };
    const seq = buildSequence(song);
    expect(seq.voices).toEqual(['S']);
    expect(notes(seq.events)).toEqual([[60, 0, 2, 1]]);
    expect(seq.totalBeats).toBe(3);
  });
});

describe('computeBars', () => {
  it('numbers bars from the top voice of each system', () => {
    const song = parseSolfa('S: | d :r | m :f |\nA: | d :r : m :f |').song;
    expect(computeBars(song, 2).map((b) => b.startBeat)).toEqual([0, 2]);
  });
});
