// Turn the connected components of one row into row items (A-06): pair dots into colons,
// strokes + dots into `!`, i-dots into letters, adjacent bars into double bars, and keep the
// small marks (dots, commas, apostrophes, dashes) that a text engine tends to drop.
import { bh, bw, cx, cy, median, union, unionAll, type Box, type Component } from './geometry';
import { classifyShape, looksLikeLah, type RowMetrics, type Shape, type ShapeOptions } from './symbols';

export type ItemKind =
  | 'note' // one or more letters (a note, chromatic, or a voice label)
  | 'bar' // `|` (or `||` when double)
  | 'colon' // `:`
  | 'medium' // `!`
  | 'dot' // `.`
  | 'comma' // `,`
  | 'apostrophe' // `'`
  | 'dash'; // `-`

export interface RowItem {
  kind: ItemKind;
  box: Box;
  comps: Component[];
  /** 0..1 geometric confidence. */
  conf: number;
  /** Double bar (`||`). */
  double?: boolean;
  /** The item could also be read as the other one (`|` vs `l`). */
  alt?: 'l' | 'bar';
  /** Reason code when the geometry was ambiguous. */
  reason?: string;
}

interface Tagged {
  /** Summary box of the members. */
  c: Component;
  members: Component[];
  s: Shape;
  used: boolean;
}

const boxOf = (cs: readonly Component[]): Box => unionAll(cs) ?? { x0: 0, y0: 0, x1: 0, y1: 0 };

