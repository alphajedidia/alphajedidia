// Page analysis + engine readings → canonical .solfa text, line regions, uncertain spans.
import { alignSystem, beatCount } from './align';
import { joinBlocks, renderSystem, type LineOut, type SpanOut } from './assemble';
import type { Box } from './geometry';
import { analyzeHeaderRow, buildHeaderLines } from './header';
import { assignVoices, classifyRowText, groupSystems } from './layout';
import { normalizeMusicLine } from './normalize';
import type { PageAnalysis, PageOptions } from './page';
import type { ClusterReading } from './strip';
import { ascenderReference, buildRowTokens, completeLabels, tokensFromText, tokenX, type Token } from './tokens';
import type { VoiceId } from '../../core';

export interface EngineReadings {
  /** Music row index → one reading per note cluster. */
  notes: Map<number, ClusterReading[]>;
  /** Text row index → plain text reading. */
  texts: Map<number, { text: string; conf: number }>;
}

export interface PageResult {
  text: string;
  lines: (LineOut & { textLine: number })[];
  uncertain: (SpanOut & { textLine: number })[];
  confidence: number;
  warnings: string[];
}

interface MusicRowOut {
  y: number;
  box: Box;
  /** Text-line box from the row metrics (robust to stray blobs stretching the band). */
  core: Box;
  tokens: Token[];
  label: VoiceId | null;
  labelBox?: Box;
}

/** Build the document from the page analysis and the engine's readings. */
export function buildResult(page: PageAnalysis, rd: EngineReadings, opts: PageOptions = {}): PageResult {
  const warnings = [...page.warnings];
  const music: MusicRowOut[] = [];
  const texts: { y: number; box: Box; text: string; conf: number; kind: 'words' | 'header' }[] = [];
  const musicRows = page.rows.filter((r) => r.kind === 'music');
  const pageAsc = ascenderReference(musicRows.map((r) => ({ items: r.items, readings: rd.notes.get(r.index) ?? [] })));
  for (const row of page.rows) {
    const box: Box = { x0: row.band.x0, y0: row.band.y0, x1: row.band.x1, y1: row.band.y1 };
    if (row.kind === 'music') {
      const r = buildRowTokens(row.items, rd.notes.get(row.index) ?? [], row.metrics, pageAsc);
      const core = { x0: box.x0, x1: box.x1, y0: row.metrics.baseline - row.metrics.ascHeight, y1: row.metrics.baseline + 0.35 * row.metrics.xHeight };
      music.push({ y: core.y0, box, core, tokens: r.tokens, label: r.label, labelBox: r.labelBox });
      continue;
    }
    const t = rd.texts.get(row.index);
    const text = cleanTextRow(t?.text ?? '');
    if (!text) continue;
    const kind = classifyRowText(text);
    if (kind === 'music') {
      music.push({ y: row.band.y0, box, core: box, tokens: tokensFromText(normalizeMusicLine(text), box), label: null });
      warnings.push('music-read-as-text');
    } else texts.push({ y: row.band.y0, box, text, conf: t?.conf ?? 0, kind });
  }
  music.sort((a, b) => a.y - b.y);
  if (music.length === 0 && !warnings.includes('no-music-found')) warnings.push('no-music-found');

  const groups = groupSystems(
    music.map((m) => ({ box: m.core, seps: m.tokens.filter((t) => t.kind === 'sep').map(tokenX) })),
    page.verticalRules,
    page.xHeight,
    4,
    page.rows.filter((r) => r.kind === 'text').map((r) => r.band),
  );
  const blocks: LineOut[][] = [];
  // Header block: text rows above the first music row.
  const firstY = music.length ? music[0].y : Infinity;
  const headRows = texts.filter((t) => t.y < firstY);
  const header = buildHeaderLines(headRows.map((t) => t.text));
  blocks.push(
    header.map((h) => ({
      text: h.text,
      kind: 'header' as const,
      voice: null,
      box: headRows[h.row].box,
      conf: headRows[h.row].conf,
      spans: headRows[h.row].conf < 0.6 ? [{ col: 0, endCol: h.text.length, conf: headRows[h.row].conf, reason: 'low-confidence' }] : [],
    })),
  );
  const tol = opts.handwriting ? 1.6 : 1.0;
  let totalConf = 0;
  let totalW = 0;
  groups.forEach((g, gi) => {
    const rows = g.map((i) => music[i]);
    const sysTop = rows[0].y;
    const nextTop = gi + 1 < groups.length ? music[groups[gi + 1][0]].y : Infinity;
    // A key change printed between systems.
    const between = texts.filter((t) => t.y < sysTop && t.y >= (gi > 0 ? music[groups[gi - 1][groups[gi - 1].length - 1]].y : firstY));
    const keyLines: LineOut[] = [];
    for (const t of between) {
      const info = analyzeHeaderRow(t.text);
      if (gi > 0 && info.key) keyLines.push({ text: `key: ${info.key}`, kind: 'header', voice: null, box: t.box, conf: t.conf, spans: [] });
    }
    if (keyLines.length) blocks.push(keyLines);
    completeLabels(rows, page.xHeight);
    const aligned = alignSystem(
      rows.map((r) => r.tokens),
      page.xHeight,
      { tolerance: tol },
    );
    if (rows.length > 1 && aligned.mode === 'sequential') warnings.push('alignment-poor');
    const counts = aligned.voices.map(beatCount);
    if (new Set(counts).size > 1) warnings.push('beat-count-mismatch');
    const voices = assignVoices(rows.length, rows.map((r) => r.label));
    const rendered = renderSystem(aligned, voices);
    const block: LineOut[] = rendered.map((l, i) => ({ ...l, box: rows[i].box }));
    for (const l of rendered) {
      const w = Math.max(1, l.text.length);
      totalConf += l.conf * w;
      totalW += w;
    }
    // Words printed under (or between) the voices of this system.
    const lastY = rows[rows.length - 1].y;
    for (const t of texts) {
      if (t.y <= sysTop || t.y >= nextTop) continue;
      if (analyzeHeaderRow(t.text).key && t.y > lastY) continue; // key change for the next system
      const text = `W: ${t.text}`;
      block.push({ text, kind: 'words', voice: null, box: t.box, conf: t.conf, spans: [] });
    }
    blocks.push(block);
  });
  const doc = joinBlocks(blocks);
  const uncertain = doc.lines.flatMap((l) => l.spans.map((s) => ({ ...s, textLine: l.textLine })));
  let confidence = totalW ? totalConf / totalW : 0;
  if (opts.handwriting) {
    confidence *= 0.85;
    warnings.push('handwriting-mode');
  }
  return { text: doc.text, lines: doc.lines, uncertain, confidence, warnings: [...new Set(warnings)] };
}

/**
 * Clean a text row: drop dotted leader lines (`hmmm……………`), rules drawn with dashes or
 * underscores, and rows with almost no letters (stray marks, arrows).
 */
export function cleanTextRow(raw: string): string {
  const t = raw
    .replace(/[.·…,:;'`_~\-–—=]{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (t.match(/\p{L}/gu) ?? []).length >= 2 ? t : '';
}
