import type { CSSProperties, ReactNode } from 'react';
import type { PlayerState } from '../../audio';
import { IconButton } from '../components/IconButton';
import { cx } from '../cx';
import './TransportBar.css';

export interface TransportLabels {
  region: string;
  play: string;
  pause: string;
  stop: string;
  rewind: string;
  loop: string;
}

export const DEFAULT_TRANSPORT_LABELS: TransportLabels = {
  region: 'Player controls',
  play: 'Play',
  pause: 'Pause',
  stop: 'Stop',
  rewind: 'Back to start',
  loop: 'Repeat the selected bars',
};

export interface TransportBarProps {
  state: PlayerState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind: () => void;
  /** Loop toggle (shown when onLoopChange is given). */
  loop?: boolean;
  onLoopChange?: (on: boolean) => void;
  /** Left text, e.g. "Bar 5 / 32" (already translated). */
  positionText?: string;
  /** Right text, e.g. "0:42 / 2:10". */
  timeText?: string;
  /** 0..1, drawn as a thin line on top. */
  progress?: number;
  /** While true, positionText is replaced by countInText ("Get ready… 3"). */
  countIn?: boolean;
  countInText?: string;
  /** Play pressed, audio not started yet (spinner on the play button). */
  busy?: boolean;
  disabled?: boolean;
  /** Extra control at the end, e.g. a tempo or mixer IconButton. */
  extra?: ReactNode;
  /** Stick to the bottom of the viewport. Default true. */
  sticky?: boolean;
  labels?: Partial<TransportLabels>;
  className?: string;
}

/** Bottom player bar: loop · back to start · PLAY/PAUSE · stop · extra, with position text. */
export function TransportBar({
  state,
  onPlay,
  onPause,
  onStop,
  onRewind,
  loop = false,
  onLoopChange,
  positionText,
  timeText,
  progress,
  countIn = false,
  countInText,
  busy = false,
  disabled = false,
  extra,
  sticky = true,
  labels: labelOverrides,
  className,
}: TransportBarProps) {
  const labels = { ...DEFAULT_TRANSPORT_LABELS, ...labelOverrides };
  const playing = state === 'playing';
  const style =
    progress != null
      ? ({ '--sr-progress': String(Math.min(1, Math.max(0, progress))) } as CSSProperties)
      : undefined;
  const left = countIn ? countInText : positionText;
  return (
    <div
      role="group"
      aria-label={labels.region}
      className={cx('sr-transport', sticky && 'sr-transport--sticky', className)}
    >
      {progress != null && (
        <div className="sr-transport__progress" aria-hidden="true">
          <div className="sr-transport__progressbar" style={style} />
        </div>
      )}
      <div className="sr-transport__inner">
        {(left != null || timeText != null) && (
          <div className="sr-transport__info">
            <span className={cx('sr-transport__pos', countIn && 'is-countin')}>{left}</span>
            <span className="sr-transport__time">{timeText}</span>
          </div>
        )}
        <div className="sr-transport__controls">
          {onLoopChange ? (
            <IconButton
              icon="loop"
              label={labels.loop}
              pressed={loop}
              disabled={disabled}
              onClick={() => onLoopChange(!loop)}
            />
          ) : (
            <span className="sr-transport__slot" />
          )}
          <IconButton icon="skip-back" label={labels.rewind} disabled={disabled} onClick={onRewind} />
          <IconButton
            icon={playing ? 'pause' : 'play'}
            label={playing ? labels.pause : labels.play}
            variant="primary"
            size="xl"
            loading={busy}
            disabled={disabled}
            onClick={playing ? onPause : onPlay}
            className="sr-transport__play"
          />
          <IconButton
            icon="stop"
            label={labels.stop}
            disabled={disabled || state === 'stopped'}
            onClick={onStop}
          />
          {extra ?? <span className="sr-transport__slot" />}
        </div>
      </div>
    </div>
  );
}
