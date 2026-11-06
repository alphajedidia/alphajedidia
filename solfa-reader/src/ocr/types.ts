import type { VoiceId } from '../core';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type OcrStage = 'loading-engine' | 'preprocessing' | 'recognizing' | 'analyzing' | 'done';

export interface OcrProgress {
  stage: OcrStage;
  /** 0..1 inside the stage. */
  progress: number;
}

/** Where a line of the output text came from in the image. */
export interface OcrLineInfo {
  /** 0-based line index in RecognitionResult.text. */
  textLine: number;
  /** null for header / words lines. */
  voice: VoiceId | null;
  kind: 'voice' | 'words' | 'header';
  /** In the pixel space of the canvas given to recognizeSolfa. */
  bbox: Rect;
  /** 0..1 */
  confidence: number;
}

/** A part of the output text the user should check. */
export interface OcrUncertainSpan {
  textLine: number;
  col: number;
  endCol: number;
  /** 0..1 */
  confidence: number;
  /** Stable code, e.g. "low-confidence", "inserted-separator", "guessed-octave". */
  reason: string;
}

export interface RecognitionResult {
  /** Canonical, column-aligned .solfa text. */
  text: string;
  lines: OcrLineInfo[];
  uncertain: OcrUncertainSpan[];
  /** Overall 0..1. */
  confidence: number;
  /** Stable codes, e.g. "no-music-found", "low-resolution". */
  warnings: string[];
  durationMs: number;
  imageSize: { width: number; height: number };
}

export interface RecognizeOptions {
  onProgress?: (p: OcrProgress) => void;
  signal?: AbortSignal;
  /** Handwritten score: stronger cleaning, looser rules. */
  handwriting?: boolean;
}
