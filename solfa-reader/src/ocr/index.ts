// Public API of the OCR module. Load lazily: `const ocr = await import('../ocr')`.
import type { RecognitionResult, RecognizeOptions, Rect } from './types';

export * from './types';

/** Decode an image file (respecting EXIF orientation) into a canvas no larger than maxSide. A-01 */
export async function loadImageToCanvas(_file: Blob, _maxSide?: number): Promise<HTMLCanvasElement> {
  throw new Error('not implemented: loadImageToCanvas (A-01)');
}
/** Rotate by quarter turns (positive = clockwise). A-01 */
export function rotateCanvas(_canvas: HTMLCanvasElement, _quarterTurns: number): HTMLCanvasElement {
  throw new Error('not implemented: rotateCanvas (A-01)');
}
export function cropCanvas(_canvas: HTMLCanvasElement, _rect: Rect): HTMLCanvasElement {
  throw new Error('not implemented: cropCanvas (A-01)');
}
/** Detect and correct a small rotation (±15°). A-01 */
export function deskewCanvas(_canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; angle: number } {
  throw new Error('not implemented: deskewCanvas (A-01)');
}
/** Full pipeline: image → aligned .solfa text with uncertainty. A-08 */
export async function recognizeSolfa(
  _image: HTMLCanvasElement,
  _opts?: RecognizeOptions,
): Promise<RecognitionResult> {
  throw new Error('not implemented: recognizeSolfa (A-08)');
}
/** Free the OCR worker memory. A-02 */
export async function terminateOcr(): Promise<void> {
  throw new Error('not implemented: terminateOcr (A-02)');
}
