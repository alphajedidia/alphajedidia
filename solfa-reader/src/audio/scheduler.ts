// Pure look-ahead scheduling maths for the player (B-06). No Web Audio here: the player feeds
// it AudioContext times and turns its output into sound, the tests feed it a fake clock.
//
// The clock is a list of anchors (audioTime, beat, bpm). Between anchors the beat grows
// linearly with time. A tempo change adds an anchor at "now", so the position never jumps;
// a loop wrap adds an anchor at the (future) loop end that maps back to the loop start.
// The count-in is an anchor with relative beats -N..0 that maps to the resume beat.
import type { NoteEvent, Sequence, VoiceId } from '../core';
import {
  buildClickGrid,
  clampTempo,
  EMPTY_SEQUENCE,
  lowerBound,
  normalizeLoop,
  soundingDuration,
  type ClickPoint,
} from './beats';
import type { LoopRange } from './types';

/** Scheduler timer period (ms). */
export const TICK_MS = 25;
/** How far ahead notes are scheduled while the page is visible (s). */
export const HORIZON_S = 0.12;
/** Look-ahead while the tab is hidden: browsers may throttle timers to about 1 Hz there. */
export const HIDDEN_HORIZON_S = 1.5;
/** A note cut by a seek / loop start is only played if this much of it is left (beats). */
const MIN_TAIL_BEATS = 0.05;
const EPS = 1e-6;

export interface Anchor {
  /** AudioContext time (s) where this segment starts. */
  time: number;
  /** Song beat at `time` (count-in: relative beat, -N at its start, 0 at its end). */
  beat: number;
  bpm: number;
  countIn: boolean;
  /** Start / seek / loop wrap / end of count-in: notes already sounding there are re-struck. */
  jump: boolean;
}

export interface ScheduledNote {
  voice: VoiceId;
  midi: number;
  /** Audio start time (s). */
  time: number;
  /** Sounding length (s), articulation gap already removed. */
  duration: number;
  /** Song beats actually played (may be cut by a seek or the loop end). */
  startBeat: number;
  endBeat: number;
  /** Index of the source event in `sequence.events`. */
  index: number;
}

export interface ScheduledClick {
  time: number;
  /** First beat of a bar (or of the count-in). */
  accent: boolean;
}

export interface ScheduleChunk {
  notes: ScheduledNote[];
  clicks: ScheduledClick[];
}

export interface ClockPosition {
  /** Song beat (during the count-in: the beat playback will start from). */
  beat: number;
  countIn: boolean;
}

interface IndexedEvent {
  event: NoteEvent;
  index: number;
}


/** Beat clock + look-ahead window generator. Pure: all times are passed in. */
export class Scheduler {
  private seq: Sequence = EMPTY_SEQUENCE;
  private events: IndexedEvent[] = [];
  private grid: ClickPoint[] = [];
  private anchors: Anchor[] = [];
  private cursorTime = 0;
  private cursorBeat = 0;
  private pendingJump = false;
  private resumeBeat = 0;
  private countInBeats = 0;
  private running = false;
  private end: number | null = null;
  private bpm = 100;
  private rawLoop: LoopRange | null = null;
  private loop: LoopRange | null = null;
  private metronome = false;

  get isRunning(): boolean {
    return this.running;
  }
  get tempo(): number {
    return this.bpm;
  }
  get totalBeats(): number {
    return this.seq.totalBeats;
  }
  get loopRange(): LoopRange | null {
    return this.loop;
  }
  /** Audio time at which the song ends (known once scheduled), null otherwise. */
  get endTime(): number | null {
    return this.end;
  }
  get sequence(): Sequence {
    return this.seq;
  }

  /** Use a new sequence (does not change the running state; call start() to re-anchor). */
  load(seq: Sequence): void {
    this.seq = seq;
    this.events = seq.events
      .map((event, index) => ({ event, index }))
      .filter((e) => e.event.durationBeats > 0)
      .sort((a, b) => a.event.startBeat - b.event.startBeat || a.index - b.index);
    this.grid = buildClickGrid(seq);
    this.loop = normalizeLoop(this.rawLoop, seq.totalBeats);
  }

