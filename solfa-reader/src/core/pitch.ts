import type { KeySignature, SequenceOptions, SolfaNote, VoiceId } from './model';

/** Parse a key value or phrase ("G", "Bb", "F#", "Do dia Sol", "Doh is G") into a key. B-01 */
export function parseKey(_value: string): KeySignature | null {
  throw new Error('not implemented: parseKey (B-01)');
}

/** MIDI number of a sol-fa note for a voice in a key (SOLFA_FORMAT.md §6). B-01 */
export function noteToMidi(
  _note: SolfaNote,
  _voice: VoiceId,
  _key: KeySignature,
  _opts?: SequenceOptions,
): number {
  throw new Error('not implemented: noteToMidi (B-01)');
}

/** 67 → "G4". B-01 */
export function midiToName(_midi: number): string {
  throw new Error('not implemented: midiToName (B-01)');
}
