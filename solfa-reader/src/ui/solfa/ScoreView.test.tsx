// @vitest-environment jsdom
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoSong, rhythmSong } from '../fixtures';
import { ScoreGrid, type GridProps } from './ScoreGrid';
import { buildScoreModel } from './scoreModel';
import { ScoreView, type ScoreViewHandle } from './ScoreView';

afterEach(cleanup);

const current = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-current]')).map(
    (el) => `${el.dataset.voice}${el.dataset.beat}:${el.textContent}`,
  );

describe('ScoreView', () => {
  it('renders systems, voice rows, bar numbers and words', () => {
    const { container } = render(<ScoreView song={demoSong()} voiceNames={{ S: 'Soprano' }} />);
    expect(container.querySelectorAll('.sr-score__system')).toHaveLength(2);
    expect(container.querySelectorAll('.sr-score__cell')).toHaveLength(2 * 4 * 8);
    expect(screen.getByText('Ry To-mpo ô, de-ra-in-ay i-an-ao')).toBeTruthy();
    const first = container.querySelector('[data-beat="0"][data-voice="S"]');
    expect(first?.textContent).toBe('|m');
    expect(screen.getByRole('region', { name: 'Score' })).toBeTruthy();
  });

  it('highlights the beat column from the prop, flooring fractional beats', () => {
    const song = demoSong();
    const { container, rerender } = render(<ScoreView song={song} currentBeat={5.7} />);
    expect(current(container)).toEqual(['S5::f', 'A5::r', 'T5::l', 'B5::r,']);
    rerender(<ScoreView song={song} currentBeat={8} />);
    expect(current(container)).toEqual(["S8:|d'", 'A8:|m', 'T8:|s', 'B8:|d']);
    rerender(<ScoreView song={song} currentBeat={null} />);
    expect(current(container)).toEqual([]);
  });

  it('moves the highlight through the imperative handle without re-rendering', () => {
    const ref = createRef<ScoreViewHandle>();
    const { container } = render(<ScoreView ref={ref} song={demoSong()} />);
    const cell = container.querySelector('[data-beat="3"][data-voice="T"]');
    act(() => ref.current?.setCurrentBeat(3.2));
    expect(current(container)).toHaveLength(4);
    expect(cell?.hasAttribute('data-current')).toBe(true);
    act(() => ref.current?.setCurrentBeat(99));
    expect(current(container)).toEqual([]);
    // Same DOM nodes: highlighting never rebuilt the grid.
    expect(container.querySelector('[data-beat="3"][data-voice="T"]')).toBe(cell);
  });

  it('keeps the highlight when the loop changes the cells', () => {
    const song = demoSong();
    const { container, rerender } = render(<ScoreView song={song} currentBeat={4} />);
    rerender(<ScoreView song={song} currentBeat={4} loop={{ startBeat: 4, endBeat: 8 }} />);
    expect(current(container)).toHaveLength(4);
    expect(container.querySelectorAll('.sr-score__cell.is-loop')).toHaveLength(16);
  });

  it('reports taps on cells and bar numbers with bar and voice', () => {
    const onBeatClick = vi.fn();
    const { container } = render(
      <ScoreView song={rhythmSong()} onBeatClick={onBeatClick} barLabel={(n) => `Mesure ${n}`} />,
    );
    const cell = container.querySelector('[data-beat="2"][data-voice="A"] .sr-score__txt');
    if (!cell) throw new Error('cell missing');
    fireEvent.click(cell);
    expect(onBeatClick).toHaveBeenLastCalledWith(2, { voice: 'A', bar: 1, system: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Mesure 2' }));
    expect(onBeatClick).toHaveBeenLastCalledWith(4, { bar: 2, system: 0 });
  });

  it('labels key changes and marks the focused voice', () => {
    const { container } = render(
      <ScoreView song={rhythmSong()} highlightVoice="T" formatKey={(k) => `Do dia ${k.name}`} />,
    );
    expect(screen.getByText('Do dia G')).toBeTruthy();
    expect(container.querySelectorAll('.sr-score__row.is-focus')).toHaveLength(2);
  });
});

describe('ScoreGrid memoisation', () => {
  const base = (): GridProps => ({
    model: buildScoreModel(demoSong()),
    keyTexts: ['', ''],
    barTexts: ['Bar 0', 'Bar 1'],
    names: { S: 'S', A: 'A', T: 'T', B: 'B' },
    loopStart: -1,
    loopEnd: -1,
    highlightVoice: null,
    showBarNumbers: true,
    showWords: true,
    clickable: false,
    onCommit: () => undefined,
  });

  it('does not re-render for equal labels in new arrays, but does for a new loop', () => {
    const onCommit = vi.fn();
    const props = { ...base(), onCommit };
    const { rerender } = render(<ScoreGrid {...props} />);
    expect(onCommit).toHaveBeenCalledTimes(1);
    rerender(<ScoreGrid {...props} keyTexts={['', '']} barTexts={['Bar 0', 'Bar 1']} names={{ ...props.names }} />);
    expect(onCommit).toHaveBeenCalledTimes(1);
    rerender(<ScoreGrid {...props} loopStart={0} loopEnd={4} />);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });
});
