import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import { IconButton } from './IconButton';
import { useModalDialog } from './useModalDialog';
import './Sheet.css';

export interface SheetProps {
  open: boolean;
  /** Called on ×, Esc, Android back and backdrop tap. */
  onClose: () => void;
  title: string;
  /** Hide the title row visually (still names the sheet). */
  hideTitle?: boolean;
  children?: ReactNode;
  /** Sticky footer for the main action(s). */
  footer?: ReactNode;
  /** Accessible name of ×. Default "Close". */
  closeLabel?: string;
  className?: string;
}

/** Bottom sheet (modal): mixer, song actions, export options… Content renders only while open. */
export function Sheet({
  open,
  onClose,
  title,
  hideTitle = false,
  children,
  footer,
  closeLabel = 'Close',
  className,
}: SheetProps) {
  const titleId = `sr-sheet-${useId()}`;
  const { ref, dialogProps } = useModalDialog(open, onClose);
  return (
    <dialog ref={ref} className={cx('sr-sheet', className)} aria-labelledby={titleId} {...dialogProps}>
      {open && (
        <div className="sr-sheet__panel">
          <div className="sr-sheet__handle" aria-hidden="true" />
          <div className={cx('sr-sheet__header', hideTitle && 'sr-sheet__header--hidden')}>
            <h2 id={titleId} className={cx('sr-sheet__title', hideTitle && 'sr-visually-hidden')}>
              {title}
            </h2>
            <IconButton icon="close" label={closeLabel} onClick={onClose} />
          </div>
          <div className={cx('sr-sheet__body', footer != null && 'sr-sheet__body--with-footer')}>
            {children}
          </div>
          {footer != null && <div className="sr-sheet__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
