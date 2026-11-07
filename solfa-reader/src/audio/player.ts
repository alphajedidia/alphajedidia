// Web Audio player (B-06): thin glue between the pure Scheduler (timing), the synth (sound)
// and the UI (position events). All timing decisions live in scheduler.ts.
import type { Sequence, VoiceId } from '../core';
import { getAudioContext, isAudioSupported, resumeAudio } from './context';
import { completeMix, computeVoiceGains, MIX_VOICES } from './mix';
import { articulationGap, barAt, clampTempo, EMPTY_SEQUENCE } from './beats';
import { HIDDEN_HORIZON_S, HORIZON_S, Scheduler, TICK_MS, type ScheduleChunk } from './scheduler';
import { createVoiceBuses, glideParam, startClick, startNote, type ClickHandle, type NoteHandle, type VoiceBuses } from './synth';
import type { InstrumentId, LoopRange, PlayerPosition, PlayerState, SolfaPlayer, VoiceMix } from './types';

/** Delay between play()/seek() and the first note, so the first window is never late (s). */
const START_DELAY = 0.06;
const SEEK_DELAY = 0.03;
/** ~30 Hz position events while playing. */
const EMIT_INTERVAL_MS = 33;
/** Without animation frames (hidden tab) the scheduler timer emits at least this often. */
const BACKGROUND_EMIT_MS = 250;
/** A late note is still started if at least this much of it is left (s). */
const MIN_LATE_REMAINDER = 0.03;
/** Cap on the output-latency compensation of the position (s). */
const MAX_LATENCY = 0.3;
const EPS = 1e-6;

interface ActiveNote {
  handle: NoteHandle;
  startBeat: number;
  endBeat: number;
}

