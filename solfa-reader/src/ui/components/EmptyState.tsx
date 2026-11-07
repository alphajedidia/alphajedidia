import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import './EmptyState.css';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: IconName;
  /** Custom illustration instead of the icon (e.g. <Logo size={72} />). */
  art?: ReactNode;
  /** Buttons: the next step the user can take. */
  actions?: ReactNode;
  /** error = something failed (red icon); loading = shows `art`/spinner as is. */
  tone?: 'neutral' | 'error';
  /** Heading level. Default h2. */
  headingAs?: 'h2' | 'h3';
  className?: string;
}

/** Empty, error or "nothing found" placeholder — always with a way forward. */
export function EmptyState({
  title,
  description,
  icon,
  art,
  actions,
  tone = 'neutral',
  headingAs: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div className={cx('sr-empty', `sr-empty--${tone}`, className)}>
      {art ?? (icon && (
        <span className="sr-empty__icon">
          <Icon name={icon} size={36} />
        </span>
      ))}
      <Heading className="sr-empty__title">{title}</Heading>
      {description != null && <p className="sr-empty__desc">{description}</p>}
      {actions != null && <div className="sr-empty__actions">{actions}</div>}
    </div>
  );
}
