import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { Spinner } from './Spinner';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /** primary = the one main action of a screen; danger = destructive. Default secondary. */
  variant?: ButtonVariant;
  /** Heights: sm 44px, md 48px, lg 56px (primary actions). Default md. */
  size?: ButtonSize;
  /** Icon before the label. */
  icon?: IconName;
  /** Icon after the label (e.g. chevron-right). */
  iconEnd?: IconName;
  /** Shows a spinner, sets aria-busy and blocks clicks; the label stays for context. */
  loading?: boolean;
  /** Full width. */
  block?: boolean;
  children?: ReactNode;
}

/** Text button with optional icon. Defaults to type="button" (never submits by accident). */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  loading = false,
  block = false,
  disabled,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'lg' ? 24 : 20;
  return (
    <button
      type={type}
      className={cx(
        'sr-btn',
        `sr-btn--${variant}`,
        `sr-btn--${size}`,
        block && 'sr-btn--block',
        loading && 'is-loading',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" className="sr-btn__spinner" />
      ) : icon ? (
        <Icon name={icon} size={iconSize} />
      ) : null}
      {children != null && <span className="sr-btn__label">{children}</span>}
      {iconEnd && !loading ? <Icon name={iconEnd} size={iconSize} /> : null}
    </button>
  );
}
