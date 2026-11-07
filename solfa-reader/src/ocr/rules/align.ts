// Beat-column alignment across the voices of a system (A-07). In printed sol-fa the beat
// separators of all voices line up vertically: a separator present in most voices but missing
// in one was dropped by the recognition (insert it, flagged); one present in a single voice is
// usually a misread letter (`l` read as a bar) or noise (drop/convert it, flagged).
import { median } from './geometry';
import { splitCells, tokenX, type Cell, type Token } from './tokens';

export interface AlignOptions {
  /** Column tolerance in x-heights (default 1.0; larger for handwriting). */
  tolerance?: number;
}

export interface AlignedSystem {
  /** 'columns': every voice has one cell per column; 'sequential': voices kept as read. */
  mode: 'columns' | 'sequential';
  /** Cells per voice; cell 0 is the pick-up part before the first separator. */
  voices: Cell[][];
  /** Share of separators that sit in a column shared by most voices (0..1). */
  quality: number;
}

interface SepRef {
  v: number;
  tok: Token;
  x: number;
}

/** Cluster x positions (sorted) into columns: a new column starts after a gap > tol. */
export function clusterColumns(xs: readonly number[], tol: number): number[][] {
  const s = [...xs].sort((a, b) => a - b);
  const out: number[][] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x - last[last.length - 1] <= tol && x - last[0] <= 2 * tol) last.push(x);
    else out.push([x]);
  }
  return out;
}

const isStroke = (t: Token | undefined, xh = 0) =>
  !!t && t.kind === 'note' && t.text === 'l' && (t.alt === 'bar' || (xh > 0 && t.box.x1 - t.box.x0 <= 0.5 * xh));
const fillsBeat = (t: Token | undefined) => !!t && (t.kind === 'note' || (t.kind === 'mark' && t.text === '-'));

/**
 * Many books print the medium accent as a short bar `I`, which has the shape of `l` (lah). A
 * lone stroke glued between two items of a beat (`- I s`, `: I d'`) cannot be a note (two notes
 * need a division mark), so it is a separator; strokes standing in the same column in most
 * voices (or in a column where one of them was proven a separator) are separators too.
 */
export function promoteMediumStrokes(rows: readonly Token[][], xh: number, tolerance = 1): Token[][] {
  const tol = tolerance * Math.max(1, xh);
  const out = rows.map((r) => r.map((t) => ({ ...t })));
  const toSep = (t: Token, reason: string) => Object.assign(t, { kind: 'sep', text: '!', conf: Math.min(t.conf, 0.75), reason, alt: undefined });
  const proven: number[] = [];
  for (const r of out) {
    r.forEach((t, i) => {
      if (isStroke(t, xh) && (fillsBeat(r[i - 1]) || fillsBeat(r[i + 1]))) {
        proven.push(tokenX(t));
        toSep(t, 'lah-as-medium');
      }
    });
  }
  const strokes = out.flatMap((r, v) => r.filter(isStroke).map((t) => ({ t, v, x: tokenX(t) })));
  for (const g of clusterColumns(strokes.map((s) => s.x), tol)) {
    const members = strokes.filter((s) => s.x >= g[0] - 1e-6 && s.x <= g[g.length - 1] + 1e-6);
    const voices = new Set(members.map((s) => s.v)).size;
    const near = proven.some((x) => x >= g[0] - tol && x <= g[g.length - 1] + tol);
    if (near || (rows.length >= 3 && voices >= Math.ceil(0.75 * rows.length))) members.forEach((s) => toSep(s.t, 'lah-as-medium'));
  }
  return out;
}

