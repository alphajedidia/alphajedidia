// Geometry of symbols relative to the row: baseline, x-height, ascender line (A-05).
// Sol-fa letters (d r m f s l t, e i a o) have NO descenders, which makes the baseline robust.
import { bh, bw, cy, median, quantile, twoMeans, weightedMedian, type Box, type Component } from './geometry';

/** Vertical metrics of one text row (pixels, working image space). */
export interface RowMetrics {
  /** y of the baseline (bottom of letters). */
  baseline: number;
  /** Height of x-height letters (m, r, s). */
  xHeight: number;
  /** Height of ascender letters (d, f, l) above the baseline. */
  ascHeight: number;
  /** True when xHeight came from the row itself (not a page prior). */
  measured: boolean;
}

/** Geometric class of one component (before pairing dots into colons, etc.). */
export type ShapeKind =
  | 'glyph' // letter-sized
  | 'bar' // tall thin line reaching below the baseline: `|`
  | 'stroke' // thin vertical stroke ending above the baseline: top of `!`, stem of `i`
  | 'dot-low' // dot on the baseline: `.`, bottom of `:` / `!`
  | 'dot-high' // dot around the x-line: top of `:`, dot of `i`
  | 'comma' // small mark reaching below the baseline: `,`
  | 'high-mark' // small mark above the x-line: `'` `’` `¹`
  | 'dash' // short horizontal line: `-` `–` `_`
  | 'noise';

export interface Shape {
  kind: ShapeKind;
  /** 0..1 */
  conf: number;
}

/** Letter-like components of a row (used to measure it). */
function letterLike(comps: readonly Component[]): Component[] {
  if (comps.length === 0) return [];
  const big = quantile(comps.map(bh), 0.8);
  // Drop dots, commas and dashes…
  const cand = comps.filter((c) => bh(c) >= 0.4 * big);
  const wide = cand.filter((c) => bw(c) >= 0.3 * bh(c));
  const ref = median((wide.length ? wide : cand).map(bh));
  // …apostrophes (short) and bar lines (thin strokes clearly taller than the letters).
  return cand.filter((c) => bh(c) >= 0.55 * ref && !(bw(c) < 0.3 * bh(c) && bh(c) > 1.3 * ref));
}

/**
 * Measure a row from its components. `prior` (page x-height) is used when the row alone is
 * ambiguous (e.g. only ascender letters).
 */
export function measureRow(comps: readonly Component[], prior?: number): RowMetrics | null {
  const letters = letterLike(comps);
  if (letters.length === 0) return null;
  // Area-weighted: small marks that slipped through (apostrophes) barely count.
  const baseline = weightedMedian(
    letters.map((c) => c.y1),
    letters.map((c) => c.area),
  );
  // Only letters sitting on the baseline (lyrics rows have descenders g, p, y).
  const tol = Math.max(2, 0.15 * median(letters.map(bh)));
  const onBase = letters.filter((c) => Math.abs(c.y1 - baseline) <= tol);
  const hs = (onBase.length ? onBase : letters).map(bh);
  const tm = twoMeans(hs, 1.18);
  if (tm.separated && tm.high <= 1.9 * tm.low) {
    return { baseline, xHeight: tm.low, ascHeight: tm.high, measured: true };
  }
  const m = median(hs);
  if (prior && prior > 0) {
    // One group only: decide whether it is the x-height or the ascender group.
    const r = m / prior;
    if (r > 1.2 && r < 1.8) return { baseline, xHeight: prior, ascHeight: m, measured: false };
    if (r >= 0.75 && r <= 1.2) return { baseline, xHeight: m, ascHeight: m * 1.4, measured: false };
    return { baseline, xHeight: prior, ascHeight: prior * 1.4, measured: false };
  }
  return { baseline, xHeight: m, ascHeight: m * 1.4, measured: false };
}

/** Tunable tolerances; `loose` > 1 widens them (handwriting). */
export interface ShapeOptions {
  loose?: number;
}

