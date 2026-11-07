// Canvas adapters for the image utilities (A-01). The pixel algorithms themselves are pure and
// live in ./rules/pixels.ts so they are unit-tested in node.
import type { Rect } from './types';
import type { Bitmap, GrayImage } from './rules/geometry';
import { binarizeSauvola, boxBlur, estimateNoise, estimateSkew, flattenIllumination, majorityFilter, toGray } from './rules/pixels';

/** Create a canvas (DOM). */
export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas not available');
  return ctx;
}

/** Decode an image file (respecting EXIF orientation) into a canvas no larger than maxSide. */
export async function loadImageToCanvas(file: Blob, maxSide = 2400): Promise<HTMLCanvasElement> {
  let source: CanvasImageSource;
  let w: number;
  let h: number;
  let close = () => {};
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    source = bmp;
    w = bmp.width;
    h = bmp.height;
    close = () => bmp.close();
  } catch {
    // Older browsers: <img> applies EXIF orientation itself (CSS image-orientation: from-image).
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      source = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    } finally {
      close = () => URL.revokeObjectURL(url);
    }
  }
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = createCanvas(w * s, h * s);
  const ctx = ctx2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  close();
  return c;
}

/** Rotate by quarter turns (positive = clockwise). */
export function rotateCanvas(canvas: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const q = ((Math.round(quarterTurns) % 4) + 4) % 4;
  const swap = q % 2 === 1;
  const c = createCanvas(swap ? canvas.height : canvas.width, swap ? canvas.width : canvas.height);
  const ctx = ctx2d(c);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((q * Math.PI) / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

/** Copy a rectangle (clamped to the canvas) into a new canvas. */
export function cropCanvas(canvas: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.max(1, Math.min(canvas.width - x, Math.round(rect.w)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.round(rect.h)));
  const c = createCanvas(w, h);
  ctx2d(c).drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return c;
}

/** Rotate by an arbitrary angle (positive = clockwise), growing the canvas, white background. */
export function rotateCanvasBy(canvas: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const a = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const w = canvas.width * cos + canvas.height * sin;
  const h = canvas.width * sin + canvas.height * cos;
  const c = createCanvas(Math.ceil(w), Math.ceil(h));
  const ctx = ctx2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(a);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

/** Scale a canvas (smoothly); returns the same canvas when factor is 1. */
export function scaleCanvas(canvas: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  if (Math.abs(factor - 1) < 1e-3) return canvas;
  const c = createCanvas(canvas.width * factor, canvas.height * factor);
  const ctx = ctx2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

/** Grey pixels of a canvas. */
export function canvasToGray(canvas: HTMLCanvasElement): GrayImage {
  const d = ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
  return toGray(d.data, canvas.width, canvas.height);
}

/** Draw a bitmap (ink black on white) into a canvas, scaled by `scale`, with a white margin. */
export function bitmapToCanvas(b: Bitmap, scale = 1, margin = 0): HTMLCanvasElement {
  const src = createCanvas(b.width, b.height);
  const ctx = ctx2d(src);
  const img = ctx.createImageData(b.width, b.height);
  for (let i = 0, j = 0; i < b.data.length; i++, j += 4) {
    const v = b.data[i] ? 0 : 255;
    img.data[j] = v;
    img.data[j + 1] = v;
    img.data[j + 2] = v;
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (scale === 1 && margin === 0) return src;
  const out = createCanvas(b.width * scale + 2 * margin, b.height * scale + 2 * margin);
  const octx = ctx2d(out);
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(src, margin, margin, b.width * scale, b.height * scale);
  return out;
}

export interface PreprocessOptions {
  handwriting?: boolean;
  /** Expected character height, used to size the threshold window. */
  charH?: number;
}

/** Grey → flattened lighting → adaptive threshold (→ speckle cleaning for handwriting). */
export function preprocessGray(gray: GrayImage, opts: PreprocessOptions = {}): Bitmap {
  // Noisy photos (dim light, cheap sensors) need smoothing or Sauvola turns grain into specks.
  const noise = estimateNoise(gray);
  const blurR = noise > 14 ? 2 : noise > 4 || opts.handwriting ? 1 : 0;
  const smooth = boxBlur(gray, blurR);
  const flat = flattenIllumination(smooth, opts.charH ? Math.max(16, Math.round(opts.charH * 2)) : 32);
  const radius = opts.charH ? Math.max(8, Math.round(opts.charH * (opts.handwriting ? 1.6 : 1.2))) : undefined;
  let b = binarizeSauvola(flat, { radius, k: opts.handwriting ? 0.25 : 0.2 });
  if (opts.handwriting) b = majorityFilter(b);
  return b;
}

/** Detect the skew of a canvas (degrees, positive = clockwise) from a reduced binarized copy. */
export function detectSkew(canvas: HTMLCanvasElement): { angle: number; confidence: number } {
  const f = Math.max(1, Math.max(canvas.width, canvas.height) / 1400);
  const small = scaleCanvas(canvas, 1 / f);
  return estimateSkew(binarizeSauvola(canvasToGray(small)));
}

/** Detect and correct a small rotation (±15°): returns the straightened canvas and the angle found. */
export function deskewCanvas(canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; angle: number } {
  const { angle, confidence } = detectSkew(canvas);
  if (Math.abs(angle) < 0.2 || confidence < 0.05) return { canvas, angle: 0 };
  return { canvas: rotateCanvasBy(canvas, -angle), angle };
}
