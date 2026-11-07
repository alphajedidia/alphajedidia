// One recognised line in the review: the photo strip it came from, then the text with the
// uncertain characters highlighted; in edit mode an input driven by the SolfaKeypad.
import { useEffect, useMemo, type ReactNode } from 'react';
import { previewNote, type InstrumentId } from '../../audio';
import type { KeySignature, VoiceId } from '../../core';
import { noteToMidi } from '../../core';
import { noteFromKeypad } from '../../app/songText';
import { useT, type MessageKey } from '../../i18n';
import type { OcrLineInfo, OcrUncertainSpan } from '../../ocr';
import { Button, PhotoStrip, SolfaKeypad, VoiceBadge } from '../../ui';
import { useKeypadLabels } from '../editor/keypadLabels';
import { useTextEditor } from '../editor/useTextEditor';

/** Split a line into plain and uncertain segments (spans merged, clipped to the text). */
export function highlightSegments(text: string, spans: readonly OcrUncertainSpan[]): Array<{ text: string; reason?: string }> {
  const sorted = [...spans].filter((s) => s.col < text.length && s.endCol > s.col).sort((a, b) => a.col - b.col);
  const out: Array<{ text: string; reason?: string }> = [];
  let at = 0;
  for (const s of sorted) {
    const start = Math.max(s.col, at);
    const end = Math.min(s.endCol, text.length);
    if (end <= start) continue;
    if (start > at) out.push({ text: text.slice(at, start) });
    out.push({ text: text.slice(start, end), reason: s.reason });
    at = end;
  }
  if (at < text.length || out.length === 0) out.push({ text: text.slice(at) });
  return out;
}

export interface ReviewLineProps {
  index: number;
  text: string;
  info: OcrLineInfo | undefined;
  spans: readonly OcrUncertainSpan[];
  image: HTMLCanvasElement;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onChange: (text: string) => void;
  reasonText: (reason: string) => string;
  keyAt: KeySignature;
  instrument: InstrumentId;
}

function lineName(t: ReturnType<typeof useT>, info: OcrLineInfo | undefined, index: number): string {
  if (info?.voice) return t(`voice.${info.voice}` as MessageKey);
  if (info?.kind === 'words') return t('review.words');
  if (info?.kind === 'header') return t('review.header');
  return t('review.line', { line: index + 1 });
}

function LineEditor({ text, onChange, onDone, voice, keyAt, instrument, label }: {
  text: string;
  onChange: (t: string) => void;
  onDone: () => void;
  voice: VoiceId;
  keyAt: KeySignature;
  instrument: InstrumentId;
  label: string;
}) {
  const t = useT();
  const labels = useKeypadLabels();
  const editor = useTextEditor<HTMLInputElement>(text, { multiline: false });
  useEffect(() => {
    if (editor.text !== text) onChange(editor.text);
  }, [editor.text, text, onChange]);
  useEffect(() => editor.ref.current?.focus({ preventScroll: true }), [editor.ref]);
  return (
    <div className="sr-review__edit">
      <div className="sr-review__editrow">
        <input
          ref={editor.ref}
          className="sr-review__input sr-solfa-text"
          aria-label={label}
          value={editor.text}
          onChange={editor.onChange}
          onSelect={editor.onSelect}
          inputMode="none"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          onKeyDown={(e) => e.key === 'Enter' && onDone()}
        />
        <Button size="sm" variant="primary" icon="check" onClick={onDone}>
          {t('review.lineDone')}
        </Button>
      </div>
      <SolfaKeypad
        className="sr-review__keypad"
        labels={labels}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onAction={(a) => (a === 'newline' ? onDone() : editor.action(a))}
        onKey={(k) => {
          editor.insert(k);
          const note = noteFromKeypad(k);
          if (note) void previewNote(noteToMidi(note, voice, keyAt), instrument);
        }}
      />
    </div>
  );
}

/** A block of the review screen. */
export function ReviewLine(props: ReviewLineProps) {
  const { index, text, info, spans, image, editing, onEdit, onDone, onChange, reasonText, keyAt, instrument } = props;
  const t = useT();
  const name = lineName(t, info, index);
  const segments = useMemo(() => highlightSegments(text, spans), [text, spans]);
  let shown: ReactNode = segments.map((s, i) =>
    s.reason ? (
      <mark key={i} className="sr-uncertain" title={reasonText(s.reason)}>
        {s.text}
      </mark>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  );
  if (text.trim() === '') shown = ' ';
  return (
    <div className="sr-review__line" data-testid="review-line">
      {info && info.bbox.w > 0 && info.bbox.h > 0 && (
        <PhotoStrip
          image={image}
          bbox={info.bbox}
          voice={info.voice ?? undefined}
          alt={t('review.photoOf', { what: name })}
          zoomInLabel={t('common.zoomIn')}
          zoomOutLabel={t('common.zoomOut')}
        />
      )}
      {editing ? (
        <LineEditor
          text={text}
          onChange={onChange}
          onDone={onDone}
          voice={info?.voice ?? 'S'}
          keyAt={keyAt}
          instrument={instrument}
          label={t('review.lineLabel', { what: name })}
        />
      ) : (
        <button type="button" className="sr-review__text" onClick={onEdit} aria-label={t('review.editLine', { what: name })}>
          {info?.voice && <VoiceBadge voice={info.voice} name={name} size="sm" />}
          <span className="sr-solfa-text sr-review__solfa">{shown}</span>
        </button>
      )}
    </div>
  );
}
