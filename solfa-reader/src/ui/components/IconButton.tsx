import type { ComponentPropsWithRef } from 'react';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { Spinner } from './Spinner';
import './IconButton.css';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconName;
  /** Required accessible name (also shown as a tooltip on desktop). */
  label: string;
  /** Default ghost. */
  variant?: 'ghost' | 'secondary' | 'primary' | 'danger';
  /** md = 44px, lg = 52px, xl = 56px (main play button). */
  size?: 'md' | 'lg' | 'xl';
  /** Toggle buttons: sets aria-pressed and the "on" style. */
  pressed?: boolean;
  loading?: boolean;
  /** Hide the native tooltip (e.g. when a visible label is next to it). */
  noTooltip?: boolean;
}

/** Square/round button with only an icon; `label` gives it its accessible name. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  pressed,
  loading = false,
  noTooltip = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const iconSize = size === 'md' ? 22 : 26;
  return (
    <button
      type={type}
      className={cx(
        'sr-iconbtn',
        `sr-iconbtn--${variant}`,
        `sr-iconbtn--${size}`,
        pressed && 'is-pressed',
        className,
      )}
      aria-label={label}
      title={noTooltip ? undefined : label}
      aria-pressed={pressed}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : <Icon name={icon} size={iconSize} />}
    </button>
  );
}
