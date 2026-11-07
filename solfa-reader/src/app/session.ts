// In-memory hand-over between screens: the scan flow keeps its canvases here between the
// capture → crop → read → review routes (so the browser back button works), and the help page
// can open the editor with an example text. Nothing here is persisted.
import type { RecognitionResult } from '../ocr';
import { releaseCanvas } from './crop';

export interface ScanSession {
  /** Photo as loaded (EXIF-oriented), after the user's 90° rotations. */
  photo: HTMLCanvasElement | null;
  /** Cropped (and straightened) canvas given to the reader; OCR boxes are in its pixels. */
  work: HTMLCanvasElement | null;
  result: RecognitionResult | null;
  /** The review text being corrected (kept when the user leaves and comes back). */
  text: string | null;
  /** The song saved from this scan, so Save then Play does not create two songs. */
  savedId: string | null;
  /** True once the OCR module was imported (so leaving the flow can free its worker). */
  ocrLoaded: boolean;
}

const empty = (): ScanSession => ({ photo: null, work: null, result: null, text: null, savedId: null, ocrLoaded: false });

let session: ScanSession = empty();

/** The current scan session (mutable on purpose: canvases are large, never copied). */
export function scanSession(): ScanSession {
  return session;
}

/** Free the photo and the straightened copy now (photos decode up to 4000 px ≈ 64 MB). */
export function releaseScanImages(): void {
  if (session.work !== session.photo) releaseCanvas(session.work);
  releaseCanvas(session.photo);
  session.photo = null;
  session.work = null;
}

/** Forget the photo and result (memory) — and free the OCR worker if it was started. */
export function clearScanSession(): void {
  const wasLoaded = session.ocrLoaded;
  releaseScanImages();
  session = empty();
  if (wasLoaded) {
    import('../ocr')
      .then((ocr) => ocr.terminateOcr())
      .catch(() => undefined);
  }
}

let draft: string | null = null;

/** Text the next new-song editor should start with (help → "Try it in the editor"). */
export function setEditorDraft(text: string): void {
  draft = text;
}

/** Take (and clear) the draft. */
export function takeEditorDraft(): string | null {
  const d = draft;
  draft = null;
  return d;
}
