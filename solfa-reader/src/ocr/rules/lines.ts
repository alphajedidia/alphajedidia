// Ruled lines (tables, frames, staff-like rules, long bar lines): found as long runs of ink and
// erased, so letters inside table cells become separate rows again (X-02, real photos).
// Vertical segments are kept: in sol-fa tables they are the bar lines.
import type { Labelled } from './components';
import type { Bitmap, Box } from './geometry';

export interface RuledLines {
  /** The bitmap without the line pixels. */
  cleaned: Bitmap;
  /** Vertical line segments (candidate bar lines), merged per column. */
  vertical: (Box & { area: number })[];
  /** Number of horizontal line pixels erased (0 = no table). */
  horizontalPixels: number;
}

/**
 * Erase long thin lines. A pixel belongs to a horizontal line when it lies on a horizontal run
 * (tolerating ±1 px of slope) of at least `5·charH` and the ink through it vertically is thin;
 * vertical lines likewise with runs of at least `2.6·charH`. Letters touching a line keep their
 * own strokes, which are thick across the line direction.
 */
export function removeRuledLines(b: Bitmap, charH: number): RuledLines {
  const { width: w, height: h, data } = b;
  const thin = Math.max(2, Math.round(0.3 * charH));
  const minH = Math.max(40, Math.round(5 * charH));
  const minV = Math.max(30, Math.round(2.6 * charH));
  const out = new Uint8Array(data);
  let src: Uint8Array = data;
  const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] === 1;
  const vRun = (x: number, y: number) => {
    let a = y;
    let c = y;
    while (a > 0 && ink(x, a - 1) && y - a < thin + 1) a--;
    while (c < h - 1 && ink(x, c + 1) && c - y < thin + 1) c++;
    return c - a + 1;
  };
  const hRun = (x: number, y: number) => {
    let a = x;
    let c = x;
    while (a > 0 && ink(a - 1, y) && x - a < thin + 1) a--;
    while (c < w - 1 && ink(c + 1, y) && c - x < thin + 1) c++;
    return c - a + 1;
  };
  let horizontalPixels = 0;
  // Horizontal lines.
  for (let y = 0; y < h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && (ink(x, y) || ink(x, y - 1) || ink(x, y + 1));
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minH) {
          for (let k = start; k < x; k++) {
            if (ink(k, y) && vRun(k, y) <= thin) {
              out[y * w + k] = 0;
              horizontalPixels++;
            }
          }
        }
        start = -1;
      }
    }
  }
  // Vertical lines, on the image without its horizontal lines (so crossings are thin too).
  src = new Uint8Array(out);
  const segs: (Box & { area: number })[] = [];
  for (let x = 0; x < w; x++) {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && (ink(x, y) || ink(x - 1, y) || ink(x + 1, y));
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        if (y - start >= minV) {
          let n = 0;
          for (let k = start; k < y; k++) {
            if (ink(x, k) && hRun(x, k) <= thin) {
              out[k * w + x] = 0;
              n++;
            }
          }
          if (n >= 0.6 * (y - start)) segs.push({ x0: x, x1: x + 1, y0: start, y1: y, area: n });
        }
        start = -1;
      }
    }
  }
  // Merge neighbouring columns of the same line.
  segs.sort((a, c) => a.x0 - c.x0 || a.y0 - c.y0);
  const vertical: (Box & { area: number })[] = [];
  for (const s of segs) {
    const v = vertical.find((o) => s.x0 - o.x1 <= 2 && s.y0 < o.y1 && s.y1 > o.y0);
    if (v) {
      v.x1 = Math.max(v.x1, s.x1);
      v.y0 = Math.min(v.y0, s.y0);
      v.y1 = Math.max(v.y1, s.y1);
      v.area += s.area;
    } else vertical.push({ ...s });
  }
  return { cleaned: { width: w, height: h, data: out }, vertical, horizontalPixels };
}

/**
 * Frames: a big blob that is thin on average (the outline of a table, possibly slanted by
 * perspective). Returns the ids of such components and the vertical segments inside them
 * (columns holding at least `2.6·charH` of the frame's ink), which are bar lines.
 */
export function findFrames(lab: Labelled, charH: number): { ids: Set<number>; vertical: (Box & { area: number })[] } {
  const ids = new Set<number>();
  const vertical: (Box & { area: number })[] = [];
  for (const c of lab.components) {
    const w = c.x1 - c.x0;
    const h = c.y1 - c.y0;
    if (Math.max(w, h) < 6 * charH || c.area / (w + h) > 0.5 * charH) continue;
    ids.add(c.id);
    // Column profile of the frame.
    const cnt = new Uint32Array(w);
    const top = new Int32Array(w).fill(h);
    const bot = new Int32Array(w).fill(-1);
    for (let y = c.y0; y < c.y1; y++) {
      for (let x = c.x0; x < c.x1; x++) {
        if (lab.labels[y * lab.width + x] !== c.id) continue;
        const i = x - c.x0;
        cnt[i]++;
        top[i] = Math.min(top[i], y - c.y0);
        bot[i] = Math.max(bot[i], y - c.y0);
      }
    }
    let start = -1;
    for (let i = 0; i <= w; i++) {
      const on = i < w && cnt[i] >= 2.6 * charH;
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        let y0 = Infinity;
        let y1 = -Infinity;
        let area = 0;
        for (let k = start; k < i; k++) {
          y0 = Math.min(y0, top[k]);
          y1 = Math.max(y1, bot[k]);
          area += cnt[k];
        }
        vertical.push({ x0: c.x0 + start, x1: c.x0 + i, y0: c.y0 + y0, y1: c.y0 + y1 + 1, area });
        start = -1;
      }
    }
  }
  return { ids, vertical };
}
