import { describe, expect, it } from 'vitest';
import { deleteBackward, EditHistory, insertText, lineAt, moveCaret, rangeOf } from './textEdit';

const s = (text: string, start: number, end = start) => ({ text, start, end });

describe('text editing', () => {
  it('inserts at the caret and replaces a selection', () => {
    expect(insertText(s('S: | d', 6), ' :r')).toEqual(s('S: | d :r', 9));
    expect(insertText(s('d r', 1), ':')).toEqual(s('d: r', 2));
    expect(insertText(s('d x m', 2, 3), 'r')).toEqual(s('d r m', 3));
    expect(insertText(s('ab', 9), 'c')).toEqual(s('abc', 3));
  });

  it('deletes backward', () => {
    expect(deleteBackward(s('d :r', 4))).toEqual(s('d :', 3));
    expect(deleteBackward(s('d :r', 0))).toEqual(s('d :r', 0));
    expect(deleteBackward(s('d :r', 1, 3))).toEqual(s('dr', 1));
    expect(deleteBackward(s('a😀', 3))).toEqual(s('a', 1));
  });

  it('moves the caret within bounds', () => {
    expect(moveCaret(s('abc', 0), -1)).toEqual(s('abc', 0));
    expect(moveCaret(s('abc', 3), 1)).toEqual(s('abc', 3));
    expect(moveCaret(s('abc', 1), 1)).toEqual(s('abc', 2));
    expect(moveCaret(s('abc', 1, 3), -1)).toEqual(s('abc', 1));
  });

  it('maps lines and ranges', () => {
    const text = 'key: G\nS: | d :r |\nA: | m';
    expect(lineAt(text, 0)).toBe(0);
    expect(lineAt(text, 8)).toBe(1);
    expect(rangeOf(text, 1, 5, 6)).toEqual({ start: 12, end: 13 });
    expect(rangeOf(text, 2, 3, 99)).toEqual({ start: 22, end: 25 });
  });
});

describe('EditHistory', () => {
  it('undoes and redoes, merging fast typing', () => {
    const h = new EditHistory(100, 1000);
    const a = s('', 0);
    const b = s('d', 1);
    const c = s('d r', 3);
    h.record(a, 'type', 0);
    h.record(b, 'type', 100); // merged with the previous step
    expect(h.undo(c)).toEqual(a);
    expect(h.canUndo).toBe(false);
    expect(h.redo(a)).toEqual(c);
    expect(h.canRedo).toBe(false);
  });

  it('keeps separate steps for different kinds or slow edits, and clears redo on change', () => {
    const h = new EditHistory(100, 1000);
    h.record(s('', 0), 'type', 0);
    h.record(s('d', 1), 'delete', 50);
    h.record(s('x', 1), 'type', 5000);
    expect(h.undo(s('xy', 2))).toEqual(s('x', 1));
    expect(h.undo(s('x', 1))).toEqual(s('d', 1));
    h.record(s('d', 1), 'other', 6000);
    expect(h.canRedo).toBe(false);
  });

  it('respects the limit', () => {
    const h = new EditHistory(2, 0);
    for (let i = 0; i < 5; i++) h.record(s(String(i), 0), 'other', i * 10);
    expect(h.undo(s('5', 0))).toEqual(s('4', 0));
    expect(h.undo(s('4', 0))).toEqual(s('3', 0));
    expect(h.undo(s('3', 0))).toBeNull();
  });
});
