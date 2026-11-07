/**
 * Splits the music part of a voice line into cells (separator + text), SOLFA_FORMAT.md §4.
 * Shared by the parser and the formatter.
 */
import type { Accent } from './model';

export interface Cell {
  /** Separator written before the text ('' for the text before the first separator). */
  sep: string;
  sepCol: number;
  accent: Accent;
  /** Raw text after the separator (braces kept). */
  raw: string;
  /** Same text with `{…}` groups and stray braces blanked out (what the player reads). */
  masked: string;
  /** Column of the first character of `raw`. */
  textCol: number;
  /** True when this cell is a beat (see §4: empty lead/trailing text is not a beat). */
  isBeat: boolean;
}

export interface ScannedMusic {
  cells: Cell[];
  /** Columns of unmatched `{` or `}` (reported as `unknown-char`). */
  strayBraces: number[];
  /** True when the line ends with a bar line (`|` or `||`) after its last beat. */
  endsWithBar: boolean;
}

/** Blank out `{…}` groups (kept in the text, ignored by the player). */
export function maskBraces(text: string): { masked: string; stray: number[] } {
  const chars = text.split('');
  const stray: number[] = [];
  let open = -1;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '{') {
      if (open >= 0) stray.push(open);
      open = i;
    } else if (c === '}') {
      if (open >= 0) {
        for (let k = open; k <= i; k++) chars[k] = ' ';
        open = -1;
      } else {
        stray.push(i);
        chars[i] = ' ';
      }
    }
  }
  if (open >= 0) stray.push(open);
  for (const col of stray) chars[col] = ' ';
  stray.sort((a, b) => a - b);
  return { masked: chars.join(''), stray };
}

function accentOf(sep: string): Accent {
  if (sep === '|' || sep === '||') return 'bar';
  if (sep === '!' || sep === '¦') return 'medium';
  if (sep === ':') return 'weak';
  return 'none';
}

/** Scan `line` from column `from` (the music part, after any label). */
export function scanMusic(line: string, from: number): ScannedMusic {
  const { masked: maskedLine, stray } = maskBraces(line);
  const strayBraces = stray.filter((c) => c >= from);
  const seps: Array<{ col: number; text: string }> = [];
  for (let i = from; i < maskedLine.length; i++) {
    const c = maskedLine.charAt(i);
    if (c === '|') {
      if (maskedLine.charAt(i + 1) === '|') {
        seps.push({ col: i, text: '||' });
        i++;
      } else {
        seps.push({ col: i, text: '|' });
      }
    } else if (c === ':' || c === '!' || c === '¦') {
      seps.push({ col: i, text: c });
    }
  }

  const cells: Cell[] = [];
  const pushCell = (sep: string, sepCol: number, start: number, end: number): void => {
    cells.push({
      sep,
      sepCol,
      accent: accentOf(sep),
      raw: line.slice(start, end),
      masked: maskedLine.slice(start, end),
      textCol: start,
      isBeat: true,
    });
  };
  pushCell('', from, from, seps[0]?.col ?? line.length);
  seps.forEach((s, k) => {
    pushCell(s.text, s.col, s.col + s.text.length, seps[k + 1]?.col ?? line.length);
  });

  const lead = cells[0];
  if (lead) lead.isBeat = lead.masked.trim() !== '';
  const last = cells[cells.length - 1];
  let endsWithBar = false;
  if (last && cells.length > 1 && last.masked.trim() === '') {
    last.isBeat = false;
    endsWithBar = last.accent === 'bar';
  }
  return { cells, strayBraces, endsWithBar };
}
