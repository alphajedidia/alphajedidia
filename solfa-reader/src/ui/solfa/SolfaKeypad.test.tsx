// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SolfaKeypad } from './SolfaKeypad';

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof SolfaKeypad>[0]> = {}) {
  const onKey = vi.fn();
  const onAction = vi.fn();
  render(<SolfaKeypad onKey={onKey} onAction={onAction} {...props} />);
  return { onKey, onAction };
}

const key = (name: string) => screen.getByRole('button', { name });

describe('SolfaKeypad', () => {
  it('emits the seven notes', () => {
    const { onKey } = setup();
    for (const n of ['d', 'r', 'm', 'f', 's', 'l', 't']) fireEvent.click(key(n));
    expect(onKey.mock.calls.map((c) => c[0])).toEqual(['d', 'r', 'm', 'f', 's', 'l', 't']);
  });

  it('emits marks and separators with readable names', () => {
    const { onKey } = setup();
    fireEvent.click(key("Octave up (')"));
    fireEvent.click(key('Comma: octave down or quarter beat'));
    fireEvent.click(key('Dot: half beat'));
    fireEvent.click(key('Hold (-)'));
    fireEvent.click(key('Beat separator (:)'));
    fireEvent.click(key('Bar line (|)'));
    fireEvent.click(key('Middle of bar (!)'));
    fireEvent.click(key('Double bar (||)'));
    fireEvent.click(key('Space'));
    expect(onKey.mock.calls.map((c) => c[0])).toEqual(["'", ',', '.', '-', ':', '|', '!', '||', ' ']);
  });

  it('emits voice labels from the tools row', () => {
    const { onKey } = setup({ labels: { voiceLine: (v) => `Line ${v}` } });
    fireEvent.click(key('Line A'));
    expect(onKey).toHaveBeenCalledWith('A: ');
  });

  it('emits actions and respects canUndo/canRedo', () => {
    const { onAction } = setup({ canRedo: false });
    fireEvent.click(key('Undo'));
    fireEvent.click(key('New line'));
    fireEvent.click(key('Delete'));
    fireEvent.click(key('Move left'));
    fireEvent.click(key('Move right'));
    expect(key('Redo')).toHaveProperty('disabled', true);
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['undo', 'newline', 'backspace', 'left', 'right']);
  });

  it('chromatic key is a one-shot shift with Curwen spellings', () => {
    const { onKey } = setup();
    const toggle = key('Sharps and flats');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'd' })).toBeNull();
    fireEvent.click(key('fe'));
    expect(onKey).toHaveBeenLastCalledWith('fe');
    // Back to the diatonic layout after one chromatic note.
    expect(key('Sharps and flats').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(key('Sharps and flats'));
    fireEvent.click(key('ta'));
    expect(onKey).toHaveBeenLastCalledWith('ta');
  });

  it('never steals focus from the text field (mousedown is prevented)', () => {
    setup();
    const notPrevented = fireEvent.mouseDown(key('d'));
    expect(notPrevented).toBe(false);
  });

  it('fires repeating keys once per pointer press and repeats while held', () => {
    vi.useFakeTimers();
    try {
      const { onAction } = setup();
      const del = key('Delete');
      fireEvent.pointerDown(del, { button: 0 });
      fireEvent.pointerUp(del);
      fireEvent.click(del, { detail: 1 });
      expect(onAction).toHaveBeenCalledTimes(1);

      fireEvent.pointerDown(del, { button: 0 });
      act(() => {
        vi.advanceTimersByTime(450 + 70 * 3);
      });
      fireEvent.pointerUp(del);
      expect(onAction).toHaveBeenCalledTimes(1 + 1 + 3);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onAction).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('can hide the tools row', () => {
    setup({ showToolsRow: false });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Sol-fa keypad' })).toBeTruthy();
  });
});
