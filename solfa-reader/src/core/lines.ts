/**
 * Line classification and system grouping (SOLFA_FORMAT.md §2–§3), shared by the parser and the
 * formatter so that both always see the same systems.
 */
import { parseKey } from './pitch';
import { VOICE_IDS } from './model';
import type { VoiceId } from './model';

export type HeaderField =
  | 'title'
  | 'composer'
  | 'lyricist'
  | 'key'
  | 'time'
  | 'tempo'
  | 'voices'
  | 'meta';

export interface HeaderInfo {
  field: HeaderField;
  /** Lower-cased header name as written (meta key for unknown headers). */
  name: string;
  value: string;
  /** Column span of the trimmed value. */
  valueCol: number;
  valueEndCol: number;
}

export interface LabelInfo {
  voice: VoiceId;
  /** Label text as written, including its `:` `.` `=` if any (e.g. "S:", "Tenor"). */
  text: string;
  col: number;
}

interface LineBase {
  index: number;
  raw: string;
}
export interface BlankLine extends LineBase {
  kind: 'blank';
}
export interface CommentLine extends LineBase {
  kind: 'comment';
}
export interface WordsLine extends LineBase {
  kind: 'words';
  words: string;
}
export interface HeaderLine extends LineBase {
  kind: 'header';
  header: HeaderInfo;
}
export interface VoiceLineInfo extends LineBase {
  kind: 'voice';
  label: LabelInfo | null;
  /** Column where the music starts (after the label). */
  musicCol: number;
  /** Assigned voice; null when the system already has all its voices (`unknown-voice`). */
  voice: VoiceId | null;
  /** Index of the system this line belongs to (0-based, in order of appearance). */
  system: number;
}
export type ClassifiedLine = BlankLine | CommentLine | WordsLine | HeaderLine | VoiceLineInfo;

const HEADER_NAMES: Readonly<Record<string, HeaderField>> = {
  title: 'title',
  composer: 'composer',
  author: 'composer',
  'mpamoron-kira': 'composer',
  lyricist: 'lyricist',
  mpanoratra: 'lyricist',
  time: 'time',
  tempo: 'tempo',
  voices: 'voices',
};

/** Voice labels, longest first so "Soprano" is tried before "Sop" and "S". */
const LABELS: ReadonlyArray<readonly [string, VoiceId]> = (
  [
    ['Soprano', 'S'],
    ['Sop', 'S'],
    ['S', 'S'],
    ['Alto', 'A'],
    ['Alt', 'A'],
    ['A', 'A'],
    ['Tenor', 'T'],
    ['Ténor', 'T'],
    ['Ten', 'T'],
    ['T', 'T'],
    ['Basse', 'B'],
    ['Bass', 'B'],
    ['Bas', 'B'],
    ['B', 'B'],
  ] as const
)
  .slice()
  .sort((a, b) => b[0].length - a[0].length);

export const DEFAULT_VOICE_ORDER: readonly VoiceId[] = VOICE_IDS;

const SEPARATOR_START = /[|!¦]/;
const WORDS_LINE = /^\s*(?:W|Words|Tonony)\s*:\s?(.*)$/i;
const KEY_PHRASE = /^(\s*)(key|doh|do)\b(\s*(?:(?:is|dia|of)\b|=|:)?\s*)(.*?)\s*$/i;
const GENERIC_HEADER = /^(\s*)([\p{L}][\p{L}\p{N}_-]*)\s*:(.*)$/u;

/** Voice for a label word, case-insensitive (used by the `voices:` header). */
export function voiceFromWord(word: string): VoiceId | null {
  const w = word.normalize('NFC').toLowerCase();
  for (const [label, voice] of LABELS) {
    if (label.toLowerCase() === w) return voice;
  }
  return null;
}

/** Detect a voice label at the start of a line (first letter upper-case, §2). */
export function matchLabel(raw: string): LabelInfo | null {
  let i = 0;
  while (i < raw.length && /\s/.test(raw.charAt(i))) i++;
  for (const [label, voice] of LABELS) {
    const cand = raw.slice(i, i + label.length);
    if (cand.length !== label.length) continue;
    if (cand.charAt(0) !== label.charAt(0)) continue;
    if (cand.slice(1).toLowerCase() !== label.slice(1).toLowerCase()) continue;
    let j = i + label.length;
    const next = raw.charAt(j);
    if (next === ':' || next === '.' || next === '=') {
      j++;
    } else if (next !== '' && !/\s/.test(next) && !SEPARATOR_START.test(next)) {
      continue;
    }
    return { voice, text: raw.slice(i, j), col: i };
  }
  return null;
}

