// Pure mixer maths: per-voice volume, mute, solo and focus → one gain per voice bus.
import type { VoiceId } from '../core';
import type { VoiceMix } from './types';

export const MIX_VOICES: readonly VoiceId[] = ['S', 'A', 'T', 'B'];

/** Gain of the other voices in focus mode (FR-18: focus voice 100 %, others 25 %). */
export const FOCUS_OTHERS_GAIN = 0.25;

/** Default mixer: every voice at full volume, none muted. */
export function defaultMix(): Record<VoiceId, VoiceMix> {
  return {
    S: { volume: 1, muted: false },
    A: { volume: 1, muted: false },
    T: { volume: 1, muted: false },
    B: { volume: 1, muted: false },
  };
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 1;
}

/** Fill missing voices / fields of a partial mix with defaults and clamp volumes to 0..1. */
export function completeMix(mix: Partial<Record<VoiceId, Partial<VoiceMix>>> = {}): Record<VoiceId, VoiceMix> {
  const out = defaultMix();
  for (const v of MIX_VOICES) {
    const m = mix[v];
    if (!m) continue;
    out[v] = { volume: clamp01(m.volume ?? 1), muted: m.muted ?? false };
  }
  return out;
}

/**
 * Bus gain per voice. Solo wins over everything (the soloed voice plays even if muted, the
 * others are silent); otherwise mute silences a voice and focus lowers the others to 25 %.
 */
export function computeVoiceGains(
  mix: Readonly<Record<VoiceId, VoiceMix>>,
  solo: VoiceId | null,
  focus: VoiceId | null,
): Record<VoiceId, number> {
  const out = { S: 0, A: 0, T: 0, B: 0 };
  for (const v of MIX_VOICES) {
    const volume = clamp01(mix[v].volume);
    if (solo) out[v] = v === solo ? volume : 0;
    else if (mix[v].muted) out[v] = 0;
    else if (focus) out[v] = v === focus ? volume : volume * FOCUS_OTHERS_GAIN;
    else out[v] = volume;
  }
  return out;
}
