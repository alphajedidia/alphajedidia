// Page layout (A-04): rows from components, row kinds (music / words / header), systems,
// voice order.
import { VOICE_IDS, type VoiceId } from '../../core/model';
import { bh, bw, cy, median, yOverlap, type Box, type Component } from './geometry';

/** A horizontal band of text and the components assigned to it. */
export interface RowBand extends Box {
  comps: Component[];
}

/** Split the page into text rows using the vertical extent of letter-sized components. */
export function segmentRows(comps: readonly Component[], charH: number): RowBand[] {
  const body = comps.filter((c) => bh(c) >= 0.45 * charH && bh(c) <= 4 * charH);
  if (body.length === 0) return [];
  const maxY = Math.max(...body.map((c) => c.y1));
  const prof = new Float64Array(maxY + 1);
  for (const c of body) for (let y = c.y0; y < c.y1; y++) prof[y] += bw(c);
  const runs: [number, number][] = [];
  let start = -1;
  for (let y = 0; y <= maxY; y++) {
    if (prof[y] > 0 && start < 0) start = y;
    if ((prof[y] === 0 || y === maxY) && start >= 0) {
      runs.push([start, prof[y] === 0 ? y : y + 1]);
      start = -1;
    }
  }
  // Split runs that hold two touching rows at their deepest valley.
  const typical = median(runs.map(([a, b]) => b - a));
  const split = (a: number, b: number, depth: number): [number, number][] => {
    if (depth > 6 || b - a < Math.max(2.2 * charH, 1.7 * typical)) return [[a, b]];
    let peak = 0;
    for (let y = a; y < b; y++) peak = Math.max(peak, prof[y]);
    let best = -1;
    let bestV = Infinity;
    const lo = a + Math.round(0.7 * charH);
    const hi = b - Math.round(0.7 * charH);
    for (let y = lo; y < hi; y++) {
      if (prof[y] < bestV) {
        bestV = prof[y];
        best = y;
      }
    }
    if (best < 0 || bestV > 0.15 * peak) return [[a, b]];
    return [...split(a, best, depth + 1), ...split(best + 1, b, depth + 1)];
  };
  const bands: RowBand[] = [];
  for (const [a, b] of runs) {
    for (const [y0, y1] of split(a, b, 0)) {
      if (y1 - y0 < Math.max(2, 0.3 * charH)) continue;
      bands.push({ x0: Infinity, y0, x1: -Infinity, y1, comps: [] });
    }
  }
  // Assign every component to the nearest band (small marks sit just above/below letters).
  for (const c of comps) {
    // Very tall blobs (pictures, frames) must not stretch a row over its neighbours.
    if (bh(c) > 4 * charH) continue;
    const y = cy(c);
    let best: RowBand | null = null;
    let bestD = Infinity;
    for (const band of bands) {
      const d = y < band.y0 ? band.y0 - y : y > band.y1 ? y - band.y1 : 0;
      if (d < bestD) {
        bestD = d;
        best = band;
      }
    }
    if (best && bestD <= 0.6 * charH) best.comps.push(c);
  }
  const out = bands.filter((b) => b.comps.length > 0);
  for (const b of out) {
    b.x0 = Math.min(...b.comps.map((c) => c.x0));
    b.x1 = Math.max(...b.comps.map((c) => c.x1));
    b.y0 = Math.min(b.y0, ...b.comps.map((c) => c.y0));
    b.y1 = Math.max(b.y1, ...b.comps.map((c) => c.y1));
  }
  return out;
}

