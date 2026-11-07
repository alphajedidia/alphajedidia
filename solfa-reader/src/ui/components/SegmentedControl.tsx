import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import './SegmentedControl.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Show only the icon (label stays the accessible name). */
  iconOnly?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group, e.g. "Theme". */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Stretch to full width with equal segments. */
  block?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * One choice among 2–4 short options (radio group). Arrow keys move the selection,
 * as in the WAI-ARIA radio pattern; only the selected segment is in the tab order.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  block = false,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    const last = options.length - 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = selectedIndex === last ? 0 : selectedIndex + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = selectedIndex === 0 ? last : selectedIndex - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null || disabled) return;
    e.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx('sr-segmented', block && 'sr-segmented--block', className)}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.iconOnly ? o.label : undefined}
            title={o.iconOnly ? o.label : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            className={cx('sr-segmented__option', selected && 'is-selected')}
            onClick={() => {
              if (!selected) onChange(o.value);
            }}
          >
            {o.icon && <Icon name={o.icon} size={20} />}
            {!o.iconOnly && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