class WebAudioPlayer implements SolfaPlayer {
  private readonly sched = new Scheduler();
  private seq: Sequence = EMPTY_SEQUENCE;
  private state: PlayerState = 'stopped';
  /** Position while not running. */
  private beat = 0;
  private instrument: InstrumentId = 'piano';
  private mix: Record<VoiceId, VoiceMix> = completeMix();
  private solo: VoiceId | null = null;
  private focus: VoiceId | null = null;
  private countIn = false;
  private ctx: AudioContext | null = null;
  private buses: VoiceBuses | null = null;
  private notes: ActiveNote[] = [];
  private clicks: ClickHandle[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame: number | null = null;
  private lastEmit = 0;
  private playToken = 0;
  private disposed = false;
  private readonly listeners = new Set<(pos: PlayerPosition) => void>();
  private readonly onContextState = () => {
    // iOS interrupts audio for calls / other apps: show "paused" so one tap resumes.
    if (this.ctx && this.ctx.state !== 'running' && this.sched.isRunning) this.pause();
  };

  load(seq: Sequence): void {
    const ctx = this.ctx;
    const running = this.sched.isRunning && ctx !== null;
    const beat = running ? this.sched.positionAt(ctx.currentTime).beat : this.beat;
    this.seq = seq;
    this.sched.load(seq);
    const b = Math.min(Math.max(beat, 0), seq.totalBeats);
    if (running) {
      this.cancelAll(ctx.currentTime);
      this.sched.start(ctx.currentTime + SEEK_DELAY, b);
      this.tick();
    } else {
      this.beat = b;
    }
    this.emit();
  }

  async play(): Promise<void> {
    if (this.disposed || this.state === 'playing') return;
    if (!isAudioSupported()) throw new Error('Web Audio API is not available in this browser');
    const ctx = getAudioContext(); // synchronously, inside the user gesture
    const resumed = resumeAudio(ctx);
    this.attach(ctx);
    const token = ++this.playToken;
    this.state = 'playing';
    this.emit();
    await resumed;
    if (token !== this.playToken || this.disposed) return;
    this.sched.start(ctx.currentTime + START_DELAY, this.startBeat(), { countIn: this.countIn });
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.startFrames();
    this.tick();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    if (this.sched.isRunning && this.ctx) this.beat = this.sched.positionAt(this.heardTime(this.ctx)).beat;
    this.halt();
    this.state = 'paused';
    this.emit();
  }

  stop(): void {
    this.halt();
    this.state = 'stopped';
    this.beat = 0;
    this.emit();
  }

  seek(beat: number): void {
    const b = Math.min(Math.max(Number.isFinite(beat) ? beat : 0, 0), this.seq.totalBeats);
    const ctx = this.ctx;
    if (this.sched.isRunning && ctx) {
      const now = ctx.currentTime;
      this.cancelAll(now);
      this.sched.start(now + SEEK_DELAY, b);
      this.tick();
    } else {
      this.beat = b;
    }
    this.emit();
  }

  setTempo(bpm: number): void {
    const t = clampTempo(bpm);
    if (t === this.sched.tempo) return;
    const ctx = this.ctx;
    if (!this.sched.isRunning || !ctx) {
      this.sched.setTempo(0, t);
      return;
    }
    const now = ctx.currentTime;
    this.sched.setTempo(now, t);
    this.cancelPending(now);
    this.retimeSounding(now, t);
    this.tick();
  }

  setInstrument(id: InstrumentId): void {
    if (id === this.instrument) return;
    this.instrument = id;
    this.replan();
  }

  setVoiceMix(voice: VoiceId, mix: Partial<VoiceMix>): void {
    this.mix = completeMix({ ...this.mix, [voice]: { ...this.mix[voice], ...mix } });
    this.applyGains();
  }

  setSolo(voice: VoiceId | null): void {
    this.solo = voice;
    this.applyGains();
  }

  setFocus(voice: VoiceId | null): void {
    this.focus = voice;
    this.applyGains();
  }

  setLoop(range: LoopRange | null): void {
    this.sched.setLoop(range);
    const loop = this.sched.loopRange;
    const ctx = this.ctx;
    if (!this.sched.isRunning || !ctx) return;
    const pos = this.sched.positionAt(ctx.currentTime);
    if (loop && (pos.beat < loop.startBeat - EPS || pos.beat >= loop.endBeat - EPS)) this.seek(loop.startBeat);
    else this.replan();
  }

  setMetronome(on: boolean): void {
    this.sched.setMetronome(on);
    this.replan();
  }

  setCountIn(on: boolean): void {
    this.countIn = on;
  }

  getPosition(): PlayerPosition {
    const ctx = this.ctx;
    if (this.state === 'playing' && this.sched.isRunning && ctx) {
      const p = this.sched.positionAt(this.heardTime(ctx));
      return { beat: p.beat, bar: barAt(this.seq, p.beat), state: this.state, countIn: p.countIn };
    }
    return { beat: this.beat, bar: barAt(this.seq, this.beat), state: this.state, countIn: false };
  }

  subscribe(listener: (pos: PlayerPosition) => void): () => void {
    this.listeners.add(listener);
    listener(this.getPosition());
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.halt();
    this.disposed = true;
    this.state = 'stopped';
    this.listeners.clear();
    this.buses?.disconnect();
    this.buses = null;
    this.ctx?.removeEventListener('statechange', this.onContextState);
    this.ctx = null;
  }

  // ---- internals -------------------------------------------------------------------------

  private attach(ctx: AudioContext): void {
    if (this.ctx === ctx && this.buses) return;
    this.buses?.disconnect();
    this.ctx?.removeEventListener('statechange', this.onContextState);
    this.ctx = ctx;
    this.buses = createVoiceBuses(ctx, computeVoiceGains(this.mix, this.solo, this.focus));
    ctx.addEventListener('statechange', this.onContextState);
  }

  /** Where play() starts: the current position, or the loop start when outside the loop. */
  private startBeat(): number {
    let b = this.beat;
    const loop = this.sched.loopRange;
    if (loop && (b < loop.startBeat - EPS || b >= loop.endBeat - EPS)) b = loop.startBeat;
    if (b >= this.seq.totalBeats - EPS) b = 0;
    return b;
  }

  /** Audio time currently coming out of the speaker (for the highlighted position). */
  private heardTime(ctx: AudioContext): number {
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return ctx.currentTime - Math.min(Math.max(latency, 0), MAX_LATENCY);
  }

  private tick(): void {
    const ctx = this.ctx;
    const buses = this.buses;
    if (!ctx || !buses || !this.sched.isRunning) return;
    const now = ctx.currentTime;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    this.schedule(this.sched.advance(now, hidden ? HIDDEN_HORIZON_S : HORIZON_S), now, ctx, buses);
    const end = this.sched.endTime;
    if (end !== null && now >= end) {
      this.finish();
      return;
    }
    this.notes = this.notes.filter((n) => n.handle.endTime > now);
    this.clicks = this.clicks.filter((c) => c.time > now - 0.5);
    const gap = hidden || this.frame === null ? EMIT_INTERVAL_MS : BACKGROUND_EMIT_MS;
    if (performance.now() - this.lastEmit >= gap) this.emit();
  }

  private schedule(chunk: ScheduleChunk, now: number, ctx: AudioContext, buses: VoiceBuses): void {
    for (const n of chunk.notes) {
      let time = n.time;
      let duration = n.duration;
      if (time < now) {
        // The timer was late (busy main thread / background tab): play what is left.
        duration -= now - time;
        time = now;
        if (duration < MIN_LATE_REMAINDER) continue;
      }
      const handle = startNote(ctx, buses.voices[n.voice], this.instrument, n.midi, time, duration);
      this.notes.push({ handle, startBeat: n.startBeat, endBeat: n.endBeat });
    }
    for (const c of chunk.clicks) {
      if (c.time < now - 0.01) continue;
      this.clicks.push(startClick(ctx, buses.click, Math.max(c.time, now), c.accent));
    }
  }

  /** Re-plan from now (instrument / loop / metronome change) keeping sounding notes. */
  private replan(): void {
    const ctx = this.ctx;
    if (!this.sched.isRunning || !ctx) return;
    const now = ctx.currentTime;
    this.sched.replan(now);
    this.cancelPending(now);
    this.tick();
  }

  /** Cancel notes and clicks that have not started yet (the scheduler re-emits them). */
  private cancelPending(now: number): void {
    this.notes = this.notes.filter((n) => {
      if (n.handle.startTime < now) return true;
      n.handle.cancel(now);
      return false;
    });
    this.clicks = this.clicks.filter((c) => {
      if (c.time < now) return true;
      c.cancel(now);
      return false;
    });
  }

  /** After a tempo change, move the end of the notes that are sounding now. */
  private retimeSounding(now: number, bpm: number): void {
    for (const n of this.notes) {
      if (n.handle.releaseTime <= now) continue;
      const seconds = ((n.endBeat - n.startBeat) * 60) / bpm;
      n.handle.setRelease(this.sched.timeAtBeat(n.endBeat) - articulationGap(seconds));
    }
  }

  private cancelAll(now: number): void {
    for (const n of this.notes) n.handle.cancel(now);
    for (const c of this.clicks) c.cancel(now);
    this.notes = [];
    this.clicks = [];
  }

  private applyGains(): void {
    const ctx = this.ctx;
    const buses = this.buses;
    if (!ctx || !buses) return;
    const gains = computeVoiceGains(this.mix, this.solo, this.focus);
    for (const v of MIX_VOICES) glideParam(buses.voices[v].gain, gains[v], ctx.currentTime);
  }

  /** Stop scheduling and fade out everything (pause / stop / dispose). */
  private halt(): void {
    this.playToken++;
    this.stopTimers();
    this.sched.stop();
    if (this.ctx) this.cancelAll(this.ctx.currentTime);
  }

  /** Natural end of the song: let the last notes ring, go back to the start. */
  private finish(): void {
    this.playToken++;
    this.stopTimers();
    this.sched.stop();
    this.notes = [];
    this.clicks = [];
    this.state = 'stopped';
    this.beat = 0;
    this.emit();
  }

  private stopTimers(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private startFrames(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    const step = () => {
      if (this.state !== 'playing' || !this.sched.isRunning) {
        this.frame = null;
        return;
      }
      if (performance.now() - this.lastEmit >= EMIT_INTERVAL_MS - 4) this.emit();
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private emit(): void {
    this.lastEmit = performance.now();
    if (this.listeners.size === 0) return;
    const pos = this.getPosition();
    for (const listener of [...this.listeners]) {
      try {
        listener(pos);
      } catch (err) {
        console.error('[audio] position listener failed', err);
      }
    }
  }
}

/** Create a Web Audio player (the AudioContext is created on the first play()). */
export function createPlayer(): SolfaPlayer {
  return new WebAudioPlayer();
}
