// Public API of the OCR module. Load lazily: `const ocr = await import('../ocr')`.
// No top-level side effects: the Tesseract worker starts on the first recognizeSolfa call.
import type { RecognitionResult, RecognizeOptions } from './types';
import { terminateEngine } from './engine';
import { recognizeSolfaImpl } from './recognize';

export * from './types';
export { loadImageToCanvas, rotateCanvas, cropCanvas, deskewCanvas } from './image';

/** Full pipeline: image → aligned .solfa text with uncertainty. A-08 */
export async function recognizeSolfa(image: HTMLCanvasElement, opts?: RecognizeOptions): Promise<RecognitionResult> {
  return recognizeSolfaImpl(image, opts);
}

/** Free the OCR worker memory. A-02 */
export async function terminateOcr(): Promise<void> {
  await terminateEngine();
}
