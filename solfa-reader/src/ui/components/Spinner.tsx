import { cx } from '../cx';
import './Spinner.css';

export interface SpinnerProps {
  /** sm = 16px, md = 24px, lg = 40px. */
  size?: 'sm' | 'md' | 'lg';
  /** Screen-reader text ("Loading…"). Without it the spinner is decorative. */
  label?: string;
  className?: string;
}

/** Indeterminate activity indicator; inherits the text colour. */
export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span
      className={cx('sr-spinner', `sr-spinner--${size}`, className)}
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 24 24" className="sr-spinner__svg" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" className="sr-spinner__track" />
        <circle cx="12" cy="12" r="9" className="sr-spinner__arc" />
      </svg>
      {label ? <span className="sr-visually-hidden">{label}</span> : null}
    </span>
  );
}
