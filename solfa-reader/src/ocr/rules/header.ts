// Key / time / tempo / title detection in the text rows of a score (part of A-04).
// core's parseKey needs a clean phrase; OCR rows carry noise around it ("Doh is G.   4/4  M. 84"),
// so the phrase is found here and the result validated with parseKey.
import { parseKey } from '../../core';

const LATIN: Record<string, string> = { do: 'C', re: 'D', ré: 'D', mi: 'E', fa: 'F', sol: 'G', so: 'G', la: 'A', si: 'B' };

function accidental(s: string | undefined): '' | '#' | 'b' {
  if (!s) return '';
  const a = s.toLowerCase();
  if (a === '#' || a === '♯' || a.startsWith('di')) return '#';
  if (a === 'b' || a === '♭' || a.startsWith('b')) return 'b';
  return '';
}

/** Find a key statement ("Doh is G", "Do = Sol", "Do dia F#", "Key of Bb") → "G", "F#", "Bb". */
export function detectKey(text: string): string | null {
  const t = text.replace(/[“”"«»]/g, ' ');
  const name = String.raw`(?:([A-G])(?![ac-z])\s*(#|♯|b(?![a-z])|♭)?|(do|r[eé]|mi|fa|sol|so|la|si)(?![a-z])\s*(#|♯|b(?![a-z])|♭|di[eè]sey?|diesy|b[eé]mol(?:a)?)?)`;
  const patterns = [
    new RegExp(String.raw`\bdo[hbn]?\s*(?:is|=|:|dia|-)\s*` + name, 'i'),
    new RegExp(String.raw`\bkey\s*(?:of|:|=)?\s*` + name, 'i'),
  ];
  for (const re of patterns) {
    const mm = re.exec(t);
    if (!mm) continue;
    let name: string | null = null;
    if (mm[1]) name = mm[1].toUpperCase() + accidental(mm[2]);
    else if (mm[3] && LATIN[mm[3].toLowerCase()]) name = LATIN[mm[3].toLowerCase()] + accidental(mm[4]);
    // The core parser must understand what we write (it is what the player will use).
    if (name && parseKey(name)) return name;
  }
  return null;
}

/** Find a time signature like "3/4", "6 / 8", "Time 2/2" → "3/4". */
export function detectTime(text: string): string | null {
  const mm = /(?:^|[^\d/])([1-9]|1[0-2])\s*\/\s*(2|4|8|16)(?![\d/])/.exec(text);
  return mm ? `${mm[1]}/${mm[2]}` : null;
}

/** Find a tempo mark like "M. 84", "MM = 120", "♩ = 96", "Tempo 72" → 84. */
export function detectTempo(text: string): number | null {
  const mm = /(?:\bM\.?\s*M?\.?|♩|\btempo)\s*[=:]?\s*(\d{2,3})\b/i.exec(text);
  if (!mm) return null;
  const v = Number(mm[1]);
  return v >= 20 && v <= 300 ? v : null;
}

/** What a header-area text row says. */
export interface HeaderInfo {
  key?: string;
  time?: string;
  tempo?: number;
  /** The row text when it is none of the above (title, composer, …). */
  other?: string;
}

/** Analyse one header text row. */
export function analyzeHeaderRow(text: string): HeaderInfo {
  const clean = text.replace(/\s+/g, ' ').trim();
  const info: HeaderInfo = {};
  const key = detectKey(clean);
  const time = detectTime(clean);
  const tempo = detectTempo(clean);
  if (key) info.key = key;
  if (time) info.time = time;
  if (tempo) info.tempo = tempo;
  if (!key && !time && !tempo && clean.length > 0) info.other = clean;
  return info;
}

/**
 * Turn header rows (top of the page) into .solfa header lines. The first plain row becomes the
 * title; other plain rows are kept as comments so nothing the user printed is lost.
 * Returns one entry per output line with the index of the row it came from.
 */
export function buildHeaderLines(rows: readonly string[]): { text: string; row: number }[] {
  const out: { text: string; row: number }[] = [];
  let title = false;
  let key = false;
  let time = false;
  let tempo = false;
  rows.forEach((r, i) => {
    const info = analyzeHeaderRow(r);
    if (info.other) {
      const v = info.other.replace(/[|]/g, 'I');
      if (!title) {
        out.push({ text: `title: ${v}`, row: i });
        title = true;
      } else out.push({ text: `# ${v}`, row: i });
    }
    if (info.key && !key) {
      out.push({ text: `key: ${info.key}`, row: i });
      key = true;
    }
    if (info.time && !time) {
      out.push({ text: `time: ${info.time}`, row: i });
      time = true;
    }
    if (info.tempo && !tempo) {
      out.push({ text: `tempo: ${info.tempo}`, row: i });
      tempo = true;
    }
  });
  return out;
}
