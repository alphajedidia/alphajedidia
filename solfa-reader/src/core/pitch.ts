import { DEGREE_SEMITONES } from './model';
import type { KeySignature, SequenceOptions, SolfaNote, VoiceId } from './model';

const LETTER_SEMITONES: Readonly<Record<string, number>> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

/** Latin (fixed-do) names, longest first so "sol" wins over "so". */
const LATIN_NAMES: ReadonlyArray<readonly [string, string]> = [
  ['sol', 'g'],
  ['so', 'g'],
  ['do', 'c'],
  ['ré', 'd'],
  ['re', 'd'],
  ['mi', 'e'],
  ['fa', 'f'],
  ['la', 'a'],
  ['si', 'b'],
];

/** Accidental spellings, longest first ("bemola" before "bemol"). */
const ACCIDENTALS: ReadonlyArray<readonly [string, 1 | -1]> = [
  ['bemola', -1],
  ['bémol', -1],
  ['bemol', -1],
  ['dièse', 1],
  ['diese', 1],
  ['diesy', 1],
  ['#', 1],
  ['♯', 1],
  ['b', -1],
  ['♭', -1],
];

const MAJOR_WORD = /\s+(?:major|majeur|majora|maj|dur)\.?$/i;
/** "Doh is G", "Do = Sol", "Do dia Sol", "Key of G", "Key G", "Do: G". */
const KEY_PREFIX = /^(?:key|doh|do)\b\s*(?:(?:is|dia|of)\b|=|:)?\s*(.+)$/i;

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Parse a bare key name: letter or Latin name + optional accidental. */
function parseKeyName(raw: string): KeySignature | null {
  const s = raw.trim().toLowerCase();
  if (s === '') return null;
  const candidates: Array<readonly [string, string]> = [];
  for (const [latin, letter] of LATIN_NAMES) {
    if (s.startsWith(latin)) candidates.push([latin, letter]);
  }
  const first = s.charAt(0);
  if (first in LETTER_SEMITONES) candidates.push([first, first]);

  for (const [written, letter] of candidates) {
    const rest = s.slice(written.length).trim();
    let alter = 0;
    if (rest !== '') {
      const acc = ACCIDENTALS.find(([spelling]) => rest === spelling);
      if (!acc) continue;
      alter = acc[1];
    }
    const base = LETTER_SEMITONES[letter] ?? 0;
    const tonic = (((base + alter) % 12) + 12) % 12;
    const suffix = alter === 1 ? '#' : alter === -1 ? '♭' : '';
    return { tonic, name: letter.toUpperCase() + suffix };
  }
  return null;
}

/** Parse a key value or phrase ("G", "Bb", "F#", "Do dia Sol", "Doh is G") into a key. B-01 */
export function parseKey(value: string): KeySignature | null {
  let s = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  s = s.replace(MAJOR_WORD, '').trim();
  if (s === '') return null;
  const prefixed = KEY_PREFIX.exec(s);
  if (prefixed?.[1] !== undefined) {
    const key = parseKeyName(prefixed[1]);
    if (key) return key;
  }
  // "Do", "Do diesy", "Do#": the prefix word was the key itself.
  return parseKeyName(s);
}

/** MIDI number of a sol-fa note for a voice in a key (SOLFA_FORMAT.md §6). B-01 */
export function noteToMidi(
  note: SolfaNote,
  voice: VoiceId,
  key: KeySignature,
  opts?: SequenceOptions,
): number {
  const base = voice === 'S' || voice === 'A' ? 60 : 48;
  const shift = opts?.octaveShift?.[voice] ?? 0;
  const transpose = opts?.transpose ?? 0;
  return (
    base +
    key.tonic +
    DEGREE_SEMITONES[note.degree] +
    note.alter +
    12 * (note.octave + shift) +
    transpose
  );
}

/** 67 → "G4" (sharps, scientific pitch notation). B-01 */
export function midiToName(midi: number): string {
  const n = Math.round(midi);
  const pc = ((n % 12) + 12) % 12;
  return `${SHARP_NAMES[pc] ?? '?'}${Math.floor(n / 12) - 1}`;
}
