import type { ComponentPropsWithRef, MouseEventHandler, ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from '../icons/Icon';
import './ListItem.css';

export interface ListProps extends ComponentPropsWithRef<'ul'> {
  /** Draw the list inside a card surface with dividers. Default true. */
  inset?: boolean;
}

/** Container for ListItems (<ul>). */
export function List({ inset = true, className, ...rest }: ListProps) {
  return <ul className={cx('sr-list', inset && 'sr-list--inset', className)} {...rest} />;
}

export interface ListItemProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small text on the right of the title row (date, duration…). */
  meta?: ReactNode;
  /** Icon, VoiceBadge or thumbnail at the start. */
  leading?: ReactNode;
  /** Extra controls at the end (e.g. a "more" IconButton). Kept outside the main button. */
  trailing?: ReactNode;
  /** Makes the row a button. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Makes the row a link (ignored when onClick is set). */
  href?: string;
  /** Show a chevron at the end of clickable rows. Default true when clickable. */
  chevron?: boolean;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}

/** One row of a List: song in the library, setting, diagnostic… */
export function ListItem({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onClick,
  href,
  chevron,
  selected = false,
  disabled = false,
  className,
}: ListItemProps) {
  const clickable = Boolean(onClick || href);
  const showChevron = chevron ?? (clickable && trailing == null);
  const content = (
    <>
      {leading != null && <span className="sr-listitem__leading">{leading}</span>}
      <span className="sr-listitem__text">
        <span className="sr-listitem__titlerow">
          <span className="sr-listitem__title">{title}</span>
          {meta != null && <span className="sr-listitem__meta">{meta}</span>}
        </span>
        {subtitle != null && <span className="sr-listitem__subtitle">{subtitle}</span>}
      </span>
      {showChevron && <Icon name="chevron-right" size={20} className="sr-listitem__chevron" />}
    </>
  );
  let main: ReactNode;
  if (onClick) {
    main = (
      <button
        type="button"
        className="sr-listitem__main"
        onClick={onClick}
        disabled={disabled}
        aria-current={selected || undefined}
      >
        {content}
      </button>
    );
  } else if (href) {
    main = (
      <a className="sr-listitem__main" href={href} aria-current={selected || undefined}>
        {content}
      </a>
    );
  } else {
    main = <div className="sr-listitem__main">{content}</div>;
  }
  return (
    <li
      className={cx(
        'sr-listitem',
        clickable && 'is-clickable',
        selected && 'is-selected',
        disabled && 'is-disabled',
        trailing != null && 'has-trailing',
        className,
      )}
    >
      {main}
      {trailing != null && <span className="sr-listitem__trailing">{trailing}</span>}
    </li>
  );
}