const SOLFA_TOKEN = /^[|:!.,'\-drmfsltaeio]+$/;

/**
 * Classify a row from its OCR text by the share of sol-fa tokens: music rows are made of
 * short tokens like `d`, `:m`, `s,.f`, `|`; words rows are syllables; header rows hold
 * key/time statements or a title.
 */
export function classifyRowText(text: string): 'music' | 'words' | 'header' {
  const toks = text.trim().split(/\s+/).filter(Boolean);
  if (toks.length === 0) return 'words';
  let solfa = 0;
  let seps = 0;
  for (const t of toks) {
    if (SOLFA_TOKEN.test(t) && t.replace(/[|:!.,'\-]/g, '').length <= 3) solfa++;
    seps += (t.match(/[|:!]/g) ?? []).length;
  }
  if (solfa / toks.length >= 0.6 && seps >= 2) return 'music';
  if (/\b(do[hn]?|key)\b\s*(is|=|:|dia|of)?/i.test(text) || /\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(text)) return 'header';
  return 'words';
}

/** Minimal row description used to group music rows into systems. */
export interface SystemRow {
  box: Box;
  /** x positions of the separators found in the row. */
  seps: number[];
}

/** Fraction of separators of `b` that line up with one of `a` (within tol). */
export function columnAgreement(a: readonly number[], b: readonly number[], tol: number): number {
  if (a.length === 0 || b.length === 0) return 0;
  const hit = b.filter((x) => a.some((y) => Math.abs(x - y) <= tol)).length;
  return hit / b.length;
}

/**
 * Group consecutive music rows into systems. Graphic bar lines that span several rows are
 * decisive; otherwise the largest group size (4, 3, 2) whose breaks fall on clearly larger
 * vertical gaps than the gaps inside the groups wins.
 */
export function groupSystems(
  rows: readonly SystemRow[],
  rules: readonly Box[],
  xh: number,
  maxVoices = 4,
  textRows: readonly Box[] = [],
): number[][] {
  const n = rows.length;
  if (n === 0) return [];
  if (n === 1) return [[0]];
  // Links from ruled bar lines.
  const linked: boolean[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const a = rows[i].box;
    const b = rows[i + 1].box;
    linked.push(
      rules.some((r) => yOverlap(r, a) >= 0.5 * bh(a) && yOverlap(r, b) >= 0.5 * bh(b)),
    );
  }
  // Blank space between consecutive music rows, not counting text rows printed between them
  // (lyrics between the voices of a system must not look like a gap between systems).
  const gaps: number[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const top = rows[i].box.y1;
    const bot = rows[i + 1].box.y0;
    const inner = textRows
      .filter((t) => cy(t) > top && cy(t) < bot)
      .reduce((sum, t) => sum + Math.max(0, Math.min(t.y1, bot) - Math.max(t.y0, top)), 0);
    gaps.push(Math.max(0, bot - top - inner) + 0.5 * xh);
  }
  const agree: number[] = [];
  for (let i = 0; i + 1 < n; i++) agree.push(columnAgreement(rows[i].seps, rows[i + 1].seps, 0.9 * xh));

  if (linked.some(Boolean)) {
    const groups: number[][] = [[0]];
    for (let i = 0; i + 1 < n; i++) {
      const g = groups[groups.length - 1];
      if (linked[i] && g.length < maxVoices) g.push(i + 1);
      else groups.push([i + 1]);
    }
    return groups;
  }
  if (n <= maxVoices) {
    // One system unless one gap is clearly larger than all the others.
    const mx = Math.max(...gaps);
    const rest = gaps.filter((_, i) => i !== gaps.indexOf(mx));
    const others = rest.length ? Math.max(...rest) : 0;
    if (rest.length === 0 || mx < 1.6 * others || agree[gaps.indexOf(mx)] >= 0.8) return [rows.map((_, i) => i)];
  }
  let bestSize = 0;
  for (let size = Math.min(maxVoices, n); size >= 2; size--) {
    const breaks: number[] = [];
    const inside: number[] = [];
    for (let i = 0; i + 1 < n; i++) ((i + 1) % size === 0 ? breaks : inside).push(gaps[i]);
    if (breaks.length === 0 || inside.length === 0) continue;
    const insideAgree = agree.filter((_, i) => (i + 1) % size !== 0);
    const meanAgree = insideAgree.reduce((s, v) => s + v, 0) / insideAgree.length;
    if (Math.min(...breaks) >= 1.12 * Math.max(...inside) && meanAgree >= 0.5) {
      bestSize = size;
      break;
    }
  }
  if (bestSize === 0) {
    // Fallback: break at gaps much larger than the smallest ones.
    const base = Math.min(...gaps);
    const groups: number[][] = [[0]];
    for (let i = 0; i + 1 < n; i++) {
      const g = groups[groups.length - 1];
      if (gaps[i] <= 1.45 * base && g.length < maxVoices) g.push(i + 1);
      else groups.push([i + 1]);
    }
    return groups;
  }
  const groups: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (i % bestSize === 0) groups.push([]);
    groups[groups.length - 1].push(i);
  }
  return groups;
}

/** Voices for a system of `count` lines, honouring labels read in the image. */
export function assignVoices(count: number, labels: readonly (VoiceId | null)[] = []): VoiceId[] {
  const out: VoiceId[] = [];
  for (let i = 0; i < count; i++) {
    const l = labels[i];
    if (l && !out.includes(l)) out.push(l);
    else out.push(VOICE_IDS.find((v) => !out.includes(v) && !labels.includes(v)) ?? VOICE_IDS[Math.min(i, 3)]);
  }
  return out;
}
