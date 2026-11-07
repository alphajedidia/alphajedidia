import { memo, useLayoutEffect, type CSSProperties } from 'react';
import type { VoiceId } from '../../core';
import { cx } from '../cx';
import { voiceClass } from '../voices';
import type { ScoreSystemModel } from './scoreModel';

export interface GridProps {
  model: ScoreSystemModel[];
  /** Per system: key-change label or ''. */
  keyTexts: string[];
  /** Accessible names of bar numbers, indexed by bar number. */
  barTexts: string[];
  names: Record<VoiceId, string>;
  loopStart: number;
  loopEnd: number;
  highlightVoice: VoiceId | null;
  showBarNumbers: boolean;
  showWords: boolean;
  clickable: boolean;
  /** Stable callback run after every commit of the grid. */
  onCommit: () => void;
}

function sameArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameProps(a: GridProps, b: GridProps): boolean {
  return (
    a.model === b.model &&
    sameArray(a.keyTexts, b.keyTexts) &&
    sameArray(a.barTexts, b.barTexts) &&
    a.names.S === b.names.S &&
    a.names.A === b.names.A &&
    a.names.T === b.names.T &&
    a.names.B === b.names.B &&
    a.loopStart === b.loopStart &&
    a.loopEnd === b.loopEnd &&
    a.highlightVoice === b.highlightVoice &&
    a.showBarNumbers === b.showBarNumbers &&
    a.showWords === b.showWords &&
    a.clickable === b.clickable &&
    a.onCommit === b.onCommit
  );
}

/** The static part of ScoreView. Re-renders only when what it draws changes. */
export const ScoreGrid = memo(function ScoreGrid({
  model,
  keyTexts,
  barTexts,
  names,
  loopStart,
  loopEnd,
  highlightVoice,
  showBarNumbers,
  showWords,
  clickable,
  onCommit,
}: GridProps) {
  useLayoutEffect(() => {
    onCommit();
  });
  const inLoop = (beat: number) => loopStart >= 0 && beat >= loopStart && beat < loopEnd;
  return (
    <>
      {model.map((sys, s) => {
        const style = { '--sr-score-cols': String(sys.beatCount) } as CSSProperties;
        const keyText = keyTexts[s];
        return (
          <section key={sys.index} className="sr-score__system" data-system={sys.index}>
            {keyText ? <p className="sr-score__key">{keyText}</p> : null}
            <div className="sr-score__scroll">
              <div className="sr-score__grid" style={style}>
                {showBarNumbers && (
                  <div className="sr-score__row sr-score__row--bars">
                    <span className="sr-score__label" aria-hidden="true" />
                    {sys.barAt.map((_, col) => {
                      const mark = sys.bars.find((b) => b.col === col);
                      const loopClass = inLoop(sys.startBeat + col) && 'is-loop';
                      if (!mark) return <span key={col} className={cx('sr-score__barno', loopClass)} />;
                      return clickable ? (
                        <button
                          key={col}
                          type="button"
                          className={cx('sr-score__barno', loopClass)}
                          data-beat={mark.beat}
                          aria-label={barTexts[mark.bar]}
                        >
                          {mark.bar}
                        </button>
                      ) : (
                        <span key={col} className={cx('sr-score__barno', loopClass)} aria-hidden="true">
                          {mark.bar}
                        </span>
                      );
                    })}
                    <span />
                  </div>
                )}
                {sys.rows.map((row) => (
                  <div
                    key={row.voice}
                    className={cx(
                      'sr-score__row',
                      voiceClass(row.voice),
                      highlightVoice === row.voice && 'is-focus',
                    )}
                  >
                    <span className="sr-score__label">
                      <span aria-hidden="true">{row.voice}</span>
                      <span className="sr-visually-hidden">{names[row.voice]}</span>
                    </span>
                    {row.cells.map((cell) => {
                      const loop = inLoop(cell.beat);
                      return (
                        <span
                          key={cell.beat}
                          className={cx('sr-score__cell', loop && 'is-loop')}
                          data-beat={cell.beat}
                          data-voice={row.voice}
                        >
                          <span className={cx('sr-score__sep', cell.sep === '|' && 'is-bar')}>
                            {cell.sep}
                          </span>
                          <span className="sr-score__txt">{cell.text}</span>
                        </span>
                      );
                    })}
                    <span className="sr-score__sep sr-score__end is-bar">{sys.endSep}</span>
                  </div>
                ))}
                {showWords &&
                  sys.words.map((w, i) => (
                    <p key={i} className="sr-score__words">
                      {w}
                    </p>
                  ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}, sameProps);
