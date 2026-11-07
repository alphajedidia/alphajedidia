// Render aligned systems into canonical, column-aligned .solfa text with uncertainty spans
// (A-08, pure part). Layout follows SOLFA_FORMAT §1/§9: `S: | m  :m  :f  | …`, every cell of a
// system padded to the same width, one space after a bar line, separators in the same columns.
import type { VoiceId } from '../../core';
import type { Box } from './geometry';
import type { AlignedSystem } from './align';
import { cellText, type Cell, type Token } from './tokens';

/** Confidence below which a token is reported as uncertain. */
export const UNCERTAIN_BELOW = 0.6;

export interface SpanOut {
  col: number;
  endCol: number;
  conf: number;
  reason: string;
}

export interface LineOut {
  text: string;
  kind: 'voice' | 'words' | 'header' | 'blank';
  voice: VoiceId | null;
  /** Source region (working image space); null for generated lines. */
  box: Box | null;
  conf: number;
  spans: SpanOut[];
}

const isBar = (s: string) => s === '|' || s === '||';

function spanFor(t: Token, col: number): SpanOut | null {
  if (!t.reason && t.conf >= UNCERTAIN_BELOW) return null;
  return { col, endCol: col + Math.max(1, t.text.length), conf: t.conf, reason: t.reason ?? 'low-confidence' };
}

/** Render the voice lines of one aligned system. */
export function renderSystem(sys: AlignedSystem, voices: readonly VoiceId[]): Omit<LineOut, 'box'>[] {
  const cols = Math.max(...sys.voices.map((c) => c.length));
  const width = Math.max(1, ...sys.voices.flatMap((cells) => cells.map((c) => cellText(c).length)));
  const hasPick = sys.voices.some((cells) => cells[0] && cells[0].items.length > 0);
  const sepW: number[] = [];
  for (let j = 1; j < cols; j++) {
    sepW[j] = Math.max(
      0,
      ...sys.voices.map((cells) => {
        const s = cells[j]?.sep?.text ?? '';
        return s.length + (isBar(s) ? 1 : 0);
      }),
    );
  }
  return sys.voices.map((cells, v) => {
    const voice = voices[v] ?? null;
    let text = `${voice ?? 'S'}: `;
    const spans: SpanOut[] = [];
    const confs: number[] = [];
    const addCell = (cell: Cell | undefined) => {
      let col = text.length;
      for (const t of cell?.items ?? []) {
        confs.push(t.conf);
        const sp = spanFor(t, col);
        if (sp) spans.push(sp);
        col += t.text.length;
      }
      text += cellText(cell ?? { sep: null, items: [] }).padEnd(width) + ' ';
    };
    if (hasPick) addCell(cells[0]);
    for (let j = 1; j < cols; j++) {
      const cell = cells[j];
      const s = cell?.sep;
      if (s) {
        confs.push(s.conf);
        const sp = spanFor(s, text.length);
        if (sp) spans.push(sp);
      }
      const sepText = s ? s.text + (isBar(s.text) ? ' ' : '') : '';
      text += sepText.padEnd(sepW[j]);
      addCell(cell);
    }
    text = text.trimEnd();
    const conf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
    return { text, kind: 'voice' as const, voice, conf, spans: spans.filter((sp) => sp.col < text.length) };
  });
}

/** Join blocks (header block, then systems) with blank lines; returns the final document. */
export function joinBlocks(blocks: readonly LineOut[][]): {
  text: string;
  lines: (LineOut & { textLine: number })[];
} {
  const lines: (LineOut & { textLine: number })[] = [];
  const texts: string[] = [];
  blocks
    .filter((b) => b.length > 0)
    .forEach((block, i) => {
      if (i > 0) texts.push('');
      for (const l of block) {
        lines.push({ ...l, textLine: texts.length });
        texts.push(l.text);
      }
    });
  return { text: texts.join('\n') + (texts.length ? '\n' : ''), lines };
}
