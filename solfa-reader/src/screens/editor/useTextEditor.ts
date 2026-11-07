// Text + caret + undo/redo for a textarea/input driven by both the phone keyboard and the
// SolfaKeypad. The latest state lives in a ref so auto-repeating keys (⌫ held down) never act on
// a stale render.
import { useCallback, useLayoutEffect, useReducer, useRef, useState, type ChangeEvent, type RefObject, type SyntheticEvent } from 'react';
import type { KeypadAction } from '../../ui';
import { deleteBackward, EditHistory, insertText, moveCaret, normalize, type EditKind, type EditState } from '../../app/textEdit';

type Field = HTMLTextAreaElement | HTMLInputElement;

export interface TextEditor<E extends Field> {
  ref: RefObject<E | null>;
  text: string;
  canUndo: boolean;
  canRedo: boolean;
  /** Keypad text key. Returns the state after insertion. */
  insert: (s: string) => EditState;
  action: (a: KeypadAction) => void;
  /** Replace the whole text (undoable), e.g. "Tidy". */
  replaceAll: (text: string) => void;
  /** Load another text (clears undo history). */
  reset: (text: string) => void;
  /** Select a range and focus the field. */
  select: (start: number, end: number) => void;
  /** Current state (text + selection). */
  current: () => EditState;
  onChange: (e: ChangeEvent<E>) => void;
  onSelect: (e: SyntheticEvent<E>) => void;
}

/** State and handlers for one editable field. `multiline: false` ignores the ↵ key. */
export function useTextEditor<E extends Field>(initial: string, opts: { multiline?: boolean } = {}): TextEditor<E> {
  const multiline = opts.multiline ?? true;
  const ref = useRef<E>(null);
  const [text, setText] = useState(initial);
  const state = useRef<EditState>({ text: initial, start: initial.length, end: initial.length });
  const pendingSel = useRef<{ start: number; end: number } | null>({ start: initial.length, end: initial.length });
  const history = useRef(new EditHistory());
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useLayoutEffect(() => {
    const el = ref.current;
    const sel = pendingSel.current;
    if (!el || !sel) return;
    pendingSel.current = null;
    try {
      el.setSelectionRange(sel.start, sel.end);
      // Single-line inputs do not always follow the caret: keep the end of the line in view.
      if (el instanceof HTMLInputElement && sel.end >= el.value.length) el.scrollLeft = el.scrollWidth;
    } catch {
      // Detached element: ignore.
    }
  });

  const commit = useCallback((next: EditState, kind: EditKind | null) => {
    const before = state.current;
    if (kind !== null && next.text !== before.text) history.current.record(before, kind);
    state.current = normalize(next);
    pendingSel.current = { start: state.current.start, end: state.current.end };
    setText(state.current.text);
    rerender();
  }, []);

  const focus = () => {
    const el = ref.current;
    if (el && document.activeElement !== el) el.focus({ preventScroll: true });
  };

  const insert = useCallback(
    (s: string) => {
      focus();
      const next = insertText(state.current, s);
      commit(next, 'type');
      return next;
    },
    [commit],
  );

  const action = useCallback(
    (a: KeypadAction) => {
      focus();
      const cur = state.current;
      switch (a) {
        case 'backspace':
          commit(deleteBackward(cur), 'delete');
          break;
        case 'left':
          commit(moveCaret(cur, -1), null);
          break;
        case 'right':
          commit(moveCaret(cur, 1), null);
          break;
        case 'newline':
          if (multiline) commit(insertText(cur, '\n'), 'other');
          break;
        case 'undo': {
          const prev = history.current.undo(cur);
          if (prev) commit(prev, null);
          break;
        }
        case 'redo': {
          const next = history.current.redo(cur);
          if (next) commit(next, null);
          break;
        }
      }
    },
    [commit, multiline],
  );

  const replaceAll = useCallback(
    (t: string) => {
      const caret = Math.min(state.current.start, t.length);
      commit({ text: t, start: caret, end: caret }, 'other');
    },
    [commit],
  );

  const reset = useCallback((t: string) => {
    history.current.clear();
    state.current = { text: t, start: t.length, end: t.length };
    pendingSel.current = { start: t.length, end: t.length };
    setText(t);
    rerender();
  }, []);

  const select = useCallback(
    (start: number, end: number) => {
      const el = ref.current;
      commit({ ...state.current, start, end }, null);
      el?.focus({ preventScroll: true });
    },
    [commit],
  );

  const current = useCallback(() => state.current, []);

  const onChange = useCallback((e: ChangeEvent<E>) => {
    const el = e.currentTarget;
    const before = state.current;
    const value = el.value;
    const kind: EditKind = value.length < before.text.length ? 'delete' : 'type';
    history.current.record(before, kind);
    state.current = { text: value, start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length };
    setText(value);
    rerender();
  }, []);

  const onSelect = useCallback((e: SyntheticEvent<E>) => {
    const el = e.currentTarget;
    if (el.value !== state.current.text) return;
    state.current = { text: el.value, start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
  }, []);

  return {
    ref,
    text,
    canUndo: history.current.canUndo,
    canRedo: history.current.canRedo,
    insert,
    action,
    replaceAll,
    reset,
    select,
    current,
    onChange,
    onSelect,
  };
}
