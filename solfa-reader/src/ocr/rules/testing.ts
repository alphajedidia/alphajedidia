// Test helpers: draw synthetic sol-fa rows into bitmaps (blocky "glyphs" with the proportions
// of printed type). Used only by *.test.ts files.
import type { Bitmap } from './geometry';

export interface Canvas1 extends Bitmap {
  rect(x: number, y: number, w: number, h: number): Canvas1;
}

/** A blank bitmap with a rectangle-drawing helper. */
export function blank(width: number, height: number): Canvas1 {
  const data = new Uint8Array(width * height);
  const c: Canvas1 = {
    width,
    height,
    data,
    rect(x, y, w, h) {
      for (let yy = Math.max(0, y); yy < Math.min(height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(width, x + w); xx++) data[yy * width + xx] = 1;
      return c;
    },
  };
  return c;
}

/**
 * Draw a sol-fa row with blocky glyphs: x-height `xh`, baseline at `base`. Supported symbols:
 * letters d r m f s l t (and e i a o), `|` `||` `:` `!` `.` `,` `'` `-` and spaces.
 * Returns the x position of every drawn symbol (left edge) for assertions.
 */
export function drawRow(c: Canvas1, text: string, x0: number, base: number, xh = 20, mono = 0): number[] {
  const tall = new Set(['d', 'f', 'l', 't']);
  const xs: number[] = [];
  let x = x0;
  const u = xh / 20;
  const r = (dx: number, dy: number, w: number, h: number) => c.rect(Math.round(x + dx * u), Math.round(base - dy * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)));
  let i = 0;
  let prev = '';
  for (const ch of text) {
    // Monospaced mode: every character starts at x0 + i·mono, so aligned text gives aligned
    // columns (the two strokes of a double bar stay close, as in print).
    if (mono && !(ch === '|' && prev === '|')) x = x0 + i * mono * u;
    i++;
    prev = ch;
    xs.push(x);
    switch (ch) {
      case ' ':
        x += 10 * u;
        break;
      case '|':
        r(0, 40, 3, 50); // from 2 x-heights up to half an x-height below the baseline
        x += 9 * u;
        break;
      case ':':
        r(0, 18, 4, 4);
        r(0, 4, 4, 4);
        x += 8 * u;
        break;
      case '!':
        r(0, 28, 3, 18);
        r(0, 4, 3, 4);
        x += 8 * u;
        break;
      case '.':
        r(0, 4, 4, 4);
        x += 7 * u;
        break;
      case ',':
        r(0, 4, 3, 9);
        x += 7 * u;
        break;
      case "'":
        r(0, 29, 3, 8);
        x += 6 * u;
        break;
      case '-':
        r(0, 11, 10, 3);
        x += 14 * u;
        break;
      case 'l':
        r(0, 29, 4, 29);
        x += 8 * u;
        break;
      case 'i':
        r(0, 20, 4, 20);
        r(0, 28, 4, 4);
        x += 8 * u;
        break;
      case 'm':
        r(0, 20, 22, 20);
        x += 26 * u;
        break;
      case 't':
        r(0, 25, 10, 25);
        x += 14 * u;
        break;
      default:
        if (tall.has(ch)) r(0, 29, 13, 29);
        else r(0, 20, 13, 20);
        x += 17 * u;
    }
  }
  return xs;
}
