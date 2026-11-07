// Helpers on .solfa text and parsed songs used by several screens (pure, no DOM).
import type { Degree, KeySignature, SolfaNote, Song, VoiceId } from '../core';

const TITLE_RE = /^(\s*title\s*:)(.*)$/im;

/** The value of the `title:` header, or null when there is none (or it is empty). */
export function readTitleHeader(text: string): string | null {
  const m = TITLE_RE.exec(text);
  const v = m?.[2]?.trim();
  return v ? v : null;
}

/** Set the `title:` header (replace its value, or add it as the first line). */
export function setTitleHeader(text: string, title: string): string {
  const clean = title.replace(/[\r\n]+/g, ' ').trim();
  if (TITLE_RE.test(text)) return text.replace(TITLE_RE, (_all, head: string) => `${head} ${clean}`);
  return `title: ${clean}\n${text}`;
}

/** Song title for display: the record title, else the header, else the fallback. */
export function displayTitle(recordTitle: string | undefined, text: string, fallback: string): string {
  return recordTitle?.trim() || readTitleHeader(text) || fallback;
}

const DEGREES = 'drmfslt';

/**
 * The note a keypad key stands for (`d`, `fe`, `ta`…), for the preview sound. Second letter
 * e/i = raised, a/o = lowered, except `te` = lowered t (SOLFA_FORMAT §5).
 */
export function noteFromKeypad(key: string): SolfaNote | null {
  const k = key.trim();
  const first = k.charAt(0);
  if (k.length < 1 || k.length > 2 || !DEGREES.includes(first)) return null;
  const degree = first as Degree;
  let alter: -1 | 0 | 1 = 0;
  if (k.length === 2) {
    const second = k.charAt(1);
    if (k === 'te') alter = -1;
    else if (second === 'e' || second === 'i') alter = 1;
    else if (second === 'a' || second === 'o') alter = -1;
    else return null;
  }
  return { kind: 'note', degree, alter, octave: 0, text: k };
}

const LABEL_RE = /^\s*(Soprano|Sop|Alto|Alt|Tenor|Ténor|Ten|Basse|Bass|Bas|S|A|T|B)\s*[:.=]/;
const LABEL_VOICE: Record<string, VoiceId> = {
  S: 'S', Sop: 'S', Soprano: 'S',
  A: 'A', Alt: 'A', Alto: 'A',
  T: 'T', Ten: 'T', Tenor: 'T', 'Ténor': 'T',
  B: 'B', Bas: 'B', Bass: 'B', Basse: 'B',
};

/** Voice of a source line: its label, else what the parser assigned, else Soprano. */
export function voiceAtLine(song: Song | null, rawLine: string, line: number): VoiceId {
  const m = LABEL_RE.exec(rawLine);
  const label = m?.[1];
  if (label && LABEL_VOICE[label]) return LABEL_VOICE[label];
  for (const sys of song?.systems ?? []) {
    for (const [voice, vl] of Object.entries(sys.lines)) {
      if (vl?.line === line) return voice as VoiceId;
    }
  }
  return 'S';
}

/** Key in force at a source line (key changes between systems). */
export function keyAtLine(song: Song, line: number): KeySignature {
  let key = song.key;
  for (const sys of song.systems) {
    const first = Math.min(...Object.values(sys.lines).map((l) => l?.line ?? Infinity));
    if (first <= line) key = sys.key;
  }
  return key;
}

/** Voices present in a song, for a compact "S A T B" summary. */
export function voicesSummary(song: Song): string {
  return song.voices.join(' ');
}

/** Index of the first beat of every bar, plus the end, from a sequence's bar list. */
export function barEnd(bars: readonly { number: number; startBeat: number }[], bar: number, totalBeats: number): number {
  const i = bars.findIndex((b) => b.number === bar);
  if (i < 0) return totalBeats;
  return bars[i + 1]?.startBeat ?? totalBeats;
}