/** Classify one component by size and position relative to the row metrics. */
export function classifyShape(c: Box & { area: number }, m: RowMetrics, opts: ShapeOptions = {}): Shape {
  const L = opts.loose ?? 1;
  const xh = Math.max(1, m.xHeight);
  const w = bw(c) / xh;
  const h = bh(c) / xh;
  const top = (m.baseline - c.y0) / xh; // height of the top above the baseline
  const bottom = (m.baseline - c.y1) / xh; // < 0 when below the baseline
  const mid = (m.baseline - cy(c)) / xh;
  const fill = c.area / Math.max(1, bw(c) * bh(c));
  const asc = m.ascHeight / xh;

  if (c.area < 0.004 * xh * xh || (w < 0.07 && h < 0.07)) return { kind: 'noise', conf: 0.9 };

  // Long thin vertical line.
  if (h >= 1.15 && w <= 0.32 * L + 0.04 * h && fill >= 0.45) {
    const below = bottom <= -0.12 * L;
    const aboveAsc = top >= asc + 0.18;
    if (h >= asc + 0.4 || (h >= 1.3 && (below || aboveAsc))) {
      return { kind: 'bar', conf: h >= asc + 0.6 ? 0.95 : 0.7 };
    }
    if (bottom >= 0.18) return { kind: 'stroke', conf: 0.8 }; // `!` stroke ends above baseline
  }
  // Parenthesis around a note, `(m)`: tall, thin, curved (little ink in its box), reaching
  // below the baseline. Ignored: the note inside is a plain note.
  if (h >= 1.2 && h <= asc + 0.9 && bottom <= -0.12 && w <= 0.55 && fill < 0.45) return { kind: 'noise', conf: 0.6 };
  // Thick, very tall solid rule: the heavy stroke of a final double bar.
  if (h >= asc + 0.5 && w <= 0.8 && fill >= 0.75) return { kind: 'bar', conf: 0.8 };
  // Short horizontal line.
  if (w >= 0.28 && h <= 0.38 * L && w / Math.max(h, 0.01) >= 1.7 && mid >= -0.35 && mid <= 0.95) {
    return { kind: 'dash', conf: 0.85 };
  }
  // A short, wider-than-high mark floating at mid x-height is a hold dash too (bold or
  // hand-drawn hyphens are stubby); a dot sits on the baseline, a colon's top dot is round.
  if (w >= 0.2 && w <= 1.2 && h <= 0.4 * L && w / Math.max(h, 0.01) >= 1.3 && bottom >= 0.18 && top <= 0.85) {
    return { kind: 'dash', conf: 0.6 };
  }
  // Dot-sized blob.
  if (w <= 0.5 * L && h <= 0.5 * L && h / Math.max(w, 0.01) <= 2.1 && h / Math.max(w, 0.01) >= 0.45) {
    if (Math.abs(bottom) <= 0.28 * L && top <= 0.6) return { kind: 'dot-low', conf: 0.9 };
    if (bottom < -0.28 * L) return { kind: 'comma', conf: 0.55 };
    if (top >= 0.55 && top <= asc + 0.5) return { kind: 'dot-high', conf: 0.85 };
  }
  // Small mark below the baseline: comma / subscript.
  if (h <= 1.0 * L && w <= 0.55 * L && bottom <= -0.12 && top <= 0.55) return { kind: 'comma', conf: 0.85 };
  // Small mark above the x-line: apostrophe / superscript.
  if (h <= 0.85 * L && w <= 0.6 * L && bottom >= 0.45) return { kind: 'high-mark', conf: 0.85 };
  // Thin stroke sitting above the baseline (stem of `!` when separated from its dot).
  if (h >= 0.6 && w <= 0.3 * L && bottom >= 0.18 && fill >= 0.5) return { kind: 'stroke', conf: 0.6 };
  if (h >= 0.45) return { kind: 'glyph', conf: 0.8 };
  return { kind: 'noise', conf: 0.4 };
}

/**
 * Is a glyph-sized box a lone `l` (lah) rather than a bar line? `l` stands on the baseline and
 * is ascender-high; a printed bar is taller and usually reaches below the baseline.
 */
export function looksLikeLah(b: Box & { area?: number }, m: RowMetrics): boolean {
  const xh = Math.max(1, m.xHeight);
  const h = bh(b) / xh;
  const asc = m.ascHeight / xh;
  const bottom = (m.baseline - b.y1) / xh;
  // A solid stroke: `t` (cross bar) and `r` (arm) fill much less of their box.
  const fill = b.area !== undefined ? b.area / Math.max(1, bw(b) * bh(b)) : 1;
  return Math.abs(bottom) <= 0.12 && h >= Math.max(1.15, 0.85 * asc) && h <= asc + 0.3 && bw(b) / xh <= 0.42 && fill >= 0.55;
}

/** Glyph metrics in x-height units, for guessing a letter when OCR gave nothing usable. */
export function glyphFeatures(b: Box & { area: number }, m: RowMetrics): {
  w: number;
  h: number;
  tall: boolean;
  fill: number;
} {
  const xh = Math.max(1, m.xHeight);
  const h = bh(b) / xh;
  return { w: bw(b) / xh, h, tall: h >= (1 + m.ascHeight / xh) / 2, fill: b.area / Math.max(1, bw(b) * bh(b)) };
}
