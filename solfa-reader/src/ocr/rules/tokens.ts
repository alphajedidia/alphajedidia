// Row items + letter readings → sol-fa tokens of one voice row.
import type { VoiceId } from '../../core';
import { bh, cx, median, type Box } from './geometry';
import type { RowItem } from './marks';
import { normalizeNote, readLabel, type NoteGeometry } from './normalize';
import type { ClusterReading } from './strip';
import { glyphFeatures, looksLikeLah, type RowMetrics } from './symbols';

export type TokenKind = 'sep' | 'note' | 'mark';

export interface Token {
  kind: TokenKind;
  /** '|', '||', ':', '!' for separators; the note text; '.', ',', "'", '-' for marks. */
  text: string;
  box: Box;
  /** 0..1 */
  conf: number;
  /** Uncertainty reason code (see OcrUncertainSpan.reason). */
  reason?: string;
  /** Could be read the other way: a bar that may be `l`, or an `l` that may be a bar. */
  alt?: 'l' | 'bar';
}

export interface VoiceRowTokens {
  tokens: Token[];
  /** Voice label printed at the start of the row, if any. */
  label: VoiceId | null;
  /** Where the label was printed. */
  labelBox?: Box;
}

const MARK_TEXT: Partial<Record<RowItem['kind'], string>> = { dot: '.', comma: ',', apostrophe: "'", dash: '-' };

/**
 * Build the tokens of one music row. `readings[i]` is the engine's reading of the i-th note
 * item (in item order); a missing reading falls back to the glyph shape.
 */
export function buildRowTokens(
  items: readonly RowItem[],
  readings: readonly (ClusterReading | undefined)[],
  m: RowMetrics,
  pageAsc = 0,
): VoiceRowTokens {
  const tokens: Token[] = [];
  let label: VoiceId | null = null;
  let labelBox: Box | undefined;
  let noteIndex = 0;
  let seenSep = false;
  let labelEnd = -Infinity;
  const refAsc = pageAsc > 0 ? pageAsc : ascenderReference([{ items, readings }]);
  for (const it of items) {
    // Punctuation printed right after a label ("S." / "A:") belongs to the label.
    if (label && it.box.x0 - labelEnd <= 0.7 * m.xHeight && (it.kind === 'dot' || it.kind === 'colon' || it.kind === 'comma')) {
      labelEnd = it.box.x1;
      continue;
    }
    labelEnd = -Infinity;
    if (it.kind === 'bar' || it.kind === 'colon' || it.kind === 'medium') {
      seenSep = true;
      const text = it.kind === 'colon' ? ':' : it.kind === 'medium' ? '!' : it.double ? '||' : '|';
      tokens.push({ kind: 'sep', text, box: it.box, conf: it.conf, reason: it.reason, alt: it.alt });
      continue;
    }
    if (it.kind === 'note') {
      const r = readings[noteIndex++];
      const raw = r?.text ?? '';
      const f = glyphFeatures({ ...it.box, area: it.comps.reduce((s, c) => s + c.area, 0) }, m);
      // A printed voice label: capital S/A/T/B at the start of the row, taller than x-height.
      const lab = readLabel(raw);
      if (!seenSep && label === null && tokens.every((t) => t.kind !== 'note') && lab && /[A-Z]/.test(raw) && f.h >= 1.2) {
        label = lab;
        labelBox = it.box;
        labelEnd = it.box.x1;
        continue;
      }
      const geo: NoteGeometry = {
        tall: f.tall,
        width: f.w,
        comps: it.comps.length,
        lahShape: it.comps.length === 1 && looksLikeLah({ ...it.box, area: it.comps[0].area }, m),
      };
      const n = normalizeNote(raw, r ? r.conf : 0, geo);
      // `f` and `t` differ mostly by height: `t` is clearly shorter than the ascender letters.
      // Compared with the `d`/`l` of the same row (ascender height of this font).
      if (refAsc > 0 && it.comps.length === 1 && (n.text === 't' || n.text === 'f')) {
        const hr = bh(it.box) / refAsc;
        if (n.text === 't' && hr >= 0.95) Object.assign(n, { text: 'f', conf: Math.min(n.conf, 0.6), changed: true });
        else if (n.text === 'f' && hr <= 0.91) Object.assign(n, { text: 't', conf: Math.min(n.conf, 0.6), changed: true });
      }
      let reason: string | undefined;
      if (!r || raw === '') reason = 'unread-glyph';
      else if (n.changed) reason = 'corrected-letter';
      else if (n.conf < 0.6) reason = 'low-confidence';
      tokens.push({ kind: 'note', text: n.text, box: it.box, conf: n.conf, reason, alt: it.alt });
      continue;
    }
    const text = MARK_TEXT[it.kind];
    if (text) tokens.push({ kind: 'mark', text, box: it.box, conf: it.conf, reason: it.reason });
  }
  return { tokens: cleanMarks(tokens, m), label, labelBox };
}

