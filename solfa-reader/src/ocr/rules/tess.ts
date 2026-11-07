// Flatten Tesseract.js `blocks` output (blocks → paragraphs → lines → words → symbols) into
// plain records. Defensive: the engine output is treated as unknown data.
import type { Box } from './geometry';

export interface TessSymbol {
  text: string;
  /** 0..100 */
  confidence: number;
  box: Box;
}

export interface TessWord extends TessSymbol {
  symbols: TessSymbol[];
}

export interface TessLine extends TessSymbol {
  words: TessWord[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function toBox(v: unknown): Box {
  if (!isObj(v)) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  const n = (k: string) => (typeof v[k] === 'number' ? (v[k] as number) : 0);
  return { x0: n('x0'), y0: n('y0'), x1: n('x1'), y1: n('y1') };
}

function base(v: Record<string, unknown>): TessSymbol {
  return {
    text: typeof v.text === 'string' ? v.text : '',
    confidence: typeof v.confidence === 'number' ? v.confidence : 0,
    box: toBox(v.bbox),
  };
}

/** Lines of a recognised page (in reading order). */
export function flattenPage(page: unknown): TessLine[] {
  const out: TessLine[] = [];
  if (!isObj(page)) return out;
  for (const b of arr(page.blocks)) {
    if (!isObj(b)) continue;
    for (const p of arr(b.paragraphs)) {
      if (!isObj(p)) continue;
      for (const l of arr(p.lines)) {
        if (!isObj(l)) continue;
        const words: TessWord[] = [];
        for (const w of arr(l.words)) {
          if (!isObj(w)) continue;
          const symbols = arr(w.symbols).filter(isObj).map(base);
          words.push({ ...base(w), symbols });
        }
        out.push({ ...base(l), words });
      }
    }
  }
  return out;
}

/** All symbols of a page, in order. */
export function pageSymbols(page: unknown): TessSymbol[] {
  return flattenPage(page).flatMap((l) => l.words.flatMap((w) => w.symbols));
}

/** Plain text of a page's lines joined with spaces, and the mean word confidence (0..1). */
export function pageText(page: unknown): { text: string; conf: number } {
  const lines = flattenPage(page);
  const words = lines.flatMap((l) => l.words);
  const text = lines.map((l) => l.words.map((w) => w.text).join(' ')).join(' ').trim();
  const conf = words.length ? words.reduce((s, w) => s + w.confidence, 0) / words.length / 100 : 0;
  return { text, conf };
}
