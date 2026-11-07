import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import './Switch.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  /** Second line under the label. */
  description?: ReactNode;
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

/** On/off setting; the whole row is the touch target. Native checkbox with role="switch". */
export function Switch({
  checked,
  onChange,
  label,
  description,
  hideLabel = false,
  disabled = false,
  className,
}: SwitchProps) {
  const id = `sr-switch-${useId()}`;
  const descId = description != null ? `${id}-desc` : undefined;
  return (
    <label className={cx('sr-switch', disabled && 'is-disabled', className)} htmlFor={id}>
      <span className={cx('sr-switch__text', hideLabel && 'sr-visually-hidden')}>
        <span className="sr-switch__label">{label}</span>
        {description != null && (
          <span id={descId} className="sr-switch__desc">
            {description}
          </span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="sr-switch__input"
        checked={checked}
        disabled={disabled}
        aria-describedby={descId}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span className="sr-switch__track" aria-hidden="true">
        <span className="sr-switch__thumb" />
      </span>
    </label>
  );
}
