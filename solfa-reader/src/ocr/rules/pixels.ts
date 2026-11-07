// Pixel algorithms on plain typed arrays (grayscale, illumination, adaptive threshold, skew).
// Pure: the canvas adapters in ../image.ts feed them ImageData buffers.
import type { Bitmap, GrayImage } from './geometry';

/** RGBA (ImageData.data) → grey (luma). Transparent pixels count as white paper. */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage {
  const n = width * height;
  const out = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = rgba[j + 3] / 255;
    const l = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    out[i] = Math.round(l * a + 255 * (1 - a));
  }
  return { width, height, data: out };
}

/**
 * RGBA → grey using the brightest channel (HSV value). Coloured paper (pink, yellowed), stains
 * and coloured pen or highlighter marks become light, while black print stays dark.
 */
export function toGrayMax(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage {
  const n = width * height;
  const out = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = rgba[j + 3] / 255;
    const v = Math.max(rgba[j], rgba[j + 1], rgba[j + 2]);
    out[i] = Math.round(v * a + 255 * (1 - a));
  }
  return { width, height, data: out };
}

/**
 * Flatten uneven lighting (shadows, phone flash): estimate the paper brightness on a coarse
 * grid (a high percentile per cell), smooth it, and divide it out.
 */
export function flattenIllumination(img: GrayImage, cell = 32, percentile = 0.9): GrayImage {
  const { width: w, height: h, data } = img;
  const gw = Math.max(1, Math.ceil(w / cell));
  const gh = Math.max(1, Math.ceil(h / cell));
  const grid = new Float64Array(gw * gh);
  const hist = new Uint32Array(256);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      hist.fill(0);
      const x0 = gx * cell;
      const y0 = gy * cell;
      const x1 = Math.min(w, x0 + cell);
      const y1 = Math.min(h, y0 + cell);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hist[data[y * w + x]]++;
      const target = (x1 - x0) * (y1 - y0) * percentile;
      let acc = 0;
      let v = 255;
      for (let k = 0; k < 256; k++) {
        acc += hist[k];
        if (acc >= target) {
          v = k;
          break;
        }
      }
      grid[gy * gw + gx] = v;
    }
  }
  // 3×3 box smoothing of the grid, keeping it ≥ a floor so black areas do not explode.
  const sm = new Float64Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let s = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = gy + dy;
          const xx = gx + dx;
          if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue;
          s += grid[yy * gw + xx];
          c++;
        }
      }
      sm[gy * gw + gx] = Math.max(40, s / c);
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / cell - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / cell - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(gw - 1, x0 + 1);
      const tx = fx - x0;
      const top = sm[y0 * gw + x0] * (1 - tx) + sm[y0 * gw + x1] * tx;
      const bot = sm[y1 * gw + x0] * (1 - tx) + sm[y1 * gw + x1] * tx;
      const bg = top * (1 - ty) + bot * ty;
      out[y * w + x] = Math.min(255, Math.round((data[y * w + x] * 255) / bg));
    }
  }
  return { width: w, height: h, data: out };
}

export interface SauvolaOptions {
  /** Half window size in pixels (default ≈ image side / 60, ≥ 7). */
  radius?: number;
  /** Sensitivity (0.1 thin … 0.5 bold); default 0.2. */
  k?: number;
  /** Dynamic range of the standard deviation; default 128. */
  r?: number;
}

/**
 * Sauvola adaptive threshold: T = m·(1 + k·(s/R − 1)) over a square window.
 * Uses running column sums (O(n), memory O(width)) instead of full integral images,
 * which matters on phones with 8–12 MP photos.
 */
export function binarizeSauvola(img: GrayImage, opts: SauvolaOptions = {}): Bitmap {
  const { width: w, height: h, data } = img;
  const rad = Math.max(1, opts.radius ?? Math.max(7, Math.round(Math.min(w, h) / 60)));
  const k = opts.k ?? 0.2;
  const R = opts.r ?? 128;
  const colSum = new Float64Array(w);
  const colSq = new Float64Array(w);
  const out = new Uint8Array(w * h);
  const addRow = (y: number, sign: number) => {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const v = data[o + x];
      colSum[x] += sign * v;
      colSq[x] += sign * v * v;
    }
  };
  for (let y = 0; y <= Math.min(rad, h - 1); y++) addRow(y, 1);
  for (let y = 0; y < h; y++) {
    if (y > 0) {
      if (y + rad < h) addRow(y + rad, 1);
      if (y - rad - 1 >= 0) addRow(y - rad - 1, -1);
    }
    const rows = Math.min(h - 1, y + rad) - Math.max(0, y - rad) + 1;
    let s = 0;
    let sq = 0;
    for (let x = 0; x <= Math.min(rad, w - 1); x++) {
      s += colSum[x];
      sq += colSq[x];
    }
    const o = y * w;
    for (let x = 0; x < w; x++) {
      if (x > 0) {
        if (x + rad < w) {
          s += colSum[x + rad];
          sq += colSq[x + rad];
        }
        if (x - rad - 1 >= 0) {
          s -= colSum[x - rad - 1];
          sq -= colSq[x - rad - 1];
        }
      }
      const n = rows * (Math.min(w - 1, x + rad) - Math.max(0, x - rad) + 1);
      const mean = s / n;
      const v = sq / n - mean * mean;
      const sd = v > 0 ? Math.sqrt(v) : 0;
      const t = mean * (1 + k * (sd / R - 1));
      out[o + x] = data[o + x] < t ? 1 : 0;
    }
  }
  return { width: w, height: h, data: out };
}