/** Group the components of one music row into items, sorted left to right. */
export function groupRowItems(comps: readonly Component[], m: RowMetrics, opts: ShapeOptions = {}): RowItem[] {
  const L = opts.loose ?? 1;
  const xh = Math.max(1, m.xHeight);
  const tagged: Tagged[] = comps.map((c) => ({ c, members: [c], s: classifyShape(c, m, opts), used: false }));
  const of = (k: Shape['kind']) => tagged.filter((t) => !t.used && t.s.kind === k);
  const items: RowItem[] = [];
  const push = (kind: ItemKind, ts: Tagged[], conf: number, extra: Partial<RowItem> = {}) => {
    for (const t of ts) t.used = true;
    const cs = ts.flatMap((t) => t.members);
    items.push({ kind, box: boxOf(cs), comps: cs, conf, ...extra });
  };
  const nearAbove = (low: Tagged, cands: Tagged[], maxDx: number, colon = false): Tagged | undefined => {
    let best: Tagged | undefined;
    let bestD = Infinity;
    for (const h of cands) {
      if (h.used) continue;
      if (colon) {
        // The top dot of a colon sits at the x-line and looks like the bottom dot; an apostrophe
        // (octave mark) sits higher, e.g. `d'.r` must not become `d:r`.
        const mid = (m.baseline - cy(h.c)) / xh;
        const ratio = h.c.area / Math.max(1, low.c.area);
        if (mid > 1.12 * L || ratio < 0.35 || ratio > 2.8) continue;
      }
      const dx = Math.abs(cx(h.c) - cx(low.c));
      if (dx > maxDx) continue;
      if (h.c.y1 > low.c.y0 + 0.1 * xh) continue; // must be above
      const dy = low.c.y0 - h.c.y1;
      if (dy > 1.1 * xh * L) continue;
      if (dx + dy < bestD) {
        bestD = dx + dy;
        best = h;
      }
    }
    return best;
  };

  // `!` = stroke above a low dot.
  for (const dot of of('dot-low')) {
    const st = nearAbove(dot, of('stroke'), 0.45 * xh * L);
    if (st) push('medium', [st, dot], Math.min(st.s.conf, dot.s.conf));
  }
  // `i` = stem (thin glyph) under a high dot: keep it with the letters.
  const glyphs = of('glyph');
  for (const dh of of('dot-high')) {
    const stem = glyphs.find(
      (g) =>
        !g.used &&
        Math.abs(cx(g.c) - cx(dh.c)) <= 0.4 * xh * L &&
        g.c.y0 >= dh.c.y1 - 0.15 * xh &&
        g.c.y0 - dh.c.y1 <= 0.6 * xh * L &&
        bw(g.c) <= 0.45 * xh * L &&
        bh(g.c) <= 1.25 * xh,
    );
    if (stem) {
      stem.c = { ...stem.c, ...union(stem.c, dh.c), area: stem.c.area + dh.c.area };
      stem.members.push(dh.c);
      dh.used = true;
    }
  }
  // `:` = high dot above a low dot (also `;`, where the low part is a comma).
  // (Only dot-shaped upper parts: an apostrophe above a following `.` is `d'.r`, not a colon.)
  const dotLine: number[] = [];
  for (const dot of [...of('dot-low'), ...of('comma')]) {
    const hi = nearAbove(dot, of('dot-high'), 0.45 * xh * L, true);
    if (hi) {
      const semicolon = dot.s.kind === 'comma';
      if (!semicolon) dotLine.push(dot.c.y1);
      push('colon', [hi, dot], semicolon ? 0.6 : Math.min(0.95, (hi.s.conf + dot.s.conf) / 2 + 0.05), {
        reason: semicolon ? 'semicolon-as-colon' : undefined,
      });
    }
  }
  // Low marks: a comma reaches below the line the colon dots sit on; a dot does not.
  const ref = dotLine.length >= 2 ? median(dotLine) : m.baseline;
  for (const t of [...of('dot-low'), ...of('comma')]) {
    const desc = (t.c.y1 - ref) / xh;
    const aspect = bh(t.c) / Math.max(1, bw(t.c));
    const comma = desc >= 0.12 * L || (aspect >= 1.45 && desc >= 0.04);
    const sure = comma ? desc >= 0.2 || aspect >= 1.8 : desc <= 0.06 && aspect <= 1.3;
    t.s = { kind: comma ? 'comma' : 'dot-low', conf: sure ? 0.9 : 0.55 };
  }
  // Bars, merged into double bars when two are close together.
  const bars = of('bar').sort((a, b) => a.c.x0 - b.c.x0);
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (b.used) continue;
    const n = bars[i + 1];
    if (n && !n.used && n.c.x0 - b.c.x1 <= 0.75 * xh * L) {
      push('bar', [b, n], Math.min(b.s.conf, n.s.conf), { double: true });
      continue;
    }
    const lahLike = looksLikeLah(b.c, m);
    push('bar', [b], lahLike ? 0.5 : b.s.conf, lahLike ? { alt: 'l', reason: 'bar-or-lah' } : {});
  }
  // Remaining strokes are letters (an `l` or `i` whose parts were split).
  for (const st of of('stroke')) st.s = { kind: 'glyph', conf: 0.5 };

  // Letters → note clusters (letters close together with no mark between them).
  const glyphList = tagged.filter((t) => !t.used && t.s.kind === 'glyph').sort((a, b) => a.c.x0 - b.c.x0);
  const markCenters: number[] = tagged
    .filter((t) => !t.used && t.s.kind !== 'glyph' && t.s.kind !== 'noise')
    .map((t) => cx(t.c));
  for (const it of items) markCenters.push(cx(it.box));
  let cur: Tagged[] = [];
  const flush = () => {
    if (cur.length === 0) return;
        const lone = cur.length === 1 && looksLikeLah(cur[0].c, m);
    push('note', cur, Math.min(...cur.map((t) => t.s.conf)), lone ? { alt: 'bar' } : {});
    cur = [];
  };
  for (const g of glyphList) {
    if (cur.length > 0) {
      const prevX1 = Math.max(...cur.map((t) => t.c.x1));
      const gap = g.c.x0 - prevX1;
      const between = markCenters.some((x) => x > prevX1 - 0.1 * xh && x < g.c.x0 + 0.1 * xh);
      if (gap > 0.5 * xh * L || between) flush();
    }
    cur.push(g);
  }
  flush();

  // Remaining small marks.
  for (const t of of('dot-low')) push('dot', [t], t.s.conf, t.s.conf < 0.6 ? { reason: 'dot-or-comma' } : {});
  for (const t of of('comma')) push('comma', [t], t.s.conf, t.s.conf < 0.6 ? { reason: 'dot-or-comma' } : {});
  for (const t of of('dash')) push('dash', [t], t.s.conf);
  for (const t of [...of('high-mark'), ...of('dot-high')]) {
    // An octave-up mark sits just right of (or over the right part of) a note.
    const owner = items.find(
      (it) => it.kind === 'note' && t.c.x0 >= it.box.x0 + 0.3 * bw(it.box) && t.c.x0 - it.box.x1 <= 0.8 * xh * L,
    );
    if (owner || t.s.kind === 'high-mark') {
      push('apostrophe', [t], owner ? t.s.conf : 0.45, owner ? {} : { reason: 'stray-mark' });
    }
  }
  return items.sort((a, b) => cx(a.box) - cx(b.box));
}

/** Count separators (bars, colons, `!`) among items: the main cue that a row is music. */
export function countSeparators(items: readonly RowItem[]): number {
  return items.filter((i) => i.kind === 'bar' || i.kind === 'colon' || i.kind === 'medium').length;
}
