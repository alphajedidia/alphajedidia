// Parser diagnostics → plain-language, translated messages (FR-14). The parser gives a stable
// `code` and an English `message`; counts for the mismatch codes are read from that message.
import type { Diagnostic, Severity } from '../core';
import { isMessageKey, type MessageKey, type Messages, type TFunction } from '../i18n';
import { lineStarts } from './textEdit';

/** Every code of SOLFA_FORMAT §8 (the i18n test checks each has a translation). */
export const DIAGNOSTIC_CODES = [
  'unknown-char',
  'bad-note',
  'bad-division',
  'comma-as-division',
  'beat-count-mismatch',
  'bar-count-mismatch',
  'hold-without-note',
  'unknown-voice',
  'bad-key',
  'bad-tempo',
  'bad-time',
  'empty-song',
  'internal-error',
] as const;

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** Errors first, then warnings, then info; inside a group in text order. */
export function sortDiagnostics(list: readonly Diagnostic[]): Diagnostic[] {
  return [...list].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.line - b.line || a.col - b.col,
  );
}

/** Errors and warnings ("problems"); info diagnostics are hints, not problems. */
export function countProblems(list: readonly Diagnostic[]): number {
  return list.filter((d) => d.severity !== 'info').length;
}

/** The source text a diagnostic points at. */
export function diagnosticSource(text: string, d: Diagnostic): string {
  const starts = lineStarts(text);
  const ls = starts[d.line];
  if (ls === undefined) return '';
  const next = starts[d.line + 1];
  const lineText = text.slice(ls, next === undefined ? text.length : next - 1);
  return lineText.slice(d.col, Math.max(d.col, d.endCol)).trim();
}

/** "3 beats instead of 4" / "3 bars instead of 4" → [3, 4]. */
export function mismatchCounts(message: string): [number, number] | null {
  const m = /(\d+)\s+\w+\s+instead of\s+(\d+)/.exec(message);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export interface DiagnosticText {
  /** What is wrong, in the user's language. */
  message: string;
  /** Where: "Line 7 · bar 3" (1-based line numbers for people). */
  where: string;
}

/** Translate one diagnostic. */
export function describeDiagnostic(d: Diagnostic, text: string, t: TFunction, messages: Messages): DiagnosticText {
  const voice = d.voice ? t(`voice.${d.voice}` as MessageKey) : t('diag.aVoice');
  let message: string;
  if (d.code === 'beat-count-mismatch' || d.code === 'bar-count-mismatch') {
    const counts = mismatchCounts(d.message);
    message = counts
      ? t(`diag.${d.code}`, { voice, count: counts[0], expected: counts[1] })
      : t(`diag.${d.code}.generic`, { voice });
  } else {
    const key = `diag.${d.code}`;
    message = isMessageKey(messages, key)
      ? t(key, { text: diagnosticSource(text, d), voice })
      : t('diag.unknown', { message: d.message });
  }
  const where =
    d.code === 'empty-song' || d.code === 'internal-error'
      ? ''
      : d.bar !== undefined
        ? t('editor.whereBar', { line: d.line + 1, bar: d.bar })
        : t('editor.whereLine', { line: d.line + 1 });
  return { message, where };
}
