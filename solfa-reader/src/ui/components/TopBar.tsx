import type { ReactNode } from 'react';
import { cx } from '../cx';
import { IconButton } from './IconButton';
import './TopBar.css';

export interface TopBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Shows a back arrow at the start. */
  onBack?: () => void;
  /** Accessible name of the back button. Default "Back". */
  backLabel?: string;
  /** Element before the title when there is no back button (e.g. <Logo />). */
  leading?: ReactNode;
  /** Right-side actions, usually 1–2 IconButtons (more go in a "more" sheet). */
  actions?: ReactNode;
  /** brand = navy "hymn-book cover" (default); plain = page colour. */
  variant?: 'brand' | 'plain';
  /** Heading level of the title. Default h1 (one TopBar per screen). */
  titleAs?: 'h1' | 'h2' | 'div';
  /** Stick to the top while scrolling. Default true. */
  sticky?: boolean;
  className?: string;
}

/** Screen header: back, title (+ subtitle), actions. Pads for the status-bar safe area. */
export function TopBar({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  leading,
  actions,
  variant = 'brand',
  titleAs: TitleTag = 'h1',
  sticky = true,
  className,
}: TopBarProps) {
  return (
    <header
      className={cx('sr-topbar', `sr-topbar--${variant}`, sticky && 'sr-topbar--sticky', className)}
    >
      <div className="sr-topbar__inner">
        {onBack ? (
          <IconButton icon="back" label={backLabel} onClick={onBack} className="sr-topbar__back" />
        ) : (
          leading
        )}
        <div className="sr-topbar__titles">
          <TitleTag className="sr-topbar__title">{title}</TitleTag>
          {subtitle != null && <p className="sr-topbar__subtitle">{subtitle}</p>}
        </div>
        {actions != null && <div className="sr-topbar__actions">{actions}</div>}
      </div>
    </header>
  );
}
