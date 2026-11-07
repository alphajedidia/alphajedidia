import { useId, type CSSProperties } from 'react';
import type { VoiceId } from '../../core';
import { cx } from '../cx';
import { voiceClass } from '../voices';
import { IconButton } from './IconButton';
import './Slider.css';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Default 1. The steppers move by this amount too. */
  step?: number;
  onChange: (value: number) => void;
  /** Visible value and aria-valuetext, e.g. v => `${v} BPM`. Default String(v). */
  formatValue?: (value: number) => string;
  /** Show − / + buttons (fine control is hard on a touch slider). Default true. */
  steppers?: boolean;
  /** Accessible names of the steppers. Defaults "Decrease" / "Increase". */
  decrementLabel?: string;
  incrementLabel?: string;
  hideLabel?: boolean;
  /** Hide the value text next to the label. */
  hideValue?: boolean;
  /** Colour the track with a voice colour. */
  voice?: VoiceId;
  disabled?: boolean;
  className?: string;
}

/** Snap to the step grid and clamp, avoiding float noise (0.1 + 0.2). */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  const snapped = min + Math.round((value - min) / step) * step;
  const clamped = Math.min(max, Math.max(min, snapped));
  return Number(clamped.toFixed(decimals));
}

/** Range slider with label, value and − / + steppers. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue = String,
  steppers = true,
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
  hideLabel = false,
  hideValue = false,
  voice,
  disabled = false,
  className,
}: SliderProps) {
  const id = `sr-slider-${useId()}`;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const valueText = formatValue(value);
  const style = { '--sr-slider-pct': `${pct}%` } as CSSProperties;
  const change = (next: number) => {
    const v = snapToStep(next, min, max, step);
    if (v !== value) onChange(v);
  };
  return (
    <div
      className={cx('sr-slider', voice && voiceClass(voice), voice && 'sr-slider--voice', className)}
    >
      {!(hideLabel && hideValue) && (
        <div className={cx('sr-slider__head', hideLabel && 'sr-slider__head--value-only')}>
          <label htmlFor={id} className={cx('sr-slider__label', hideLabel && 'sr-visually-hidden')}>
            {label}
          </label>
          {!hideValue && (
            <output htmlFor={id} className="sr-slider__value">
              {valueText}
            </output>
          )}
        </div>
      )}
      <div className="sr-slider__row">
        {steppers && (
          <IconButton
            icon="minus"
            label={decrementLabel}
            variant="secondary"
            onClick={() => change(value - step)}
            disabled={disabled || value <= min}
          />
        )}
        <input
          id={id}
          type="range"
          className="sr-slider__input"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={hideLabel && hideValue ? label : undefined}
          aria-valuetext={valueText}
          style={style}
          onChange={(e) => change(Number(e.currentTarget.value))}
        />
        {steppers && (
          <IconButton
            icon="plus"
            label={incrementLabel}
            variant="secondary"
            onClick={() => change(value + step)}
            disabled={disabled || value >= max}
          />
        )}
      </div>
    </div>
  );
}
