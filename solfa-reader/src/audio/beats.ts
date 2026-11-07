// Pure beat/time helpers shared by the scheduler, the player and the exports.
import type { BarInfo, Sequence } from '../core';
import type { LoopRange } from './types';

/** Safety range of the player clock (the UI offers 40–200 BPM, FR-19). */
export const MIN_TEMPO = 20;
export const MAX_TEMPO = 400;
/** Shortest loop accepted (beats). */
export const MIN_LOOP_BEATS = 0.25;
const EPS = 1e-6;

/** An empty sequence (nothing loaded yet). */
export const EMPTY_SEQUENCE: Sequence = { events: [], totalBeats: 0, bars: [], beatsPerBar: 4, voices: [] };

/** One metronome beat. */
export interface ClickPoint {
  beat: number;
  accent: boolean;
}

/** Clamp a tempo to a safe range (BPM). */
export function clampTempo(bpm: number): number {
  if (!Number.isFinite(bpm)) return 100;
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, bpm));
}

/** Silence left between notes so repeated pitches are heard: 4 % of the note, at most 40 ms. */
export function articulationGap(seconds: number): number {
  return Math.min(Math.max(seconds, 0) * 0.04, 0.04);
}

/** Sounding length of a note of `seconds` (written length minus the articulation gap). */
export function soundingDuration(seconds: number): number {
  return Math.max(0, seconds - articulationGap(seconds));
}

/** Keep a loop inside the song; null when absent or too short. */
export function normalizeLoop(range: LoopRange | null, totalBeats: number): LoopRange | null {
  if (!range) return null;
  const startBeat = Math.min(Math.max(range.startBeat, 0), totalBeats);
  const endBeat = Math.min(Math.max(range.endBeat, 0), totalBeats);
  if (!(endBeat - startBeat >= MIN_LOOP_BEATS)) return null;
  return { startBeat, endBeat };
}

/** 1-based bar number at `beat` (0 = pick-up). */
export function barAt(seq: Sequence, beat: number): number {
  const bars = seq.bars;
  if (bars.length === 0) return Math.floor(Math.max(0, beat) / Math.max(1, seq.beatsPerBar)) + 1;
  let lo = 0;
  let hi = bars.length - 1;
  if (beat < bars[0]!.startBeat) return bars[0]!.number;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (bars[mid]!.startBeat <= beat + EPS) lo = mid;
    else hi = mid - 1;
  }
  return bars[lo]!.number;
}

/**
 * Metronome beats of a sequence: one per beat inside each bar, accented on bar starts. A pick-up
 * bar (number 0) is counted backwards from the first full bar so its clicks fall on the beat.
 */
export function buildClickGrid(seq: Sequence): ClickPoint[] {
  const out: ClickPoint[] = [];
  const total = seq.totalBeats;
  const bars: readonly BarInfo[] = seq.bars;
  if (bars.length === 0) {
    const per = Math.max(1, Math.round(seq.beatsPerBar));
    for (let b = 0; b < total - EPS; b++) out.push({ beat: b, accent: b % per === 0 });
    return out;
  }
  bars.forEach((bar, i) => {
    const end = bars[i + 1]?.startBeat ?? total;
    if (bar.number === 0) {
      const pickup: ClickPoint[] = [];
      for (let b = end - 1; b >= bar.startBeat - EPS; b--) pickup.unshift({ beat: Math.max(b, 0), accent: false });
      out.push(...pickup);
      return;
    }
    for (let b = bar.startBeat; b < end - EPS; b++) out.push({ beat: b, accent: b === bar.startBeat });
  });
  return out;
}

/** First index whose `beat` is ≥ `beat` (arrays sorted by beat). */
export function lowerBound<T>(items: readonly T[], beat: number, key: (t: T) => number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(items[mid]!) < beat) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
