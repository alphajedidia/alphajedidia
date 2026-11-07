import type { MouseEventHandler } from 'react';
import type { VoiceId } from '../../core';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { voiceClass } from '../voices';
import './Chip.css';

export type ChipTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export interface ChipProps {
  label: string;
  icon?: IconName;
  tone?: ChipTone;
  /** Colour the chip with a voice colour (overrides tone). */
  voice?: VoiceId;
  /** Makes it a toggle button (aria-pressed) when combined with onClick. */
  selected?: boolean;
  /** Makes the chip a button. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Shows an × button. */
  onRemove?: () => void;
  /** Accessible name of the × button. Default "Remove". */
  removeLabel?: string;
  className?: string;
}

/** Small label: status ("3 errors"), filter, selected bars… Interactive chips are 44px tall. */
export function Chip({
  label,
  icon,
  tone = 'neutral',
  voice,
  selected,
  onClick,
  onRemove,
  removeLabel = 'Remove',
  className,
}: ChipProps) {
  const classes = cx(
    'sr-chip',
    voice ? cx('sr-chip--voice', voiceClass(voice)) : `sr-chip--${tone}`,
    onClick && 'sr-chip--interactive',
    selected && 'is-selected',
    className,
  );
  const body = (
    <>
      {icon && <Icon name={icon} size={18} />}
      <span className="sr-chip__label">{label}</span>
    </>
  );
  if (onClick && !onRemove) {
    return (
      <button type="button" className={classes} aria-pressed={selected} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <span className={cx(classes, onRemove && 'sr-chip--removable')}>
      {body}
      {onRemove && (
        <button type="button" className="sr-chip__remove" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="close" size={16} />
        </button>
      )}
    </span>
  );
}
