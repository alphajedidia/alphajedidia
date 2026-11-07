import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import './Field.css';

interface FieldOwnProps {
  /** Visible label (always shown above the input: placeholders are not labels). */
  label: string;
  /** Hide the label visually (still read by screen readers), e.g. a search box. */
  hideLabel?: boolean;
  /** Help text under the input. */
  hint?: ReactNode;
  /** Error text; also sets aria-invalid. */
  error?: ReactNode;
  /** Sol-fa text: monospace, larger, no autocorrect. */
  mono?: boolean;
  /** Icon inside the start of a single-line input (e.g. search). */
  icon?: IconName;
  /** Element inside the end of a single-line input (e.g. a clear IconButton). */
  trailing?: ReactNode;
  /** Class on the outer wrapper. */
  className?: string;
}

export type FieldInputProps = FieldOwnProps & {
  multiline?: false;
} & Omit<ComponentPropsWithRef<'input'>, keyof FieldOwnProps>;

export type FieldTextareaProps = FieldOwnProps & {
  multiline: true;
} & Omit<ComponentPropsWithRef<'textarea'>, keyof FieldOwnProps>;

export type FieldProps = FieldInputProps | FieldTextareaProps;

const MONO_INPUT_PROPS = {
  autoCapitalize: 'off',
  autoCorrect: 'off',
  spellCheck: false,
  autoComplete: 'off',
} as const;

/** Labelled text input or textarea with hint and error. `ref` reaches the native element. */
export function Field(props: FieldProps) {
  const autoId = useId();
  const { label, hideLabel, hint, error, mono, icon, trailing, className } = props;
  const id = props.id ?? `sr-field-${autoId}`;
  const hintId = hint != null ? `${id}-hint` : undefined;
  const errorId = error != null ? `${id}-error` : undefined;
  const describedBy = cx(hintId, errorId, props['aria-describedby']) || undefined;
  const common = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error != null ? true : undefined,
    ...(mono ? MONO_INPUT_PROPS : {}),
  };

  let control: ReactNode;
  if (props.multiline === true) {
    const {
      label: _l, hideLabel: _h, hint: _hi, error: _e, mono: _m, icon: _i, trailing: _t,
      className: _c, multiline: _ml, ...rest
    } = props;
    control = (
      <textarea
        {...rest}
        {...common}
        className={cx('sr-field__control', 'sr-field__control--multiline')}
      />
    );
  } else {
    const {
      label: _l, hideLabel: _h, hint: _hi, error: _e, mono: _m, icon: _i, trailing: _t,
      className: _c, multiline: _ml, ...rest
    } = props;
    control = (
      <span className="sr-field__inputwrap">
        {icon && <Icon name={icon} size={20} className="sr-field__icon" />}
        <input {...rest} {...common} className="sr-field__control" />
        {trailing != null && <span className="sr-field__trailing">{trailing}</span>}
      </span>
    );
  }

  return (
    <div
      className={cx(
        'sr-field',
        mono && 'sr-field--mono',
        icon && 'sr-field--icon',
        trailing != null && 'sr-field--trailing',
        error != null && 'is-invalid',
        className,
      )}
    >
      <label htmlFor={id} className={cx('sr-field__label', hideLabel && 'sr-visually-hidden')}>
        {label}
      </label>
      {control}
      {hint != null && (
        <p id={hintId} className="sr-field__hint">
          {hint}
        </p>
      )}
      {error != null && (
        <p id={errorId} className="sr-field__error">
          <Icon name="warning" size={18} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