/** Drop marks that cannot be where they are (an apostrophe with no note before it). */
function cleanMarks(tokens: Token[], m: RowMetrics): Token[] {
  const out: Token[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (t.kind === 'mark' && t.text === "'" && (!prev || (prev.kind !== 'note' && prev.text !== "'"))) continue;
    // A comma right after a note and close to it is an octave mark; record the geometry hint.
    if (t.kind === 'mark' && t.text === ',' && prev?.kind === 'note' && t.box.x0 - prev.box.x1 > 0.6 * m.xHeight) {
      out.push({ ...t, reason: t.reason ?? 'comma-position' , conf: Math.min(t.conf, 0.55) });
      continue;
    }
    out.push(t);
  }
  return out;
}

/** One beat cell: the separator before it (null for a pick-up before any separator). */
export interface Cell {
  sep: Token | null;
  items: Token[];
}

/** Split a token row into cells at its separators. */
export function splitCells(tokens: readonly Token[]): Cell[] {
  const cells: Cell[] = [{ sep: null, items: [] }];
  for (const t of tokens) {
    if (t.kind === 'sep') cells.push({ sep: t, items: [] });
    else cells[cells.length - 1].items.push(t);
  }
  return cells;
}

/** Text of a cell's content (no spaces: the comma rule of SOLFA_FORMAT §5 then applies). */
export function cellText(c: Cell): string {
  return c.items.map((t) => t.text).join('');
}

/** Rough tokens for a music line read as plain text (fallback when the geometry failed). */
export function tokensFromText(text: string, box: Box): Token[] {
  const out: Token[] = [];
  const n = Math.max(1, text.length);
  const w = (box.x1 - box.x0) / n;
  const re = /\|\||[|:!]|[drmfslt][eiao]?|[.,'-]/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(text))) {
    const t = mm[0];
    const x0 = box.x0 + mm.index * w;
    const b: Box = { x0, y0: box.y0, x1: x0 + t.length * w, y1: box.y1 };
    const kind: TokenKind = /^[|:!]/.test(t) ? 'sep' : /^[drmfslt]/.test(t) ? 'note' : 'mark';
    out.push({ kind, text: t, box: b, conf: 0.4, reason: 'text-fallback' });
  }
  return out;
}

/** Horizontal centre of a token (for column matching). */
export const tokenX = (t: Token): number => cx(t.box);
/** Height of a token box. */
export const tokenH = (t: Token): number => bh(t.box);

/**
 * When some rows of a system start with a printed label, a row whose first cluster sits at the
 * same x before its first separator also starts with a (misread) label: strip it so it is not
 * taken for a pick-up note. Mutates the rows; returns how many labels were recovered.
 */
export function completeLabels(rows: VoiceRowTokens[], xh: number): number {
  const xs = rows.filter((r) => r.labelBox).map((r) => (r.labelBox as Box).x0);
  if (xs.length === 0) return 0;
  const lx = median(xs);
  let n = 0;
  for (const r of rows) {
    if (r.labelBox) continue;
    const first = r.tokens[0];
    if (!first || first.kind !== 'note' || Math.abs(first.box.x0 - lx) > 1.5 * xh) continue;
    let k = 1;
    while (k < r.tokens.length && r.tokens[k].kind !== 'note' && r.tokens[k].text !== '|' && r.tokens[k].text !== '||' && r.tokens[k].box.x0 - r.tokens[k - 1].box.x1 <= 0.7 * xh) k++;
    r.tokens.splice(0, k);
    r.labelBox = first.box;
    n++;
  }
  return n;
}

/**
 * Ascender height of the font: median height of single-component clusters read as `d` or `l`
 * (0 when fewer than two). `f` is as tall as `d`; `t` is clearly shorter in every common font.
 */
export function ascenderReference(rows: readonly { items: readonly RowItem[]; readings: readonly (ClusterReading | undefined)[] }[]): number {
  const asc: number[] = [];
  for (const r of rows) {
    let k = 0;
    for (const it of r.items) {
      if (it.kind !== 'note') continue;
      const t = r.readings[k++]?.text ?? '';
      if ((t === 'd' || t === 'l') && it.comps.length === 1) asc.push(bh(it.box));
    }
  }
  return asc.length >= 2 ? median(asc) : 0;
}
