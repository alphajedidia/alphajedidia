// Editor (I-04): sol-fa textarea + SolfaKeypad, live diagnostics (tap = select), note preview,
// undo/redo, Tidy (formatSolfa), autosave, Play.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { previewNote } from '../audio';
import { countProblems, sortDiagnostics } from '../app/diagnostics';
import { useDebounced } from '../app/hooks';
import { goBack, navigate } from '../app/navigation';
import { takeEditorDraft } from '../app/session';
import { useSettings } from '../app/settings';
import { keyAtLine, noteFromKeypad, readTitleHeader, voiceAtLine } from '../app/songText';
import { lineAt, lineStarts, rangeOf } from '../app/textEdit';
import { useToast } from '../app/toasts';
import { formatSolfa, noteToMidi, parseSolfa, type Diagnostic } from '../core';
import { useI18n } from '../i18n';
import { getSong, saveSong, type SongRecord } from '../storage';
import { Button, Chip, EmptyState, IconButton, SolfaKeypad, TopBar } from '../ui';
import { DiagnosticsPanel } from './editor/DiagnosticsPanel';
import { useKeypadLabels } from './editor/keypadLabels';
import { SolfaTextArea } from './editor/SolfaTextArea';
import { useTextEditor } from './editor/useTextEditor';
import './EditorScreen.css';

const AUTOSAVE_MS = 800;

function newSongText(title: string): string {
  return `title: ${title}\nkey: C\ntime: 4/4\ntempo: 90\n\nS: | `;
}

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; record: SongRecord | null; text: string };

