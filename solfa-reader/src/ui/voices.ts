import type { VoiceId } from '../core';

/** Score order of the choir voices (same as core VOICE_IDS; kept here so ui stays type-only). */
export const VOICE_ORDER: readonly VoiceId[] = ['S', 'A', 'T', 'B'];

/**
 * English fallback names, used only for aria-labels when the caller passes no translated name.
 * Visible names always come from props (the interface agent translates them).
 */
export const DEFAULT_VOICE_NAMES: Readonly<Record<VoiceId, string>> = {
  S: 'Soprano',
  A: 'Alto',
  T: 'Tenor',
  B: 'Bass',
};

/** Class that scopes `--sr-voice` / `--sr-voice-soft` to a voice (defined in base.css). */
export function voiceClass(voice: VoiceId): string {
  return `sr-voice-${voice.toLowerCase()}`;
}
