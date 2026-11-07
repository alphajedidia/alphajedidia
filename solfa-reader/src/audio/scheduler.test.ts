import { describe, expect, it } from 'vitest';
import type { BarInfo, NoteEvent, Sequence } from '../core';
import { articulationGap, soundingDuration } from './beats';
import { HORIZON_S, Scheduler, TICK_MS, type ScheduledClick, type ScheduledNote } from './scheduler';

function note(startBeat: number, durationBeats = 1, midi = 60, voice: NoteEvent['voice'] = 'S'): NoteEvent {
  return { voice, midi, startBeat, durationBeats, bar: 1 };
}

function makeSeq(events: NoteEvent[], totalBeats: number, bars: BarInfo[] = [], beatsPerBar = 4): Sequence {
  return { events, totalBeats, bars, beatsPerBar, voices: ['S'] };
}

/** Four bars of quarter notes in 4/4 (16 beats, one note per beat, midi 60 + beat). */
function scale16(): Sequence {
  const events = Array.from({ length: 16 }, (_, i) => note(i, 1, 60 + i));
  const bars = [0, 4, 8, 12].map((startBeat, i) => ({ number: i + 1, startBeat, system: 0 }));
  return makeSeq(events, 16, bars);
}

/**
 * Fake player: ticks the scheduler every 25 ms like the real one and records what it would play.
 * `cancelFrom(now)` mimics the player dropping notes/clicks that have not started yet.
 */
class FakePlayer {
  notes: ScheduledNote[] = [];
  clicks: ScheduledClick[] = [];
  /** Time each note was handed over (must not be after the note time). */
  emittedAt = new Map<ScheduledNote, number>();
  t: number;
  constructor(
    public s: Scheduler,
    start = 0,
  ) {
    this.t = start;
  }
  runUntil(end: number): void {
    for (; this.t <= end + 1e-9; this.t += TICK_MS / 1000) {
      const chunk = this.s.advance(this.t, HORIZON_S);
      for (const n of chunk.notes) {
        this.notes.push(n);
        this.emittedAt.set(n, this.t);
      }
      this.clicks.push(...chunk.clicks);
    }
  }
  cancelFrom(now: number): void {
    this.notes = this.notes.filter((n) => n.time < now);
    this.clicks = this.clicks.filter((c) => c.time < now);
  }
  times(): number[] {
    return this.notes.map((n) => round(n.time));
  }
}

const round = (x: number) => Math.round(x * 1e6) / 1e6;

