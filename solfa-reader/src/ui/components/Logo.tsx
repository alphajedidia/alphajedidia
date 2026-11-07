import { cx } from '../cx';

export interface LogoProps {
  /** CSS size (number = px). Default 40. */
  size?: number | string;
  /** Accessible name; omit when the app name is written next to it. */
  title?: string;
  className?: string;
}

/**
 * The Solfa Reader mark: a gold system brace holding four voice lines (S, A, T, B) split into
 * beats — "a page of sol-fa that sings". Same artwork as public/icons/icon.svg.
 */
export function Logo({ size = 40, title, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cx('sr-logo', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <rect width="512" height="512" rx="112" fill="var(--sr-logo-bg)" />
      <LogoMark />
    </svg>
  );
}

/** The mark without background, in a 512 box (shared with the icon generator). */
export function LogoMark() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M184 132c-26 0-34 14-34 40v40c0 22-10 36-30 44 20 8 30 22 30 44v40c0 26 8 40 34 40"
        stroke="var(--sr-logo-gold)"
        strokeWidth="22"
      />
      <path d="M214 176h56M298 176h86" stroke="var(--sr-logo-s)" strokeWidth="30" />
      <path d="M214 232h24M266 232h52M346 232h38" stroke="var(--sr-logo-a)" strokeWidth="30" />
      <path d="M214 288h86M328 288h56" stroke="var(--sr-logo-t)" strokeWidth="30" />
      <path d="M214 344h38M280 344h104" stroke="var(--sr-logo-b)" strokeWidth="30" />
    </g>
  );
}