  setLoop(range: LoopRange | null): void {
    this.rawLoop = range ? { ...range } : null;
    this.loop = normalizeLoop(this.rawLoop, this.seq.totalBeats);
  }

  setMetronome(on: boolean): void {
    this.metronome = on;
  }

  /** Start the clock: `beat` sounds at audio `time` (after one bar of clicks with countIn). */
  start(time: number, beat: number, opts: { countIn?: boolean } = {}): void {
    this.running = true;
    this.end = null;
    this.anchors = [];
    const b = Math.min(Math.max(beat, 0), this.seq.totalBeats);
    if (opts.countIn) {
      this.countInBeats = Math.max(1, Math.round(this.seq.beatsPerBar));
      this.resumeBeat = b;
      this.pushAnchor({ time, beat: -this.countInBeats, bpm: this.bpm, countIn: true, jump: false });
    } else {
      this.pushAnchor({ time, beat: b, bpm: this.bpm, countIn: false, jump: true });
    }
  }

  stop(): void {
    this.running = false;
    this.anchors = [];
    this.end = null;
  }

  /** Change tempo; while running the position at `now` is kept. */
  setTempo(now: number, bpm: number): void {
    this.bpm = clampTempo(bpm);
    if (this.running) this.replan(now);
  }

  /**
   * Forget everything scheduled after `now` and continue from the position at `now` with the
   * current tempo/loop/metronome. The caller must cancel the notes and clicks it scheduled at
   * or after `now`; notes already sounding are kept (not re-emitted).
   */
  replan(now: number): void {
    if (!this.running || this.anchors.length === 0) return;
    if (this.end !== null && now >= this.end) return;
    this.end = null;
    const first = this.anchors[0]!;
    let base: Anchor;
    if (now <= first.time) {
      base = { ...first, bpm: this.bpm };
    } else {
      const a = this.activeAnchor(now);
      const beat = a.beat + ((now - a.time) * a.bpm) / 60;
      base =
        a.countIn && beat >= 0
          ? { time: now, beat: this.resumeBeat + beat, bpm: this.bpm, countIn: false, jump: true }
          : // An anchor exactly at `now` had its notes cancelled too: keep its re-strike flag.
            { time: now, beat, bpm: this.bpm, countIn: a.countIn, jump: a.time === now && a.jump };
    }
    this.anchors = this.anchors.filter((x) => x.time < base.time);
    this.pushAnchor(base);
  }

  /** Song position heard at audio `time`. */
  positionAt(time: number): ClockPosition {
    const first = this.anchors[0];
    if (!this.running || !first) return { beat: 0, countIn: false };
    if (time <= first.time) {
      return first.countIn ? { beat: this.resumeBeat, countIn: true } : { beat: first.beat, countIn: false };
    }
    const a = this.activeAnchor(time);
    let beat = a.beat + ((time - a.time) * a.bpm) / 60;
    if (a.countIn) {
      if (beat < 0) return { beat: this.resumeBeat, countIn: true };
      beat += this.resumeBeat;
    }
    const loop = this.loop;
    if (loop && a.beat < loop.endBeat - EPS && beat >= loop.endBeat) {
      // Only reached if the scheduler fell behind; wrap mathematically.
      beat = loop.startBeat + ((beat - loop.endBeat) % (loop.endBeat - loop.startBeat));
    }
    return { beat: Math.min(Math.max(beat, 0), this.seq.totalBeats), countIn: false };
  }

  /** Audio time of song `beat` on the current (last) segment — used to re-time sounding notes. */
  timeAtBeat(beat: number): number {
    const a = this.anchors[this.anchors.length - 1];
    if (!a) return 0;
    const rel = a.countIn ? beat - this.resumeBeat : beat;
    return a.time + ((rel - a.beat) * 60) / a.bpm;
  }

