// Public API of the audio module. Import from '../audio' only.
import type { Sequence } from '../core';
import type { InstrumentId, RenderOptions, SolfaPlayer } from './types';

export * from './types';

/** Create a Web Audio player for a sequence. B-06 */
export function createPlayer(): SolfaPlayer {
  throw new Error('not implemented: createPlayer (B-06)');
}

/** Play one short note (keypad feedback). B-07 */
export async function previewNote(_midi: number, _instrument?: InstrumentId): Promise<void> {
  throw new Error('not implemented: previewNote (B-07)');
}

/** Standard MIDI file (type 1, one track per voice). B-08 */
export function exportMidi(_seq: Sequence, _opts: { tempo: number; title?: string }): Uint8Array {
  throw new Error('not implemented: exportMidi (B-08)');
}

/** Render the sequence with the given mix to a WAV blob. B-08 */
export async function renderWav(_seq: Sequence, _opts: RenderOptions): Promise<Blob> {
  throw new Error('not implemented: renderWav (B-08)');
}