describe('Scheduler — beat clock', () => {
  it('schedules every note once, ahead of time, at 60/tempo seconds per beat', () => {
    const s = new Scheduler();
    s.load(scale16());
    s.setTempo(0, 120);
    s.start(0, 0);
    const p = new FakePlayer(s);
    p.runUntil(9);
    expect(p.times()).toEqual(Array.from({ length: 16 }, (_, i) => i * 0.5));
    expect(p.notes.map((n) => n.midi)).toEqual(Array.from({ length: 16 }, (_, i) => 60 + i));
    for (const n of p.notes) {
      expect(p.emittedAt.get(n)!).toBeLessThanOrEqual(n.time + 1e-9);
      expect(n.duration).toBeCloseTo(0.5 - articulationGap(0.5));
    }
    expect(s.endTime).toBeCloseTo(8);
    expect(s.positionAt(4).beat).toBeCloseTo(8);
    expect(s.positionAt(100).beat).toBe(16);
  });

  it('keeps the position when the tempo changes mid-play', () => {
    const s = new Scheduler();
    s.load(scale16());
    s.setTempo(0, 120);
    s.start(0, 0);
    const p = new FakePlayer(s);
    p.runUntil(1.2); // beat 2.4
    const now = 1.2;
    expect(s.positionAt(now).beat).toBeCloseTo(2.4);
    s.setTempo(now, 60);
    p.cancelFrom(now);
    expect(s.positionAt(now).beat).toBeCloseTo(2.4);
    expect(s.positionAt(now + 1).beat).toBeCloseTo(3.4); // 1 beat per second now
    p.runUntil(6);
    // Beats 0,1,2 at the old tempo; beat 3 is 0.6 beat after the change = 0.6 s later.
    expect(p.times().slice(0, 6)).toEqual([0, 0.5, 1, 1.8, 2.8, 3.8]);
    expect(new Set(p.notes.map((n) => n.startBeat)).size).toBe(p.notes.length); // no duplicates
    // Sounding note (beat 2, started at 1.0) ends at beat 3 = 1.8 s on the new clock.
    expect(s.timeAtBeat(3)).toBeCloseTo(1.8);
  });

  it('applies a tempo change made before the first note (start delay)', () => {
    const s = new Scheduler();
    s.load(scale16());
    s.setTempo(0, 120);
    s.start(0.06, 0);
    s.setTempo(0, 60);
    const p = new FakePlayer(s);
    p.runUntil(2.2);
    expect(p.times()).toEqual([0.06, 1.06, 2.06]);
    expect(s.positionAt(0).beat).toBe(0);
  });

  it('seeks: restarts at a beat and re-strikes the note sounding there', () => {
    const events = [note(0, 1), note(1, 3, 62), note(4, 1, 64)];
    const s = new Scheduler();
    s.load(makeSeq(events, 5));
    s.setTempo(0, 60);
    s.start(0, 0);
    const p = new FakePlayer(s);
    p.runUntil(0.5);
    p.cancelFrom(0.5); // the player cancels everything on seek
    s.start(0.5, 2.5);
    p.runUntil(5);
    const after = p.notes.filter((n) => n.time >= 0.5);
    expect(after.map((n) => [round(n.time), n.midi, n.startBeat, n.endBeat])).toEqual([
      [0.5, 62, 2.5, 4],
      [2, 64, 4, 5],
    ]);
    expect(after[0]!.duration).toBeCloseTo(soundingDuration(1.5));
    expect(s.positionAt(1).beat).toBeCloseTo(3);
  });

  it('pause and resume continue from the paused beat', () => {
    const s = new Scheduler();
    s.load(scale16());
    s.setTempo(0, 120);
    s.start(0, 0);
    const p = new FakePlayer(s);
    p.runUntil(0.75);
    const paused = s.positionAt(0.75).beat;
    expect(paused).toBeCloseTo(1.5);
    s.stop();
    expect(s.isRunning).toBe(false);
    expect(s.advance(1, 1).notes).toEqual([]);
    p.cancelFrom(0.75);
    s.start(10, paused);
    const resumed = new FakePlayer(s, 10);
    resumed.runUntil(11);
    // Beat 1 note (still sounding at 1.5) is re-struck for its remaining half beat.
    expect(resumed.notes.map((n) => [round(n.time), n.startBeat, n.endBeat])).toEqual([
      [10, 1.5, 2],
      [10.25, 2, 3],
      [10.75, 3, 4],
    ]);
  });

  it('loops seamlessly between two beats', () => {
    const events = [note(0, 1, 60), note(0.5, 1, 61, 'A'), note(1, 1, 62), note(2, 2, 64), note(4, 1, 65)];
    const s = new Scheduler();
    s.load(makeSeq(events, 5));
    s.setTempo(0, 60);
    s.setLoop({ startBeat: 1, endBeat: 3 });
    s.start(0, 0);
    const p = new FakePlayer(s);
    p.runUntil(3.3);
    expect(s.positionAt(2.5).beat).toBeCloseTo(2.5);
    expect(s.positionAt(3.25).beat).toBeCloseTo(1.25);
    p.runUntil(7.1);
    const rows = p.notes.map((n) => [round(n.time), n.midi, n.startBeat, n.endBeat]);
    expect(rows).toEqual([
      [0, 60, 0, 1],
      [0.5, 61, 0.5, 1.5],
      [1, 62, 1, 2],
      [2, 64, 2, 3], // cut at the loop end
      [3, 61, 1, 1.5], // held into the loop start: struck again
      [3, 62, 1, 2],
      [4, 64, 2, 3],
      [5, 61, 1, 1.5],
      [5, 62, 1, 2],
      [6, 64, 2, 3],
      [7, 61, 1, 1.5],
      [7, 62, 1, 2],
    ]);
    expect(s.endTime).toBeNull();
    expect(s.positionAt(6.5).beat).toBeCloseTo(2.5);
    expect(s.positionAt(7.05).beat).toBeCloseTo(1.05);
  });

  it('keeps the loop when the tempo changes right before the wrap', () => {
    const s = new Scheduler();
    s.load(scale16());
    s.setTempo(0, 60);
    s.setLoop({ startBeat: 0, endBeat: 2 });
    s.start(0, 0);
    const p = new FakePlayer(s);
    p.runUntil(1.95); // the wrap at t=2 is already planned
    s.setTempo(1.95, 120);
    p.cancelFrom(1.95);
    p.runUntil(4);
    // Beat 1.95 → 2 takes 0.025 s at 120 bpm, then the loop restarts.
    expect(p.times()).toEqual([0, 1, 1.975, 2.475, 2.975, 3.475, 3.975]);
    expect(p.notes.map((n) => n.startBeat)).toEqual([0, 1, 0, 1, 0, 1, 0]);
  });

  it('plays one bar of count-in clicks before the music', () => {
    const s = new Scheduler();
    s.load(scale16());
    s.setTempo(0, 120);
    s.start(0, 4, { countIn: true });
    const p = new FakePlayer(s);
    p.runUntil(3);
    expect(p.clicks.map((c) => [round(c.time), c.accent])).toEqual([
      [0, true],
      [0.5, false],
      [1, false],
      [1.5, false],
    ]);
    expect(p.notes[0]).toMatchObject({ time: 2, startBeat: 4 });
    expect(s.positionAt(1)).toEqual({ beat: 4, countIn: true });
    expect(s.positionAt(2.5).countIn).toBe(false);
    expect(s.positionAt(2.5).beat).toBeCloseTo(5);
  });

  it('changes tempo during the count-in', () => {
    const s = new Scheduler();
    s.load(scale16());
    s.setTempo(0, 120);
    s.start(0, 0, { countIn: true });
    const p = new FakePlayer(s);
    p.runUntil(0.75); // relative beat -2.5
    s.setTempo(0.75, 60);
    p.cancelFrom(0.75);
    p.runUntil(4);
    expect(p.clicks.map((c) => round(c.time))).toEqual([0, 0.5, 1.25, 2.25]);
    expect(round(p.notes[0]!.time)).toBe(3.25);
    expect(s.positionAt(3).countIn).toBe(true);
  });

  it('adds metronome clicks only when switched on, accented on bar starts', () => {
    const s = new Scheduler();
    s.load(scale16());
    s.setTempo(0, 60);
    s.setMetronome(true);
    s.start(0, 2);
    const p = new FakePlayer(s);
    p.runUntil(3.5);
    expect(p.clicks.map((c) => [round(c.time), c.accent])).toEqual([
      [0, false],
      [1, false],
      [2, true],
      [3, false],
    ]);
    s.setMetronome(false);
    s.replan(3.5);
    p.cancelFrom(3.5);
    p.runUntil(6);
    expect(p.clicks).toHaveLength(4);
  });

  it('ends at the last beat and does not wrap without a loop', () => {
    const s = new Scheduler();
    s.load(makeSeq([note(0, 2)], 2));
    s.setTempo(0, 60);
    s.start(0, 0);
    const p = new FakePlayer(s);
    p.runUntil(3);
    expect(p.notes).toHaveLength(1);
    expect(s.endTime).toBeCloseTo(2);
    s.replan(2.5); // after the end: nothing changes
    expect(s.endTime).toBeCloseTo(2);
  });

  it('handles an empty sequence', () => {
    const s = new Scheduler();
    s.start(0, 0);
    expect(s.advance(0, HORIZON_S)).toEqual({ notes: [], clicks: [] });
    expect(s.endTime).toBe(0);
  });

  it('re-normalises the loop when a new sequence is loaded', () => {
    const s = new Scheduler();
    s.setLoop({ startBeat: 4, endBeat: 8 });
    expect(s.loopRange).toBeNull(); // nothing loaded yet
    s.load(scale16());
    expect(s.loopRange).toEqual({ startBeat: 4, endBeat: 8 });
    s.load(makeSeq([], 6));
    expect(s.loopRange).toEqual({ startBeat: 4, endBeat: 6 });
  });
});
