import type { CSSProperties } from 'react';
import { cx } from '../cx';
import './ProgressBar.css';

export interface ProgressBarProps {
  /** Accessible name and visible caption, e.g. "Reading the photo…". */
  label: string;
  /** 0..1; omit for an indeterminate bar. */
  value?: number;
  /** Text on the right of the caption and aria-valuetext, e.g. "45 %" or "Step 2 of 3". */
  valueText?: string;
  /** Hide the caption row (label stays the accessible name). */
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Determinate or indeterminate progress. */
export function ProgressBar({
  label,
  value,
  valueText,
  hideLabel = false,
  size = 'md',
  className,
}: ProgressBarProps) {
  const indeterminate = value == null || Number.isNaN(value);
  const v = indeterminate ? 0 : Math.min(1, Math.max(0, value));
  const style = { '--sr-progress': String(v) } as CSSProperties;
  return (
    <div className={cx('sr-progress', `sr-progress--${size}`, indeterminate && 'is-indeterminate', className)}>
      {!hideLabel && (
        <div className="sr-progress__head">
          <span className="sr-progress__label">{label}</span>
          {valueText != null && <span className="sr-progress__value">{valueText}</span>}
        </div>
      )}
      <div
        className="sr-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : 100}
        aria-valuenow={indeterminate ? undefined : Math.round(v * 100)}
        aria-valuetext={valueText}
      >
        <div className="sr-progress__bar" style={style} />
      </div>
    </div>
  );
}
