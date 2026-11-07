// Lazy, self-hosted Tesseract.js worker (A-02). One worker for the whole app, created on first
// use. Every asset comes from ./tesseract/ next to index.html (copied by
// scripts/copy-tesseract-assets.mjs) — never from a CDN — so it works offline.
import type Tesseract from 'tesseract.js';

/** 'music': letter strips with a sol-fa whitelist; 'text': headers and lyrics. */
export type EnginePass = 'music' | 'text';

export interface EngineProgress {
  status: string;
  /** 0..1 */
  progress: number;
}

type TesseractModule = typeof Tesseract;

/**
 * Letters that can appear in a note strip (notes, chromatic vowels, voice labels), plus the
 * apostrophe: in bold or blurred print the octave mark touches its letter (`d'` is one blob).
 */
export const MUSIC_WHITELIST = "drmfsltaeioSATB'";

let workerPromise: Promise<Tesseract.Worker> | null = null;
let worker: Tesseract.Worker | null = null;
let tesseract: TesseractModule | null = null;
let currentPass: EnginePass | null = null;
let listener: ((p: EngineProgress) => void) | null = null;

/** Absolute URL of a bundled asset; the worker runs from a blob URL so paths must be absolute. */
export function assetUrl(relative: string): string {
  const base = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
  return new URL(relative, base).href;
}

async function loadModule(): Promise<TesseractModule> {
  if (tesseract) return tesseract;
  const mod: unknown = await import('tesseract.js');
  // CommonJS interop: the API is on `default` in some bundles, on the namespace in others.
  const m = mod as { default?: TesseractModule } & TesseractModule;
  tesseract = m.default && typeof m.default.createWorker === 'function' ? m.default : m;
  return tesseract;
}

/** Get (or start) the worker. `onProgress` receives loading progress while it starts. */
export async function getWorker(onProgress?: (p: EngineProgress) => void): Promise<Tesseract.Worker> {
  listener = onProgress ?? null;
  if (!workerPromise) {
    workerPromise = (async () => {
      const T = await loadModule();
      const w = await T.createWorker(
        'eng',
        T.OEM.LSTM_ONLY,
        {
          workerPath: assetUrl('./tesseract/worker.min.js'),
          corePath: assetUrl('./tesseract/core'),
          langPath: assetUrl('./tesseract/lang'),
          gzip: true,
          cacheMethod: 'write',
          logger: (m) => listener?.({ status: m.status, progress: typeof m.progress === 'number' ? m.progress : 0 }),
        },
        // Dictionaries bias readings towards English words; lyrics are Malagasy and notes are
        // single letters, so the word lists only hurt.
        { load_system_dawg: '0', load_freq_dawg: '0' },
      );
      worker = w;
      currentPass = null;
      return w;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
      worker = null;
    });
  }
  return workerPromise;
}

function passParams(T: TesseractModule, pass: EnginePass): Partial<Tesseract.WorkerParams> {
  return pass === 'music'
    ? {
        tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
        tessedit_char_whitelist: MUSIC_WHITELIST,
        preserve_interword_spaces: '0',
        user_defined_dpi: '300',
      }
    : {
        tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
        tessedit_char_whitelist: '',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      };
}

function abortError(): Error {
  return typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : new Error('Aborted');
}

/** Recognise one canvas with the parameters of `pass`; returns Tesseract's page data. */
export async function recognizeCanvas(canvas: HTMLCanvasElement, pass: EnginePass, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw abortError();
  const w = await getWorker(listener ?? undefined);
  const T = await loadModule();
  if (currentPass !== pass) {
    await w.setParameters(passParams(T, pass));
    currentPass = pass;
  }
  const job = w.recognize(canvas, {}, { blocks: true, text: true });
  if (!signal) return (await job).data;
  // Aborting kills the worker (Tesseract jobs cannot be cancelled); it is recreated on demand.
  return new Promise<unknown>((resolve, reject) => {
    const onAbort = () => {
      void terminateEngine();
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    job.then(
      (r) => {
        signal.removeEventListener('abort', onAbort);
        resolve(r.data);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Free the worker (memory); the next recognition starts a new one. */
export async function terminateEngine(): Promise<void> {
  const w = worker;
  const p = workerPromise;
  worker = null;
  workerPromise = null;
  currentPass = null;
  if (w) await w.terminate().catch(() => undefined);
  else if (p) await p.then((x) => x.terminate()).catch(() => undefined);
}
