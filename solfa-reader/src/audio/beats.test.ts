import { describe, expect, it } from 'vitest';
import type { BarInfo, Sequence } from '../core';
import { articulationGap, barAt, buildClickGrid, clampTempo, lowerBound, normalizeLoop, soundingDuration } from './beats';

function makeSeq(totalBeats: number, bars: BarInfo[] = [], beatsPerBar = 4): Sequence {
  return { events: [], totalBeats, bars, beatsPerBar, voices: ['S'] };
}

describe('timing helpers', () => {
  it('articulation gap is 4 % of the note, at most 40 ms', () => {
    expect(articulationGap(0.5)).toBeCloseTo(0.02);
    expect(articulationGap(1)).toBeCloseTo(0.04);
    expect(articulationGap(3)).toBeCloseTo(0.04);
    expect(articulationGap(-1)).toBe(0);
    expect(soundingDuration(0.5)).toBeCloseTo(0.48);
    expect(soundingDuration(2)).toBeCloseTo(1.96);
  });

  it('clamps tempo and loops', () => {
    expect(clampTempo(5)).toBe(20);
    expect(clampTempo(1000)).toBe(400);
    expect(clampTempo(Number.NaN)).toBe(100);
    expect(normalizeLoop({ startBeat: -2, endBeat: 99 }, 16)).toEqual({ startBeat: 0, endBeat: 16 });
    expect(normalizeLoop({ startBeat: 4, endBeat: 4.1 }, 16)).toBeNull();
    expect(normalizeLoop({ startBeat: 8, endBeat: 4 }, 16)).toBeNull();
    expect(normalizeLoop(null, 16)).toBeNull();
  });

  it('finds the bar of a beat, pick-up = bar 0', () => {
    const bars = [
      { number: 0, startBeat: 0, system: 0 },
      { number: 1, startBeat: 1, system: 0 },
      { number: 2, startBeat: 5, system: 0 },
    ];
    const seq = makeSeq(9, bars);
    expect(barAt(seq, 0)).toBe(0);
    expect(barAt(seq, 0.99)).toBe(0);
    expect(barAt(seq, 1)).toBe(1);
    expect(barAt(seq, 4.5)).toBe(1);
    expect(barAt(seq, 5)).toBe(2);
    expect(barAt(seq, 8.9)).toBe(2);
    expect(barAt(makeSeq(8, [], 4), 5)).toBe(2);
  });

  it('builds metronome clicks with accents on bar starts and a backwards pick-up', () => {
    const bars = [
      { number: 0, startBeat: 0, system: 0 },
      { number: 1, startBeat: 1, system: 0 },
      { number: 2, startBeat: 5, system: 0 },
    ];
    expect(buildClickGrid(makeSeq(9, bars))).toEqual([
      { beat: 0, accent: false },
      { beat: 1, accent: true },
      { beat: 2, accent: false },
      { beat: 3, accent: false },
      { beat: 4, accent: false },
      { beat: 5, accent: true },
      { beat: 6, accent: false },
      { beat: 7, accent: false },
      { beat: 8, accent: false },
    ]);
    // 1.5-beat pick-up: clicks stay on the beat grid of bar 1 (0.5 beat before the downbeat).
    const half = [
      { number: 0, startBeat: 0, system: 0 },
      { number: 1, startBeat: 1.5, system: 0 },
    ];
    expect(buildClickGrid(makeSeq(3.5, half)).map((c) => c.beat)).toEqual([0.5, 1.5, 2.5]);
    // No bar info: accent every beatsPerBar beats.
    expect(buildClickGrid(makeSeq(6, [], 3)).map((c) => c.accent)).toEqual([true, false, false, true, false, false]);
  });
});

describe('lowerBound', () => {
  it('finds the first item at or after a beat', () => {
    const items = [0, 1, 1, 2.5, 4];
    const id = (x: number) => x;
    expect(lowerBound(items, -1, id)).toBe(0);
    expect(lowerBound(items, 1, id)).toBe(1);
    expect(lowerBound(items, 1.5, id)).toBe(3);
    expect(lowerBound(items, 9, id)).toBe(5);
  });
});
