import { useEffect, useRef } from 'react';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import './Toast.css';

export type ToastTone = 'neutral' | 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  /** One short action, e.g. "Undo". */
  action?: ToastAction;
  /** Shows × and is called after `duration`. */
  onDismiss?: () => void;
  /** Accessible name of ×. Default "Dismiss". */
  dismissLabel?: string;
  /**
   * Auto-dismiss after this many ms (needs onDismiss). Default 5000, 8000 with an action,
   * 0 = stays until dismissed (use for errors the user must read).
   */
  duration?: number;
  className?: string;
}

const TONE_ICON: Record<ToastTone, IconName | null> = {
  neutral: null,
  success: 'check-circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

/** Short feedback message ("Saved", "Link copied"). Errors are announced assertively. */
export function Toast({
  message,
  tone = 'neutral',
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  duration,
  className,
}: ToastProps) {
  const ms = duration ?? (action ? 8000 : 5000);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });
  useEffect(() => {
    if (ms <= 0) return undefined;
    const timer = window.setTimeout(() => dismissRef.current?.(), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);

  const icon = TONE_ICON[tone];
  return (
    <div
      className={cx('sr-toast', `sr-toast--${tone}`, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {icon && <Icon name={icon} size={22} className="sr-toast__icon" />}
      <p className="sr-toast__message">{message}</p>
      {action && (
        <button
          type="button"
          className="sr-toast__action"
          onClick={() => {
            action.onClick();
            onDismiss?.();
          }}
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className="sr-toast__dismiss"
          aria-label={dismissLabel}
          title={dismissLabel}
          onClick={onDismiss}
        >
          <Icon name="close" size={20} />
        </button>
      )}
    </div>
  );
}

export interface ToastItem extends Omit<ToastProps, 'onDismiss' | 'className'> {
  id: string;
}

export interface ToastHostProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: string) => void;
  /** Accessible name of the region. Default "Notifications". */
  label?: string;
  dismissLabel?: string;
  className?: string;
}

/**
 * Fixed stack of toasts at the bottom. Always mounted so screen readers know the live region.
 * Lift it above a bottom bar with the CSS variable `--sr-toast-offset` (e.g. on the player).
 */
export function ToastHost({
  toasts,
  onDismiss,
  label = 'Notifications',
  dismissLabel,
  className,
}: ToastHostProps) {
  return (
    <section className={cx('sr-toasthost', className)} aria-label={label} aria-live="polite">
      {toasts.map(({ id, ...t }) => (
        <Toast key={id} {...t} dismissLabel={dismissLabel ?? t.dismissLabel} onDismiss={() => onDismiss(id)} />
      ))}
    </section>
  );
}
