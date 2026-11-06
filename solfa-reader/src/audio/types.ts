import type { Sequence, VoiceId } from '../core';

export type InstrumentId = 'piano' | 'organ' | 'voice';
export const INSTRUMENT_IDS: readonly InstrumentId[] = ['piano', 'organ', 'voice'] as const;

export interface VoiceMix {
  /** 0..1 */
  volume: number;
  muted: boolean;
}

export type PlayerState = 'stopped' | 'playing' | 'paused';

export interface PlayerPosition {
  /** Current beat from the song start (fractional). */
  beat: number;
  /** Current 1-based bar (0 = pick-up). */
  bar: number;
  state: PlayerState;
  /** True while the count-in clicks are playing. */
  countIn: boolean;
}

export interface LoopRange {
  startBeat: number;
  endBeat: number;
}

export interface SolfaPlayer {
  load(seq: Sequence): void;
  /** First call must come from a user gesture (unlocks the AudioContext). */
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(beat: number): void;
  setTempo(bpm: number): void;
  setInstrument(id: InstrumentId): void;
  setVoiceMix(voice: VoiceId, mix: Partial<VoiceMix>): void;
  setSolo(voice: VoiceId | null): void;
  /** Focus = this voice at 100 %, the others at 25 %. */
  setFocus(voice: VoiceId | null): void;
  setLoop(range: LoopRange | null): void;
  setMetronome(on: boolean): void;
  setCountIn(on: boolean): void;
  getPosition(): PlayerPosition;
  /** Called ~30 times per second while playing, and on every state change. */
  subscribe(listener: (pos: PlayerPosition) => void): () => void;
  dispose(): void;
}

export interface RenderOptions {
  tempo: number;
  instrument: InstrumentId;
  mix: Partial<Record<VoiceId, VoiceMix>>;
  /** Default 22050 (small files for phones). */
  sampleRate?: number;
}