  /** Everything that starts before `now + horizon` and was not returned yet. */
  advance(now: number, horizon: number): ScheduleChunk {
    const chunk: ScheduleChunk = { notes: [], clicks: [] };
    if (!this.running) return chunk;
    const until = now + horizon;
    for (let guard = 0; guard < 10_000 && this.end === null && this.cursorTime < until - 1e-9; guard++) {
      const a = this.anchors[this.anchors.length - 1]!;
      const { limit, wraps } = this.segmentLimit(a);
      const bps = a.bpm / 60;
      const reach = a.beat + (until - a.time) * bps;
      const to = Math.min(reach, limit);
      if (a.countIn) this.emitCountIn(this.cursorBeat, to, a, chunk);
      else this.emitSong(this.cursorBeat, to, a, wraps ? limit : Infinity, chunk);
      this.pendingJump = false;
      if (reach < limit - EPS) {
        this.cursorTime = until;
        this.cursorBeat = to;
        break;
      }
      const t = a.time + (limit - a.beat) / bps;
      if (a.countIn) {
        this.pushAnchor({ time: t, beat: this.resumeBeat, bpm: a.bpm, countIn: false, jump: true });
      } else if (wraps && this.loop) {
        this.pushAnchor({ time: t, beat: this.loop.startBeat, bpm: a.bpm, countIn: false, jump: true });
      } else {
        this.end = t;
        this.cursorTime = t;
        this.cursorBeat = limit;
      }
    }
    this.prune(now);
    return chunk;
  }

  private pushAnchor(a: Anchor): void {
    this.anchors.push(a);
    this.cursorTime = a.time;
    this.cursorBeat = a.beat;
    this.pendingJump = a.jump;
  }

  private activeAnchor(time: number): Anchor {
    for (let i = this.anchors.length - 1; i > 0; i--) {
      if (this.anchors[i]!.time <= time) return this.anchors[i]!;
    }
    return this.anchors[0]!;
  }

  private segmentLimit(a: Anchor): { limit: number; wraps: boolean } {
    if (a.countIn) return { limit: 0, wraps: false };
    const loop = this.loop;
    if (loop && this.cursorBeat < loop.endBeat - EPS) return { limit: loop.endBeat, wraps: true };
    return { limit: this.seq.totalBeats, wraps: false };
  }

  private emitCountIn(from: number, to: number, a: Anchor, chunk: ScheduleChunk): void {
    const bps = a.bpm / 60;
    for (let k = Math.ceil(from - EPS); k < to - EPS; k++) {
      chunk.clicks.push({ time: a.time + (k - a.beat) / bps, accent: k === -this.countInBeats });
    }
  }

  private emitSong(from: number, to: number, a: Anchor, cut: number, chunk: ScheduleChunk): void {
    const bps = a.bpm / 60;
    const timeOf = (beat: number) => a.time + (beat - a.beat) / bps;
    const push = (e: IndexedEvent, start: number) => {
      const end = Math.min(e.event.startBeat + e.event.durationBeats, cut, this.seq.totalBeats);
      if (end - start <= EPS) return;
      chunk.notes.push({
        voice: e.event.voice,
        midi: e.event.midi,
        time: timeOf(start),
        duration: soundingDuration((end - start) / bps),
        startBeat: start,
        endBeat: end,
        index: e.index,
      });
    };
    if (this.pendingJump) {
      // Notes already sounding at the jump point are struck again from there.
      for (const e of this.events) {
        if (e.event.startBeat >= from - EPS) break;
        if (e.event.startBeat + e.event.durationBeats - from > MIN_TAIL_BEATS) push(e, from);
      }
    }
    for (let i = lowerBound(this.events, from - EPS, (e) => e.event.startBeat); i < this.events.length; i++) {
      const e = this.events[i]!;
      if (e.event.startBeat >= to - EPS) break;
      push(e, e.event.startBeat);
    }
    if (!this.metronome) return;
    for (let i = lowerBound(this.grid, from - EPS, (c) => c.beat); i < this.grid.length; i++) {
      const c = this.grid[i]!;
      if (c.beat >= to - EPS) break;
      chunk.clicks.push({ time: timeOf(c.beat), accent: c.accent });
    }
  }

  /** Keep one anchor older than 1 s (position queries lag the clock by the output latency). */
  private prune(now: number): void {
    while (this.anchors.length > 1 && this.anchors[1]!.time <= now - 1) this.anchors.shift();
  }
}