/** Global Otsu threshold of a grey image (0..255). */
export function otsuThreshold(img: GrayImage): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < img.data.length; i++) hist[img.data[i]]++;
  const total = img.data.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  return thr;
}

/** 3×3 majority filter: removes isolated speckles and fills pin-holes (handwriting mode). */
export function majorityFilter(b: Bitmap): Bitmap {
  const { width: w, height: h, data } = b;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          c += data[yy * w + xx];
        }
      }
      out[y * w + x] = c >= 5 ? 1 : 0;
    }
  }
  return { width: w, height: h, data: out };
}

/** Shrink a bitmap by an integer factor; a cell is ink if any of its pixels is ink. */
export function downsampleBitmap(b: Bitmap, factor: number): Bitmap {
  const f = Math.max(1, Math.floor(factor));
  if (f === 1) return b;
  const w = Math.ceil(b.width / f);
  const h = Math.ceil(b.height / f);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < b.height; y++) {
    const oy = Math.floor(y / f) * w;
    const o = y * b.width;
    for (let x = 0; x < b.width; x++) if (b.data[o + x]) out[oy + Math.floor(x / f)] = 1;
  }
  return { width: w, height: h, data: out };
}

/** Rotate a bitmap by `deg` (positive = clockwise on screen) around its centre, same size. */
export function rotateBitmap(b: Bitmap, deg: number): Bitmap {
  const { width: w, height: h } = b;
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out = new Uint8Array(w * h);
  const mx = w / 2;
  const my = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // inverse mapping: destination → source
      const dx = x + 0.5 - mx;
      const dy = y + 0.5 - my;
      const sx = Math.floor(dx * c + dy * s + mx);
      const sy = Math.floor(-dx * s + dy * c + my);
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) out[y * w + x] = b.data[sy * w + sx];
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * Estimate the skew of text lines by maximising the sharpness of the horizontal projection
 * profile over ±maxDeg. Returns the line slope in degrees (positive = lines go down to the
 * right, i.e. the page is rotated clockwise); rotate by −angle to correct.
 */
export function estimateSkew(b: Bitmap, maxDeg = 15): { angle: number; confidence: number } {
  const { width: w, height: h, data } = b;
  // Bottom edges of ink runs give a sharper profile than all ink pixels (baselines).
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < h - 1; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      if (data[o + x] && !data[o + w + x]) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 50) return { angle: 0, confidence: 0 };
  const stride = Math.max(1, Math.floor(xs.length / 120000));
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < xs.length; i += stride) {
    px.push(xs[i]);
    py.push(ys[i]);
  }
  const offset = w + 2;
  const bins = new Float64Array(h + 2 * w + 4);
  const score = (deg: number): number => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    bins.fill(0);
    for (let i = 0; i < px.length; i++) {
      const yy = Math.round(py[i] * c - px[i] * s) + offset;
      if (yy >= 0 && yy < bins.length) bins[yy]++;
    }
    let sq = 0;
    for (let i = 0; i < bins.length; i++) sq += bins[i] * bins[i];
    return sq;
  };
  let best = 0;
  let bestScore = -1;
  const coarse: number[] = [];
  for (let d = -maxDeg; d <= maxDeg + 1e-9; d += 0.5) {
    const sc = score(d);
    coarse.push(sc);
    if (sc > bestScore) {
      bestScore = sc;
      best = d;
    }
  }
  const center = best;
  for (let d = center - 0.5; d <= center + 0.5 + 1e-9; d += 0.05) {
    const sc = score(d);
    if (sc > bestScore) {
      bestScore = sc;
      best = d;
    }
  }
  const sorted = [...coarse].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const confidence = bestScore > 0 ? Math.max(0, Math.min(1, (bestScore - med) / bestScore)) : 0;
  return { angle: Math.round(best * 100) / 100, confidence };
}

/** Box blur with radius r (separable running sums): suppresses sensor noise before thresholding. */
export function boxBlur(img: GrayImage, r: number): GrayImage {
  if (r < 1) return img;
  const { width: w, height: h, data } = img;
  const tmp = new Float64Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let s = 0;
    for (let x = -r; x <= r; x++) s += data[o + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[o + x] = s / (2 * r + 1);
      s += data[o + Math.min(w - 1, x + r + 1)] - data[o + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = Math.round(s / (2 * r + 1));
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * Estimate the standard deviation of pixel noise from horizontal neighbour differences
 * (median absolute difference is insensitive to the few large differences at letter edges).
 */
export function estimateNoise(img: GrayImage): number {
  const { width: w, height: h, data } = img;
  const hist = new Uint32Array(256);
  let n = 0;
  const step = Math.max(1, Math.floor((w * h) / 400000));
  for (let i = 0; i + 1 < w * h; i += step) {
    if ((i + 1) % w === 0) continue;
    hist[Math.abs(data[i] - data[i + 1])]++;
    n++;
  }
  let acc = 0;
  for (let d = 0; d < 256; d++) {
    acc += hist[d];
    if (acc >= n / 2) return d / 0.6745 / Math.SQRT2;
  }
  return 0;
}
