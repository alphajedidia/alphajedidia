// Page analysis on the binarized working image (pure): components → rows → row items, plus
// the letter strips the text engine must read. The adapter (../recognize.ts) runs the engine
// on the strips and hands the readings to ./result.ts.
import { labelComponents, estimateCharHeight, splitPageComponents, type Labelled } from './components';
import { bh, cx, median, yOverlap, type Bitmap, type Box, type Component } from './geometry';
import { segmentRows, type RowBand } from './layout';
import { countSeparators, groupRowItems, hasGluedApostrophe, type RowItem } from './marks';
import type { StripCluster } from './strip';
import { measureRow, type RowMetrics } from './symbols';

export interface PageOptions {
  /** Handwriting: looser geometric thresholds. */
  handwriting?: boolean;
}

export interface AnalyzedRow {
  index: number;
  band: RowBand;
  metrics: RowMetrics;
  items: RowItem[];
  /** 'music' when the row is made of separators and short note clusters. */
  kind: 'music' | 'text';
  /** Note items of a music row, as strip clusters (same order as the note items). */
  clusters: StripCluster[];
}

export interface PageAnalysis {
  labelled: Labelled;
  /** Typical character height (px). */
  charH: number;
  /** Page x-height (median over rows). */
  xHeight: number;
  rows: AnalyzedRow[];
  verticalRules: Component[];
  warnings: string[];
}

/** Analyse the layout of a binarized page. */
export function analyzePage(bitmap: Bitmap, opts: PageOptions = {}): PageAnalysis {
  const loose = opts.handwriting ? 1.4 : 1;
  const labelled = labelComponents(bitmap);
  const warnings: string[] = [];
  const charH = estimateCharHeight(labelled.components);
  if (charH === 0) {
    return { labelled, charH: 0, xHeight: 0, rows: [], verticalRules: [], warnings: ['no-text-found'] };
  }
  const split = splitPageComponents(labelled.components, charH, loose);
  const bands = segmentRows(split.rest, charH);
  const first = bands.map((b) => measureRow(b.comps));
  const measured = first.filter((m): m is RowMetrics => !!m && m.measured).map((m) => m.xHeight);
  const xHeight = measured.length ? median(measured) : median(first.filter((m) => !!m).map((m) => m!.xHeight));
  if (xHeight < 8) warnings.push('low-resolution');
  const rows: AnalyzedRow[] = [];
  bands.forEach((band, i) => {
    const metrics = first[i]?.measured ? first[i] : measureRow(band.comps, xHeight);
    if (!metrics) return;
    const items = groupRowItems(band.comps, metrics, { loose });
    for (const it of items) {
      if (it.kind === 'note' && it.comps.length === 1 && hasGluedApostrophe(labelled, it.comps[0], metrics)) it.gluedUp = true;
    }
    addRuledBars(items, band, metrics, split.vertical);
    items.sort((a, b) => cx(a.box) - cx(b.box));
    const seps = countSeparators(items);
    const notes = items.filter((it) => it.kind === 'note');
    // Music rows alternate separators and short note clusters (a word is ≥ 3 x-heights wide).
    const wide = notes.filter((n) => n.box.x1 - n.box.x0 > 2.6 * metrics.xHeight).length;
    const music = seps >= 2 && seps >= 0.25 * (notes.length + 1) && wide <= 0.3 * notes.length;
    rows.push({
      index: rows.length,
      band,
      metrics,
      items,
      kind: music ? 'music' : 'text',
      clusters: music ? notes.map((n) => ({ box: n.box, ids: n.comps.map((c) => c.id) })) : [],
    });
  });
  if (!rows.some((r) => r.kind === 'music')) warnings.push('no-music-found');
  return { labelled, charH, xHeight, rows, verticalRules: split.vertical, warnings };
}

/** Graphic bar lines (ruled, spanning rows) become bar items of every row they cross. */
function addRuledBars(items: RowItem[], band: RowBand, m: RowMetrics, rules: readonly Component[]): void {
  const zone: Box = { x0: band.x0, x1: band.x1, y0: m.baseline - m.xHeight, y1: m.baseline };
  for (const r of rules) {
    if (yOverlap(r, zone) < 0.8 * bh(zone)) continue;
    const box: Box = { x0: r.x0, x1: r.x1, y0: Math.max(r.y0, band.y0), y1: Math.min(r.y1, band.y1) };
    // Two ruled lines close together = double bar.
    const near = items.find((it) => it.kind === 'bar' && Math.abs(cx(it.box) - cx(box)) <= 0.8 * m.xHeight);
    if (near) {
      near.double = true;
      near.box = { ...near.box, x0: Math.min(near.box.x0, box.x0), x1: Math.max(near.box.x1, box.x1) };
      near.comps.push(r);
      continue;
    }
    items.push({ kind: 'bar', box, comps: [r], conf: 0.95 });
  }
}
