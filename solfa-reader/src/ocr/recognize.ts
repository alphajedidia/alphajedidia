// recognizeSolfa orchestration (A-08): canvas → preprocessing → page analysis → Tesseract on
// letter strips and text rows → rules → canonical text. DOM glue only; decisions live in rules/.
import type { OcrLineInfo, OcrProgress, OcrStage, OcrUncertainSpan, RecognitionResult, RecognizeOptions } from './types';
import { getWorker, recognizeCanvas } from './engine';
import { bitmapToCanvas, canvasToGray, detectSkew, preprocessGray, rotateCanvasBy, scaleCanvas } from './image';
import { estimateCharHeight, labelComponents } from './rules/components';
import { workBoxToSource, type Bitmap, type Box, type WorkTransform } from './rules/geometry';
import { analyzePage } from './rules/page';
import { buildResult, type EngineReadings } from './rules/result';
import { assignReadings, composeStrip } from './rules/strip';
import { pageSymbols, pageText } from './rules/tess';

/** Longest side of the working image (memory/time budget on phones). */
const MAX_WORK_SIDE = 2600;
/** Pixel budget when upscaling small text. */
const MAX_WORK_PIXELS = 9_000_000;
/** Character height we try to work at, and the x-height we give Tesseract. */
const TARGET_CHAR_H = 26;
const ENGINE_X_HEIGHT = 30;

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function abortError(): Error {
  return typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : new Error('Aborted');
}

/** Reject as soon as the signal aborts (the engine keeps loading in the background). */
function abortable<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Crop part of a bitmap (with a white margin), as a new bitmap. */
function cropBitmap(b: Bitmap, box: Box, pad: number): Bitmap {
  const x0 = Math.max(0, Math.floor(box.x0 - pad));
  const y0 = Math.max(0, Math.floor(box.y0 - pad));
  const x1 = Math.min(b.width, Math.ceil(box.x1 + pad));
  const y1 = Math.min(b.height, Math.ceil(box.y1 + pad));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) data.set(b.data.subarray((y0 + y) * b.width + x0, (y0 + y) * b.width + x0 + w), y * w);
  return { width: w, height: h, data };
}

export interface WorkImage {
  /** Scaled + straightened canvas the analysis runs on. */
  work: HTMLCanvasElement;
  /** Its binarized pixels. */
  bin: Bitmap;
  transform: WorkTransform;
  warnings: string[];
}

/** Scale (shrink huge photos, enlarge small text), deskew and binarize the input canvas. */
export async function prepareWorkImage(
  image: HTMLCanvasElement,
  hw: boolean,
  progress: (p: number) => void = () => {},
  check: () => void = () => {},
): Promise<WorkImage> {
  const srcW = image.width;
  const srcH = image.height;
  const warnings: string[] = [];
  let scale = Math.min(1, MAX_WORK_SIDE / Math.max(srcW, srcH));
  let work = scaleCanvas(image, scale);
  const first = preprocessGray(canvasToGray(work), { handwriting: hw });
  check();
  await tick();
  const charH0 = estimateCharHeight(labelComponents(first).components);
  progress(0.3);
  if (charH0 > 0 && charH0 < TARGET_CHAR_H * 0.7) {
    const up = Math.min(TARGET_CHAR_H / charH0, Math.sqrt(MAX_WORK_PIXELS / (srcW * srcH)) / scale, 4);
    if (up > 1.15) {
      scale *= up;
      work = scaleCanvas(image, scale);
    }
  }
  const charH = charH0 > 0 ? charH0 * (work.width / Math.max(1, first.width)) : 0;
  if (charH > 0 && charH < 12) warnings.push('low-resolution');
  const skew = detectSkew(work);
  let angle = 0;
  const scaledW = work.width;
  const scaledH = work.height;
  if (Math.abs(skew.angle) >= 0.25 && skew.confidence >= 0.05) {
    angle = skew.angle;
    work = rotateCanvasBy(work, -angle);
  }
  check();
  await tick();
  progress(0.6);
  const bin = preprocessGray(canvasToGray(work), { handwriting: hw, charH: charH || undefined });
  await tick();
  return {
    work,
    bin,
    transform: { scale, angleDeg: angle, scaledW, scaledH, workW: work.width, workH: work.height },
    warnings,
  };
}

