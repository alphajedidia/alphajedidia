// Context-aware confusion map (A-03): what Tesseract reads vs. what sol-fa allows.
import type { VoiceId } from '../../core';

/** A valid note body: degree + optional chromatic vowel (SOLFA_FORMAT §5). */
export const NOTE_RE = /^[drmfslt][eiao]?$/;

/** Single-character confusions → note letter. */
const CHAR_MAP: Record<string, string> = {
  '1': 'l',
  I: 'l',
  '|': 'l',
  '!': 'l',
  L: 'l',
  '5': 's',
  S: 's',
  $: 's',
  '+': 't',
  T: 't',
  '7': 't',
  D: 'd',
  '0': 'd',
  M: 'm',
  R: 'r',
  F: 'f',
  E: 'e',
  A: 'a',
  O: 'o',
  n: 'r',
  c: 'e',
};

/** Multi-character confusions (applied first, longest first). */
const SEQ_MAP: [string, string][] = [
  ['rn', 'm'],
  ['ni', 'm'],
  ['nn', 'm'],
  ['iii', 'm'],
  ['cl', 'd'],
  ['ol', 'd'],
  ['al', 'd'],
  ['el', 'd'],
  ['rl', 'd'],
  ['ii', 'll'],
];

export interface NoteGeometry {
  /** Ascender-height glyph (d f l t) rather than x-height (m r s e a o). */
  tall?: boolean;
  /** Width in x-heights. */
  width?: number;
  /** Number of connected components in the cluster. */
  comps?: number;
  /** Thin vertical single stroke (looks like `l`). */
  lahShape?: boolean;
}

export interface NoteReading {
  /** Valid note text (always matches NOTE_RE). */
  text: string;
  /** 0..1 */
  conf: number;
  /** True when the raw reading was changed. */
  changed: boolean;
}

/** Guess a letter from the glyph shape alone (used when OCR gave nothing usable). */
export function guessFromShape(g: NoteGeometry): string {
  if (g.lahShape) return 'l';
  const w = g.width ?? 0.6;
  if (g.tall) return w >= 0.55 ? 'd' : w >= 0.42 ? 't' : 'l';
  if (w >= 0.85) return 'm';
  return w <= 0.42 ? 'r' : 's';
}

/** Normalise the OCR reading of one note cluster into a valid note. */
export function normalizeNote(raw: string, conf: number, geo: NoteGeometry = {}): NoteReading {
  let s = raw.replace(/\s+/g, '');
  const original = s;
  if (geo.lahShape) return { text: 'l', conf: Math.max(conf, 0.75), changed: s !== 'l' };
  for (const [from, to] of SEQ_MAP) s = s.split(from).join(to);
  s = [...s].map((ch) => CHAR_MAP[ch] ?? ch).join('');
  s = s.toLowerCase().replace(/[^drmfsltaeio]/g, '');
  let penalty = s === original ? 1 : 0.7;
  // A short glyph cannot be `l`: the reading is unreliable, trust the shape instead.
  if (s === 'l' && geo.tall === false) {
    s = guessFromShape(geo);
    penalty = 0.35;
  }
  if (!NOTE_RE.test(s)) {
    const prefix = /^[drmfslt][eiao]?/.exec(s);
    if (prefix && prefix[0].length > 0) {
      s = prefix[0];
      penalty = Math.min(penalty, 0.5);
    } else {
      s = guessFromShape(geo);
      penalty = 0.3;
    }
  }
  return { text: s, conf: Math.max(0, Math.min(1, conf * penalty)), changed: s !== original };
}

const LABELS: Record<string, VoiceId> = { S: 'S', A: 'A', T: 'T', B: 'B' };

/** Recognise a printed voice label ("S", "S.", "A:", "Sop", "Ten") from an OCR reading. */
export function readLabel(raw: string): VoiceId | null {
  const s = raw.replace(/[.:=\s]/g, '');
  if (LABELS[s]) return LABELS[s];
  if (/^(Sop|Soprano)$/i.test(s)) return 'S';
  if (/^(Alt|Alto)$/i.test(s)) return 'A';
  if (/^(Ten|Tenor|T[eé]nor)$/i.test(s)) return 'T';
  if (/^(Bas|Bass|Basse)$/i.test(s)) return 'B';
  return null;
}

/** Character-level replacements for a whole music line read as plain text. */
const LINE_MAP: [RegExp, string][] = [
  [/[;]/g, ':'],
  [/[’‘`´]/g, "'"],
  [/[–—_~]/g, '-'],
  [/¦/g, '!'],
  [/[¹]/g, "'"],
  [/[₁]/g, ','],
  [/cl/g, 'd'],
  [/rn/g, 'm'],
  [/5/g, 's'],
  [/\+/g, 't'],
];

/**
 * Normalise a music line read as plain text (fallback path): fix quotes/dashes/semicolons,
 * decide `|` vs `l` by context (a stroke standing alone between spaces is a bar line; one
 * touching a separator or mark is a note), drop characters that are not sol-fa.
 */
export function normalizeMusicLine(text: string): string {
  let s = text;
  for (const [re, to] of LINE_MAP) s = s.replace(re, to);
  // Vertical strokes: I, 1, l, | , ] , [
  s = s.replace(/[I1l|\][]+/g, (run, offset: number, all: string) => {
    const before = all[offset - 1] ?? ' ';
    const after = all[offset + run.length] ?? ' ';
    const isolated = /\s/.test(before) && /\s/.test(after);
    if (run.length >= 2 && isolated) return '||';
    if (isolated) return '|';
    // `:l` or `l.` or `l'` is a note; `l` glued to a letter is a note too.
    return 'l';
  });
  return s
    .replace(/[^drmfsltaeio|:!.,'\-\s]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
