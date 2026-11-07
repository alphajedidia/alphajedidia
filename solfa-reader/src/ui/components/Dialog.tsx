import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { useModalDialog } from './useModalDialog';
import './Dialog.css';

export interface DialogProps {
  open: boolean;
  /** Called on Esc, Android back and backdrop tap (not for alerts' backdrop). */
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, the main one last (it ends up on the right / at the bottom). */
  actions?: ReactNode;
  /** danger = destructive confirmation (red icon). */
  tone?: 'default' | 'danger';
  icon?: IconName;
  /** role="alertdialog" for confirmations that need an answer; backdrop tap does nothing. */
  alert?: boolean;
  className?: string;
}

/** Centered modal for confirmations ("Delete this song?") and short forms (rename). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  tone = 'default',
  icon,
  alert = false,
  className,
}: DialogProps) {
  const id = useId();
  const titleId = `sr-dialog-${id}-t`;
  const descId = description != null ? `sr-dialog-${id}-d` : undefined;
  const { ref, dialogProps } = useModalDialog(open, onClose);
  const props = alert ? { ...dialogProps, onClick: undefined } : dialogProps;
  return (
    <dialog
      ref={ref}
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={cx('sr-dialog', `sr-dialog--${tone}`, className)}
      {...props}
    >
      {open && (
        <div className="sr-dialog__panel">
          {icon && (
            <span className="sr-dialog__icon">
              <Icon name={icon} size={28} />
            </span>
          )}
          <h2 id={titleId} className="sr-dialog__title">
            {title}
          </h2>
          {description != null && (
            <p id={descId} className="sr-dialog__desc">
              {description}
            </p>
          )}
          {children}
          {actions != null && <div className="sr-dialog__actions">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}