/** Full pipeline: image → aligned .solfa text with uncertainty. */
export async function recognizeSolfaImpl(image: HTMLCanvasElement, opts: RecognizeOptions = {}): Promise<RecognitionResult> {
  const t0 = performance.now();
  const hw = !!opts.handwriting;
  const signal = opts.signal;
  const report = (stage: OcrStage, progress: number) => {
    const p: OcrProgress = { stage, progress: Math.max(0, Math.min(1, progress)) };
    opts.onProgress?.(p);
  };
  const check = () => {
    if (signal?.aborted) throw abortError();
  };
  const srcW = image.width;
  const srcH = image.height;

  // 1–2. Working image: scale, deskew, binarize.
  report('preprocessing', 0);
  const { bin, transform, warnings } = await prepareWorkImage(image, hw, (p) => report('preprocessing', p), check);

  // 3. Layout analysis (pure).
  const page = analyzePage(bin, { handwriting: hw });
  report('preprocessing', 1);
  check();

  // 4. Engine.
  report('loading-engine', 0);
  // Only loading messages are progress of this stage (the engine also logs each recognition).
  const onEngine = (p: { status: string; progress: number }) => {
    if (!p.status.startsWith('recogniz')) report('loading-engine', p.progress);
  };
  await abortable(getWorker(onEngine), signal);
  report('loading-engine', 1);
  check();
  const readings: EngineReadings = { notes: new Map(), texts: new Map() };
  const total = Math.max(1, page.rows.length);
  let done = 0;
  for (const row of page.rows.filter((r) => r.kind === 'music')) {
    report('recognizing', done / total);
    if (row.clusters.length > 0) {
      const { bitmap, plan } = composeStrip(page.labelled, row.clusters, row.metrics);
      const s = Math.min(4, Math.max(0.5, ENGINE_X_HEIGHT / Math.max(1, row.metrics.xHeight)));
      const canvas = bitmapToCanvas(bitmap, s);
      const data = await recognizeCanvas(canvas, 'music', signal);
      readings.notes.set(row.index, assignReadings(plan, pageSymbols(data), s));
    }
    done++;
  }
  for (const row of page.rows.filter((r) => r.kind === 'text')) {
    report('recognizing', done / total);
    const pad = Math.round(0.6 * row.metrics.xHeight);
    const crop = cropBitmap(bin, row.band, pad);
    const s = Math.min(4, Math.max(0.5, ENGINE_X_HEIGHT / Math.max(1, row.metrics.xHeight)));
    const data = await recognizeCanvas(bitmapToCanvas(crop, s, 8), 'text', signal);
    readings.texts.set(row.index, pageText(data));
    done++;
  }
  report('recognizing', 1);
  check();

  // 5. Rules → text.
  report('analyzing', 0);
  const res = buildResult(page, readings, { handwriting: hw });
  const lines: OcrLineInfo[] = res.lines
    .filter((l) => l.box && l.kind !== 'blank')
    .map((l) => {
      const b = workBoxToSource(l.box as Box, transform, srcW, srcH);
      return {
        textLine: l.textLine,
        voice: l.voice,
        kind: l.kind === 'voice' ? 'voice' : l.kind === 'words' ? 'words' : 'header',
        bbox: { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 },
        confidence: l.conf,
      };
    });
  const uncertain: OcrUncertainSpan[] = res.uncertain.map((u) => ({
    textLine: u.textLine,
    col: u.col,
    endCol: u.endCol,
    confidence: u.conf,
    reason: u.reason,
  }));
  report('done', 1);
  return {
    text: res.text,
    lines,
    uncertain,
    confidence: res.confidence,
    warnings: [...new Set([...warnings, ...res.warnings])],
    durationMs: Math.round(performance.now() - t0),
    imageSize: { width: srcW, height: srcH },
  };
}