/** `#/new` (id null) and `#/edit/:id`. Stays mounted when a new song gets its id. */
export default function EditorScreen({ id }: { id: string | null }) {
  const { t, tp } = useI18n();
  const toast = useToast();
  const { settings } = useSettings();
  const keypadLabels = useKeypadLabels();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [keypad, setKeypad] = useState(true);
  const editor = useTextEditor<HTMLTextAreaElement>('');
  const { current: currentState, reset } = editor;
  const record = useRef<SongRecord | null>(null);
  const savedText = useRef('');
  const ownId = useRef<string | null>(null);

  // Load the song (or start a new one). A new song that just got saved keeps its state.
  useEffect(() => {
    if (id !== null && id === ownId.current) return;
    let alive = true;
    if (id === null) {
      const text = takeEditorDraft() ?? newSongText(t('editor.newTitle'));
      record.current = null;
      savedText.current = text;
      reset(text);
      setLoad({ state: 'ready', record: null, text });
      return undefined;
    }
    setLoad({ state: 'loading' });
    getSong(id)
      .then((r) => {
        if (!alive) return;
        if (!r) {
          setLoad({ state: 'missing' });
          return;
        }
        record.current = r;
        ownId.current = r.id;
        savedText.current = r.text;
        reset(r.text);
        setLoad({ state: 'ready', record: r, text: r.text });
      })
      .catch(() => alive && setLoad({ state: 'missing' }));
    return () => {
      alive = false;
    };
    // Only a new id reloads: a language change must not throw away the text being typed.
  }, [id]);

  const text = editor.text;
  const parsedText = useDebounced(text, 250);
  const parsed = useMemo(() => parseSolfa(parsedText), [parsedText]);
  const diagnostics = useMemo(() => sortDiagnostics(parsed.diagnostics), [parsed]);
  const problems = countProblems(diagnostics);

  /** Save now if the text changed. Returns the record (new or existing). */
  const save = useCallback(async (): Promise<SongRecord | null> => {
    const current = currentState().text;
    const prev = record.current;
    if (prev && current === savedText.current) return prev;
    const title = readTitleHeader(current) ?? prev?.title ?? t('editor.newTitle');
    const next = await saveSong({ ...(prev ?? { source: 'typed' as const }), title, text: current });
    record.current = next;
    savedText.current = current;
    if (!prev) {
      ownId.current = next.id;
      navigate(`/edit/${encodeURIComponent(next.id)}`, { replace: true });
    }
    return next;
  }, [currentState, t]);

  // Autosave after a pause in typing (a new, untouched song is not saved).
  useEffect(() => {
    if (load.state !== 'ready' || text === savedText.current) return undefined;
    const timer = window.setTimeout(() => {
      save().catch(() => toast.show({ id: 'save-failed', message: t('editor.saveFailed'), tone: 'error' }));
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [text, load.state, save, t, toast]);

  // Leaving the screen: save what was typed since the last autosave.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () => () => {
      if (currentState().text !== savedText.current) void saveRef.current().catch(() => undefined);
    },
    [currentState],
  );

  const onKey = (key: string) => {
    const before = editor.current();
    editor.insert(key);
    const note = noteFromKeypad(key);
    if (!note) return;
    // Preview inside the tap handler (nothing awaited before): unlocks audio on phones.
    const line = lineAt(before.text, before.start);
    const starts = lineStarts(before.text);
    const rawLine = before.text.slice(starts[line] ?? 0, starts[line + 1] ?? before.text.length);
    const song = parsed.song;
    const voice = voiceAtLine(song, rawLine, line);
    void previewNote(noteToMidi(note, voice, keyAtLine(song, line)), settings.instrument);
  };

  const pick = (d: Diagnostic) => {
    const { start, end } = rangeOf(text, d.line, d.col, d.endCol);
    editor.select(start, end);
    const el = editor.ref.current;
    if (el) {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 32;
      el.scrollTop = Math.max(0, d.line * lh - el.clientHeight / 3);
    }
  };

  const tidy = () => {
    const tidied = formatSolfa(text);
    if (tidied !== text) editor.replaceAll(tidied);
    toast.show({ id: 'tidy', message: t('editor.tidied'), tone: 'success' });
  };

  const onSave = async () => {
    try {
      await save();
      toast.show({ id: 'saved', message: t('editor.saved'), tone: 'success' });
    } catch {
      toast.show({ id: 'save-failed', message: t('editor.saveFailed'), tone: 'error' });
    }
  };

  const onPlay = async () => {
    try {
      const r = await save();
      if (r) navigate(`/play/${encodeURIComponent(r.id)}`);
    } catch {
      toast.show({ id: 'save-failed', message: t('editor.saveFailed'), tone: 'error' });
    }
  };

  const title = readTitleHeader(text) ?? record.current?.title ?? t('editor.newTitle');

  if (load.state === 'missing') {
    return (
      <div className="sr-page" data-testid="screen-editor">
        <TopBar titleAs="h1" title={t('editor.notFoundTitle')} onBack={() => goBack()} backLabel={t('common.back')} />
        <main className="sr-container sr-page__body">
          <EmptyState
            tone="error"
            icon="warning"
            title={t('editor.notFoundTitle')}
            description={t('editor.notFoundDesc')}
            actions={
              <Button variant="primary" onClick={() => navigate('/', { replace: true })}>
                {t('common.goHome')}
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="sr-editor" data-testid="screen-editor">
      <TopBar
        title={title}
        onBack={() => goBack()}
        backLabel={t('common.back')}
        actions={
          <>
            <IconButton icon="check" label={t('editor.save')} onClick={() => void onSave()} data-testid="editor-save" />
            <IconButton icon="play" label={t('editor.play')} onClick={() => void onPlay()} data-testid="editor-play" />
          </>
        }
      />
      <div className="sr-editor__main">
        <SolfaTextArea
          value={text}
          diagnostics={diagnostics}
          label={t('editor.textLabel')}
          keypadOpen={keypad}
          onChange={editor.onChange}
          onSelect={editor.onSelect}
          textareaRef={editor.ref}
        />
        <div className="sr-editor__status">
          <Chip
            label={problems === 0 ? t('editor.noProblems') : tp('editor.problems', problems)}
            tone={problems === 0 ? 'success' : diagnostics.some((d) => d.severity === 'error') ? 'danger' : 'warning'}
            icon={problems === 0 ? 'check' : 'warning'}
          />
          <span className="sr-spacer" />
          {!keypad && (
            <>
              <IconButton icon="undo" label={t('editor.undo')} disabled={!editor.canUndo} onClick={() => editor.action('undo')} />
              <IconButton icon="redo" label={t('editor.redo')} disabled={!editor.canRedo} onClick={() => editor.action('redo')} />
            </>
          )}
          <Button variant="ghost" size="sm" icon="sparkle" onClick={tidy} data-testid="editor-tidy">
            {t('editor.tidy')}
          </Button>
          <IconButton
            icon={keypad ? 'keyboard' : 'music'}
            label={keypad ? t('editor.useKeyboard') : t('editor.useKeypad')}
            pressed={!keypad}
            onClick={() => {
              setKeypad((k) => !k);
              editor.ref.current?.focus();
            }}
            data-testid="editor-keyboard"
          />
        </div>
        <DiagnosticsPanel diagnostics={diagnostics} text={parsedText} onPick={pick} />
      </div>
      {keypad && (
        <SolfaKeypad
          className="sr-editor__keypad"
          onKey={onKey}
          onAction={editor.action}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          labels={keypadLabels}
        />
      )}
    </div>
  );
}
