import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../cx';
import './Card.css';

export interface CardProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  /** Optional header title (rendered as h2). */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Header right side (IconButtons, Chip…). */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Inner padding. Default md (16px). */
  padding?: 'none' | 'sm' | 'md';
  /** default = paper card; sunken = recessed tray; brand = soft navy tint. */
  tone?: 'default' | 'sunken' | 'brand';
  as?: 'div' | 'section' | 'article';
}

/** Surface that groups related content. */
export function Card({
  title,
  subtitle,
  actions,
  footer,
  padding = 'md',
  tone = 'default',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = title != null || actions != null;
  return (
    <Tag
      className={cx('sr-card', `sr-card--pad-${padding}`, `sr-card--${tone}`, className)}
      {...rest}
    >
      {hasHeader && (
        <div className="sr-card__header">
          <div className="sr-card__titles">
            {title != null && <h2 className="sr-card__title">{title}</h2>}
            {subtitle != null && <p className="sr-card__subtitle">{subtitle}</p>}
          </div>
          {actions != null && <div className="sr-card__actions">{actions}</div>}
        </div>
      )}
      {children}
      {footer != null && <div className="sr-card__footer">{footer}</div>}
    </Tag>
  );
}
