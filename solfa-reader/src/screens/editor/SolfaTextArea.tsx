// The sol-fa <textarea> with a mirror layer behind it that draws wavy underlines under the
// parts the parser complains about (sr-mark-error / sr-mark-warning). The mirror copies the
// text with transparent ink, so only the underlines show through the transparent textarea.
import { useMemo, useRef, type ChangeEvent, type Ref, type SyntheticEvent } from 'react';
import type { Diagnostic } from '../../core';
import { cx } from '../../ui';
import { rangeOf } from '../../app/textEdit';

export interface Mark {
  start: number;
  end: number;
  severity: 'error' | 'warning';
}

/** Underline ranges (text offsets) for the errors and warnings, merged where they overlap. */
export function marksFor(text: string, diagnostics: readonly Diagnostic[]): Mark[] {
  const raw: Mark[] = [];
  for (const d of diagnostics) {
    if (d.severity === 'info' || d.endCol <= d.col) continue;
    const { start, end } = rangeOf(text, d.line, d.col, d.endCol);
    if (end > start) raw.push({ start, end, severity: d.severity });
  }
  raw.sort((a, b) => a.start - b.start);
  const out: Mark[] = [];
  for (const m of raw) {
    const last = out[out.length - 1];
    if (last && m.start < last.end) {
      last.end = Math.max(last.end, m.end);
      if (m.severity === 'error') last.severity = 'error';
    } else out.push({ ...m });
  }
  return out;
}

export interface SolfaTextAreaProps {
  value: string;
  diagnostics: readonly Diagnostic[];
  label: string;
  keypadOpen: boolean;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSelect: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
  textareaRef: Ref<HTMLTextAreaElement>;
}

/** Monospace editor field: no autocorrect, no wrapping (voices stay in columns). */
export function SolfaTextArea({ value, diagnostics, label, keypadOpen, onChange, onSelect, textareaRef }: SolfaTextAreaProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const marks = useMemo(() => marksFor(value, diagnostics), [value, diagnostics]);
  const segments = useMemo(() => {
    const parts: Array<{ text: string; mark?: Mark['severity'] }> = [];
    let at = 0;
    for (const m of marks) {
      if (m.start > value.length) break;
      if (m.start > at) parts.push({ text: value.slice(at, m.start) });
      parts.push({ text: value.slice(m.start, Math.min(m.end, value.length)), mark: m.severity });
      at = Math.min(m.end, value.length);
    }
    parts.push({ text: `${value.slice(at)}\n ` });
    return parts;
  }, [marks, value]);

  const syncScroll = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const m = mirrorRef.current;
    if (!m) return;
    m.scrollTop = e.currentTarget.scrollTop;
    m.scrollLeft = e.currentTarget.scrollLeft;
  };

  return (
    <div className="sr-editor__field">
      <div ref={mirrorRef} className="sr-editor__mirror sr-solfa-text" aria-hidden="true">
        {segments.map((s, i) =>
          s.mark ? (
            <span key={i} className={cx(s.mark === 'error' ? 'sr-mark-error' : 'sr-mark-warning')}>
              {s.text}
            </span>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </div>
      <textarea
        ref={textareaRef}
        className="sr-editor__textarea sr-solfa-text"
        aria-label={label}
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        onScroll={syncScroll}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        inputMode={keypadOpen ? 'none' : 'text'}
        data-testid="editor-text"
      />
    </div>
  );
}