/** Align the token rows of one system. */
export function alignSystem(rows0: readonly Token[][], xh: number, opts: AlignOptions = {}): AlignedSystem {
  const rows = promoteMediumStrokes(rows0, xh, opts.tolerance);
  const n = rows.length;
  const tol = (opts.tolerance ?? 1.0) * Math.max(1, xh);
  const seps: SepRef[] = [];
  rows.forEach((r, v) => r.forEach((tok) => tok.kind === 'sep' && seps.push({ v, tok, x: tokenX(tok) })));
  const sequential = (q: number): AlignedSystem => ({ mode: 'sequential', voices: rows.map((r) => splitCells(r)), quality: q });
  if (n < 2 || seps.length === 0) return sequential(n < 2 ? 1 : 0);

  // Columns from all separator positions.
  const groups = clusterColumns(seps.map((s) => s.x), tol);
  const centers = groups.map((g) => median(g));
  const colOf = (x: number): number => {
    let best = 0;
    for (let i = 1; i < centers.length; i++) if (Math.abs(centers[i] - x) < Math.abs(centers[best] - x)) best = i;
    return best;
  };
  const byCol: SepRef[][] = centers.map(() => []);
  for (const s of seps) byCol[colOf(s.x)].push(s);
  const support = byCol.map((list) => new Set(list.map((s) => s.v)).size);
  const majority = n <= 2 ? 1 : Math.floor(n / 2) + 1;
  const consensus = support.map((s) => s >= majority);
  // Quality: share of separators that at least one other voice confirms.
  const shared = seps.filter((s) => support[colOf(s.x)] >= 2).length;
  const quality = shared / seps.length;
  if (quality < 0.6) return sequential(quality);
  // Dropping a separator merges two cells; if both hold notes the merge would invent an
  // impossible beat (`d:r` → `dr`), so the voices are kept as read instead.
  for (const s of seps) {
    if (consensus[colOf(s.x)] || s.tok.alt === 'l') continue;
    const row = rows[s.v];
    const i = row.indexOf(s.tok);
    const prev = row.slice(0, i).reverse().find((t) => t.kind !== 'mark');
    const next = row.slice(i + 1).find((t) => t.kind !== 'mark');
    if (prev?.kind === 'note' && next?.kind === 'note') return sequential(quality);
  }

  const out: Token[][] = rows.map((r) => r.filter((t) => t.kind !== 'sep').map((t) => ({ ...t })));
  // Per voice: which column each of its separators belongs to (one per column).
  rows.forEach((_, v) => {
    const mine = seps.filter((s) => s.v === v);
    const used = new Set<number>();
    for (const s of mine) {
      const c = colOf(s.x);
      if (!consensus[c]) {
        if (s.tok.alt === 'l') out[v].push({ kind: 'note', text: 'l', box: s.tok.box, conf: 0.5, reason: 'bar-as-lah' });
        // else: an isolated separator no other voice has → dropped (flagged on the cell).
        else markNeighbour(out[v], s.x, 'dropped-separator');
        continue;
      }
      if (used.has(c)) {
        markNeighbour(out[v], s.x, 'dropped-separator');
        continue;
      }
      used.add(c);
      out[v].push({ ...s.tok });
    }
    centers.forEach((x, c) => {
      if (!consensus[c] || used.has(c)) return;
      // Missing here: maybe a bar line read as the letter `l`?
      const lah = out[v].find((t) => t.kind === 'note' && t.alt === 'bar' && Math.abs(tokenX(t) - x) <= tol);
      const type = majorityText(byCol[c]);
      if (lah && (type === '|' || type === '||')) {
        out[v].splice(out[v].indexOf(lah), 1, { ...lah, kind: 'sep', text: type, conf: 0.5, reason: 'lah-as-bar' });
        return;
      }
      const h = byCol[c][0]?.tok.box;
      out[v].push({
        kind: 'sep',
        text: type,
        box: { x0: x, x1: x, y0: rows[v][0]?.box.y0 ?? h?.y0 ?? 0, y1: rows[v][0]?.box.y1 ?? h?.y1 ?? 0 },
        conf: 0.4,
        reason: 'inserted-separator',
      });
    });
  });
  // Separator type agreement inside each column (strong majority only).
  const result = out.map((toks) => toks.sort((a, b) => tokenX(a) - tokenX(b)));
  if (n >= 3) {
    centers.forEach((x, c) => {
      if (!consensus[c]) return;
      const col = result.map((toks) => toks.find((t) => t.kind === 'sep' && colOf(tokenX(t)) === c && Math.abs(tokenX(t) - x) <= 2 * tol));
      const counts = new Map<string, number>();
      for (const t of col) if (t) counts.set(t.text, (counts.get(t.text) ?? 0) + 1);
      const [top, cnt] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
      if (cnt / n < 2 / 3) return;
      for (const t of col) {
        if (t && t.text !== top && !(t.text === '||' && top === '|') && !(t.text === '|' && top === '||')) {
          t.text = top;
          t.conf = Math.min(t.conf, 0.5);
          t.reason = 'corrected-separator';
        }
      }
    });
  }
  return { mode: 'columns', voices: result.map((toks) => splitCells(toks)), quality };
}

function majorityText(list: readonly SepRef[]): string {
  const counts = new Map<string, number>();
  for (const s of list) counts.set(s.tok.text, (counts.get(s.tok.text) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ':';
}

/** Flag the content token nearest to x (the cell whose separator was dropped). */
function markNeighbour(tokens: Token[], x: number, reason: string): void {
  let best: Token | null = null;
  for (const t of tokens) {
    if (t.kind === 'sep') continue;
    if (!best || Math.abs(tokenX(t) - x) < Math.abs(tokenX(best) - x)) best = t;
  }
  if (best) {
    best.reason = best.reason ?? reason;
    best.conf = Math.min(best.conf, 0.5);
  }
}

/** Number of beats (cells after the first separator, plus a non-empty pick-up). */
export function beatCount(cells: readonly Cell[]): number {
  const last = cells.length - 1;
  return cells.filter((c, i) => (i > 0 && (i < last || c.items.length > 0)) || (i === 0 && c.items.length > 0)).length;
}
