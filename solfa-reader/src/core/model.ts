/**
 * Shared data model — THE CONTRACT between the parser, the OCR, the player and the UI.
 *
 * Owner: orchestrator. Agents may ADD optional fields; changing or removing a field
 * requires an entry in docs/DECISIONS.md and updating every consumer in the same change.
 *
 * Text format reference: docs/SOLFA_FORMAT.md
 */

/** Choir voices, in score order. */
export type VoiceId = 'S' | 'A' | 'T' | 'B';
export const VOICE_IDS: readonly VoiceId[] = ['S', 'A', 'T', 'B'] as const;

/** Diatonic sol-fa degrees: doh ray me fah soh lah te. */
export type Degree = 'd' | 'r' | 'm' | 'f' | 's' | 'l' | 't';

/** Semitones above doh for each degree (major scale). */
export const DEGREE_SEMITONES: Readonly<Record<Degree, number>> = {
  d: 0,
  r: 2,
  m: 4,
  f: 5,
  s: 7,
  l: 9,
  t: 11,
};

/** Position of a piece of source text, 0-based, `endCol` exclusive. */
export interface SourceSpan {
  line: number;
  col: number;
  endCol: number;
}

export interface SolfaNote {
  kind: 'note';
  degree: Degree;
  /** -1 = lowered (ta, ma…), 0 = natural, +1 = raised (fe, de…). */
  alter: -1 | 0 | 1;
  /** Octave marks: +1 per `'`, -1 per `,` written after the note. */
  octave: number;
  /** The note exactly as written, e.g. "fe", "t,", "d'". */
  text: string;
}

/** Empty (silent) part of a beat. */
export interface SolfaRest {
  kind: 'rest';
}

/** `-` : the previous note continues. */
export interface SolfaHold {
  kind: 'hold';
}

export type SolfaItem = SolfaNote | SolfaRest | SolfaHold;

/** One item inside a beat. `start` and `length` are fractions of the beat (0..1). */
export interface BeatPart {
  item: SolfaItem;
  start: number;
  length: number;
}

/**
 * The separator written BEFORE a beat:
 * bar = `|`, medium = `!` or `¦`, weak = `:`, none = first beat of a line with no separator.
 */
export type Accent = 'bar' | 'medium' | 'weak' | 'none';

/** One pulse (the text between two separators). */
export interface Beat {
  parts: BeatPart[];
  accent: Accent;
  source?: SourceSpan;
}

/** One voice's music inside one system. */
export interface VoiceLine {
  voice: VoiceId;
  beats: Beat[];
  /** Source line index of this voice line. */
  line: number;
  /**
   * True when the line ends with a bar line (`|` or `||`) after its last beat, so the next
   * system starts a new bar even if its first beat has no `|`. Added by solfa-backend (B-02).
   */
  endsWithBar?: boolean;
}

export interface KeySignature {
  /** Pitch class of doh, C = 0 … B = 11. */
  tonic: number;
  /** Display name, e.g. "G", "B♭", "F#". */
  name: string;
}

/**
 * A system = the group of voice lines printed together (one "brace").
 * In text, systems are separated by blank lines.
 */
export interface System {
  lines: Partial<Record<VoiceId, VoiceLine>>;
  /** Words (`W:` lines), display only in v1. */
  words: string[];
  /** Key in force for this system. */
  key: KeySignature;
  /** Beat index (from the start of the song) at which this system starts. */
  startBeat: number;
  /** Number of beats in this system (max over its voices). */
  beatCount: number;
}

export interface TimeSignature {
  /** Beats (pulses) per bar. */
  beats: number;
  /** Written denominator, informational (4 in 4/4, 8 in 6/8). */
  unit: number;
}

export interface Song {
  title: string;
  composer?: string;
  /** Key at the start of the song. */
  key: KeySignature;
  time?: TimeSignature;
  /** Beats per minute; a beat is one `:`-separated pulse. */
  tempo: number;
  /** Voices present in the song, in score order. */
  voices: VoiceId[];
  systems: System[];
  /** Any other `name: value` headers, lower-cased names. */
  meta: Record<string, string>;
}

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  /** Stable machine code, e.g. "unknown-char", "beat-count-mismatch". */
  code: string;
  /** Human message in English; the UI maps `code` to a translated text when it can. */
  message: string;
  line: number;
  col: number;
  endCol: number;
  voice?: VoiceId;
  /** 1-based bar number when known. */
  bar?: number;
}

export interface ParseResult {
  song: Song;
  diagnostics: Diagnostic[];
}

/** A note to be played, produced by the sequencer. Times are in beats from the song start. */
export interface NoteEvent {
  voice: VoiceId;
  /** MIDI note number (60 = middle C). */
  midi: number;
  startBeat: number;
  durationBeats: number;
  /** 1-based bar number the note starts in. */
  bar: number;
  source?: SourceSpan;
}

export interface BarInfo {
  /** 1-based bar number. */
  number: number;
  startBeat: number;
  /** Index into Song.systems. */
  system: number;
}

export interface Sequence {
  events: NoteEvent[];
  totalBeats: number;
  bars: BarInfo[];
  /** Beats per bar used for metronome accents. */
  beatsPerBar: number;
  voices: VoiceId[];
}

export interface SequenceOptions {
  /** Semitones added to every note (change key for practice). Default 0. */
  transpose?: number;
  /** Per-voice octave shift (e.g. { T: 1 }) for publications with other conventions. */
  octaveShift?: Partial<Record<VoiceId, number>>;
}