function valueSpan(raw: string, start: number): { value: string; col: number; endCol: number } {
  const rest = raw.slice(start);
  const lead = rest.length - rest.trimStart().length;
  const value = rest.trim();
  return { value, col: start + lead, endCol: start + lead + value.length };
}

/** Detect a header line (§2, §3). Returns null for voice lines. */
export function matchHeader(raw: string): HeaderInfo | null {
  const key = KEY_PHRASE.exec(raw);
  if (key) {
    const [, lead = '', word = '', sep = '', value = ''] = key;
    const valueCol = lead.length + word.length + sep.length;
    const parsed = value !== '' && parseKey(value) !== null;
    const lower = word.toLowerCase();
    const explicitSep = sep.trim() !== '';
    // Lower-case `do` is also a note (lowered doh): only a header with `do:`/`do =`/`do dia`…
    // and a valid key; "do :r" stays a voice line.
    const isHeader =
      lower === 'key' ||
      lower === 'doh' ||
      (word === 'do'
        ? parsed && explicitSep && !/^\s+:/.test(sep)
        : value !== '' && (parsed || explicitSep));
    if (isHeader) {
      return { field: 'key', name: lower, value, valueCol, valueEndCol: valueCol + value.length };
    }
  }
  const generic = GENERIC_HEADER.exec(raw);
  if (!generic) return null;
  const [, lead = '', name = ''] = generic;
  const lname = name.toLowerCase();
  const colonIdx = raw.indexOf(':', lead.length + name.length);
  const span = valueSpan(raw, colonIdx + 1);
  const known = HEADER_NAMES[lname];
  if (known) {
    return { field: known, name: lname, value: span.value, valueCol: span.col, valueEndCol: span.endCol };
  }
  if (matchLabel(raw)) return null;
  // Unknown `name: value` → meta, but only for words that cannot be a note (≥ 3 letters) and
  // values that do not look like music.
  if (name.length < 3 || span.value.includes('|')) return null;
  return { field: 'meta', name: lname, value: span.value, valueCol: span.col, valueEndCol: span.endCol };
}

/** Parse the `voices:` header value; unknown words are reported with their columns. */
export function parseVoicesValue(
  value: string,
  valueCol: number,
): { voices: VoiceId[]; unknown: Array<{ col: number; endCol: number; word: string }> } {
  const voices: VoiceId[] = [];
  const unknown: Array<{ col: number; endCol: number; word: string }> = [];
  const re = /[^\s,;/]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const voice = voiceFromWord(m[0]);
    if (voice) {
      if (!voices.includes(voice)) voices.push(voice);
    } else {
      unknown.push({ col: valueCol + m.index, endCol: valueCol + m.index + m[0].length, word: m[0] });
    }
  }
  return { voices, unknown };
}

/** Split text into lines (LF, CRLF or CR). */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

/**
 * Classify every line and group voice lines into systems.
 * A system ends at a blank line, or when a labelled voice appears a second time in it
 * (a forgotten blank line). Unlabelled lines take the next unused voice of `voices:`.
 */
export function classifyLines(text: string): ClassifiedLine[] {
  const out: ClassifiedLine[] = [];
  let order: readonly VoiceId[] = DEFAULT_VOICE_ORDER;
  let system = -1;
  let open = false;
  let used = new Set<VoiceId>();

  splitLines(text).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      open = false;
      out.push({ kind: 'blank', index, raw });
      return;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      out.push({ kind: 'comment', index, raw });
      return;
    }
    const words = WORDS_LINE.exec(raw);
    if (words) {
      out.push({ kind: 'words', index, raw, words: (words[1] ?? '').trim() });
      return;
    }
    const header = matchHeader(raw);
    if (header) {
      if (header.field === 'voices') {
        const parsed = parseVoicesValue(header.value, header.valueCol);
        if (parsed.voices.length > 0) order = parsed.voices;
      }
      out.push({ kind: 'header', index, raw, header });
      return;
    }
    const label = matchLabel(raw);
    if (!open || (label && used.has(label.voice))) {
      system++;
      open = true;
      used = new Set<VoiceId>();
    }
    let voice: VoiceId | null;
    if (label) {
      voice = label.voice;
    } else {
      voice = order.find((v) => !used.has(v)) ?? null;
    }
    if (voice) used.add(voice);
    out.push({
      kind: 'voice',
      index,
      raw,
      label,
      musicCol: label ? label.col + label.text.length : 0,
      voice,
      system,
    });
  });
  return out;
}
