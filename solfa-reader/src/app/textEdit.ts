// Pure text editing for the sol-fa editor (I-04): keypad insertion at the caret, keypad actions
// and an undo/redo history. No DOM: the screen copies the textarea selection in and out.

/** Text plus selection (start ≤ end; start === end is a caret). */
export interface EditState {
  text: string;
  start: number;
  end: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Normalise a selection to the text bounds. */
export function normalize(s: EditState): EditState {
  const a = clamp(Math.min(s.start, s.end), 0, s.text.length);
  const b = clamp(Math.max(s.start, s.end), 0, s.text.length);
  return { text: s.text, start: a, end: b };
}

/** Insert (or replace the selection with) `insert`; the caret goes after it. */
export function insertText(state: EditState, insert: string): EditState {
  const s = normalize(state);
  const text = s.text.slice(0, s.start) + insert + s.text.slice(s.end);
  const caret = s.start + insert.length;
  return { text, start: caret, end: caret };
}

/** Delete the selection, or the character before the caret (a surrogate pair counts as one). */
export function deleteBackward(state: EditState): EditState {
  const s = normalize(state);
  if (s.start !== s.end) return { text: s.text.slice(0, s.start) + s.text.slice(s.end), start: s.start, end: s.start };
  if (s.start === 0) return s;
  const code = s.text.charCodeAt(s.start - 1);
  const width = code >= 0xdc00 && code <= 0xdfff && s.start >= 2 ? 2 : 1;
  const at = s.start - width;
  return { text: s.text.slice(0, at) + s.text.slice(s.start), start: at, end: at };
}

/** Move the caret by `delta` characters (a selection collapses to its edge first). */
export function moveCaret(state: EditState, delta: -1 | 1): EditState {
  const s = normalize(state);
  if (s.start !== s.end) {
    const at = delta < 0 ? s.start : s.end;
    return { text: s.text, start: at, end: at };
  }
  const at = clamp(s.start + delta, 0, s.text.length);
  return { text: s.text, start: at, end: at };
}

/** Index of the line that contains `offset` (0-based). */
export function lineAt(text: string, offset: number): number {
  let line = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Offset of the start of each line. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

/** Text offsets of a (line, col) range, clamped to the line. */
export function rangeOf(text: string, line: number, col: number, endCol: number): { start: number; end: number } {
  const starts = lineStarts(text);
  const ls = starts[clamp(line, 0, starts.length - 1)] ?? 0;
  const next = starts[line + 1];
  const le = next === undefined ? text.length : next - 1;
  const start = clamp(ls + col, ls, le);
  const end = clamp(ls + Math.max(col, endCol), start, le);
  return { start, end };
}

export type EditKind = 'type' | 'delete' | 'other';

interface Entry {
  state: EditState;
  kind: EditKind;
  at: number;
}

/**
 * Undo/redo stack. `record(before, after, kind)` is called for every change; consecutive
 * changes of the same kind (typing, deleting) within `mergeMs` become one undo step, like a
 * word processor.
 */
export class EditHistory {
  private past: Entry[] = [];
  private future: EditState[] = [];
  private lastKind: EditKind | null = null;
  private lastAt = 0;

  constructor(
    private readonly limit = 200,
    private readonly mergeMs = 1200,
  ) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Remember `before` so the change to a new text can be undone. */
  record(before: EditState, kind: EditKind = 'other', now: number = Date.now()): void {
    this.future = [];
    const merge = kind !== 'other' && kind === this.lastKind && now - this.lastAt <= this.mergeMs && this.past.length > 0;
    this.lastKind = kind;
    this.lastAt = now;
    if (merge) return;
    this.past.push({ state: before, kind, at: now });
    if (this.past.length > this.limit) this.past.shift();
  }

  /** State to go back to (null = nothing to undo). `current` becomes redoable. */
  undo(current: EditState): EditState | null {
    const entry = this.past.pop();
    if (!entry) return null;
    this.future.push(current);
    this.lastKind = null;
    return entry.state;
  }

  /** State to go forward to (null = nothing to redo). */
  redo(current: EditState): EditState | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push({ state: current, kind: 'other', at: Date.now() });
    this.lastKind = null;
    return next;
  }

  /** Forget everything (e.g. another song loaded). */
  clear(): void {
    this.past = [];
    this.future = [];
    this.lastKind = null;
  }
}
