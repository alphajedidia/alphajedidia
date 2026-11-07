/**
 * Parsing of the text of one beat (SOLFA_FORMAT.md §5): notes, chromatics, octave marks,
 * holds, rests, division marks and the comma rule.
 */
import type { BeatPart, Degree, Severity, SolfaItem, SolfaNote } from './model';

export interface BeatDiag {
  severity: Severity;
  code: string;
  message: string;
  col: number;
  endCol: number;
}

export interface ParsedBeat {
  parts: BeatPart[];
  /** Column of each part's item in the line (-1 for implicit rests); parallel to `parts`. */
  cols: number[];
  diagnostics: BeatDiag[];
}

const DEGREES = 'drmfslt';
const UP_MARKS: Readonly<Record<string, number>> = { "'": 1, '’': 1, '`': 1, '¹': 1, '²': 2 };
const DOWN_MARKS: Readonly<Record<string, number>> = { '₁': -1, '₂': -2 };
const HOLD_CHARS = '-–—_';
const LETTER = /\p{L}/u;

type Item =
  | { kind: 'note'; note: SolfaNote; col: number }
  | { kind: 'hold'; col: number }
  | { kind: 'bad'; col: number };

type Mark = 'dot' | 'dotcomma' | 'comma';

/** Read a note name: one degree letter, optionally a chromatic second letter (§5). */
export function readNoteName(text: string): { degree: Degree; alter: -1 | 0 | 1 } | null {
  const first = text.charAt(0);
  if (text.length < 1 || text.length > 2 || !DEGREES.includes(first)) return null;
  const degree = first as Degree;
  if (text.length === 1) return { degree, alter: 0 };
  const second = text.charAt(1);
  if (text === 'te') return { degree, alter: -1 };
  if (second === 'e' || second === 'i') return { degree, alter: 1 };
  if (second === 'a' || second === 'o') return { degree, alter: -1 };
  return null;
}

/**
 * Parse the masked text of one beat. `col` is the column of `text[0]` in the source line.
 */
export function parseBeatText(text: string, col: number): ParsedBeat {
  const diagnostics: BeatDiag[] = [];
  const segments: Item[][] = [[]];
  const marks: Mark[] = [];
  const current = (): Item[] => segments[segments.length - 1] ?? [];
  const n = text.length;
  let i = 0;

  while (i < n) {
    const c = text.charAt(i);
    if (/\s/.test(c)) {
      i++;
    } else if (LETTER.test(c)) {
      let j = i;
      while (j < n && LETTER.test(text.charAt(j))) j++;
      const word = text.slice(i, j);
      const name = readNoteName(word);
      if (!name) {
        diagnostics.push({
          severity: 'error',
          code: 'bad-note',
          message: `"${word}" is not a sol-fa note`,
          col: col + i,
          endCol: col + j,
        });
        current().push({ kind: 'bad', col: col + i });
        i = j;
        continue;
      }
      let octave = 0;
      let k = j;
      for (;;) {
        const m = text.charAt(k);
        const up = UP_MARKS[m];
        const down = DOWN_MARKS[m];
        if (up !== undefined) {
          octave += up;
          k++;
        } else if (down !== undefined) {
          octave += down;
          k++;
        } else if (m === ',') {
          let run = 0;
          while (text.charAt(k + run) === ',') run++;
          // Comma rule (§5): the last comma of the run is a division when a note follows.
          const divides = LETTER.test(text.charAt(k + run));
          const octaveCommas = divides ? run - 1 : run;
          if (divides && octaveCommas === 0 && k === j) {
            diagnostics.push({
              severity: 'info',
              code: 'comma-as-division',
              message: 'comma read as a quarter division (write d,,r for a low d)',
              col: col + k,
              endCol: col + k + 1,
            });
          }
          octave -= octaveCommas;
          k += octaveCommas;
          break;
        } else {
          break;
        }
      }
      current().push({
        kind: 'note',
        note: { kind: 'note', degree: name.degree, alter: name.alter, octave, text: text.slice(i, k) },
        col: col + i,
      });
      i = k;
    } else if (HOLD_CHARS.includes(c)) {
      current().push({ kind: 'hold', col: col + i });
      while (i < n && HOLD_CHARS.includes(text.charAt(i))) i++;
    } else if (c === '.') {
      if (text.charAt(i + 1) === ',') {
        marks.push('dotcomma');
        i += 2;
      } else {
        marks.push('dot');
        i++;
      }
      segments.push([]);
    } else if (c === ',') {
      marks.push('comma');
      segments.push([]);
      i++;
    } else {
      diagnostics.push({
        severity: 'error',
        code: 'unknown-char',
        message: `unexpected character "${c}"`,
        col: col + i,
        endCol: col + i + 1,
      });
      i++;
    }
  }

  return { ...layoutSegments(segments, marks, text, col, diagnostics), diagnostics };
}

/** Mark positions in twelfths of a beat (¼ = 3, ⅓ = 4, ½ = 6, ⅔ = 8, ¾ = 9): exact arithmetic. */
function positionsOf(marks: Mark[]): number[] {
  const commas = marks.filter((m) => m === 'comma').length;
  if (commas === 2 && marks.length === 2) return [4, 8];
  let seenHalf = false;
  return marks.map((m) => {
    if (m === 'dot') {
      seenHalf = true;
      return 6;
    }
    if (m === 'dotcomma') {
      seenHalf = true;
      return 9;
    }
    return seenHalf ? 9 : 3;
  });
}

function toItem(item: Item | undefined): SolfaItem {
  if (!item || item.kind === 'bad') return { kind: 'rest' };
  if (item.kind === 'hold') return { kind: 'hold' };
  return item.note;
}

function layoutSegments(
  segments: Item[][],
  marks: Mark[],
  text: string,
  col: number,
  diagnostics: BeatDiag[],
): { parts: BeatPart[]; cols: number[] } {
  const pos = positionsOf(marks);
  const ordered = pos.every((p, k) => p > (k === 0 ? 0 : (pos[k - 1] ?? 0)) && p < 12);
  const single = segments.every((s) => s.length <= 1);
  const raw: Array<{ item: SolfaItem; col: number; start: number; length: number }> = [];

  if (ordered && single) {
    segments.forEach((seg, k) => {
      const start = k === 0 ? 0 : (pos[k - 1] ?? 0);
      const end = k < pos.length ? (pos[k] ?? 12) : 12;
      raw.push({ item: toItem(seg[0]), col: seg[0]?.col ?? -1, start: start / 12, length: (end - start) / 12 });
    });
  } else {
    const lead = text.length - text.trimStart().length;
    diagnostics.push({
      severity: 'warning',
      code: 'bad-division',
      message: 'division marks out of order; the beat is split into equal parts',
      col: col + lead,
      endCol: col + text.trimEnd().length,
    });
    const slots = segments.flatMap((seg) => (seg.length > 0 ? seg : [undefined]));
    slots.forEach((slot, k) => {
      raw.push({
        item: toItem(slot),
        col: slot?.col ?? -1,
        start: k / slots.length,
        length: 1 / slots.length,
      });
    });
  }

  // Merge neighbouring rests so an empty beat is one rest part.
  const parts: BeatPart[] = [];
  const cols: number[] = [];
  for (const r of raw) {
    const prev = parts[parts.length - 1];
    if (prev && prev.item.kind === 'rest' && r.item.kind === 'rest') {
      prev.length = r.start + r.length - prev.start;
      continue;
    }
    parts.push({ item: r.item, start: r.start, length: r.length });
    cols.push(r.col);
  }
  return { parts, cols };
}
