import type { SVGProps } from 'react';
import { cx } from '../cx';
import { ICON_PATHS } from './paths';

/** Every icon of the set. */
export type IconName = keyof typeof ICON_PATHS;

/** All icon names (for galleries and tests). */
export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children'> {
  name: IconName;
  /** CSS size (number = px). Default 24. */
  size?: number | string;
  /**
   * Accessible name. Without it the icon is decorative (`aria-hidden`), which is right when
   * it sits next to visible text or inside a labelled button.
   */
  title?: string;
}

/** Inline SVG icon (no network request, inherits `currentColor`). */
export function Icon({ name, size = 24, title, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      className={cx('sr-icon', className)}
      {...rest}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
