import type { VoiceMix } from '../../audio';
import type { VoiceId } from '../../core';
import { Slider } from '../components/Slider';
import { VoiceBadge } from '../components/VoiceBadge';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { voiceClass } from '../voices';
import './VoiceMixerRow.css';

export interface VoiceMixerLabels {
  volume: string;
  focus: string;
  solo: string;
  mute: string;
  decrease: string;
  increase: string;
}

export const DEFAULT_MIXER_LABELS: VoiceMixerLabels = {
  volume: 'Volume',
  focus: 'Focus',
  solo: 'Solo',
  mute: 'Mute',
  decrease: 'Softer',
  increase: 'Louder',
};

export interface VoiceMixerRowProps {
  voice: VoiceId;
  /** Translated voice name, shown next to the badge. */
  name: string;
  mix: VoiceMix;
  solo: boolean;
  focus: boolean;
  /**
   * False when this voice is silent because of mute or another voice's solo: the row is drawn
   * as inactive. Default `!mix.muted`.
   */
  audible?: boolean;
  onVolumeChange: (volume: number) => void;
  onMutedChange: (muted: boolean) => void;
  onSoloChange: (solo: boolean) => void;
  onFocusChange: (focus: boolean) => void;
  /** aria-valuetext of the volume. Default v => `${Math.round(v * 100)} %`. */
  formatVolume?: (volume: number) => string;
  labels?: Partial<VoiceMixerLabels>;
  disabled?: boolean;
  className?: string;
}

interface ToggleProps {
  icon: IconName;
  label: string;
  pressed: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}

function Toggle({ icon, label, pressed, disabled, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      className={cx('sr-mixrow__toggle', pressed && 'is-pressed')}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={() => onToggle(!pressed)}
    >
      <Icon name={icon} size={22} />
      <span className="sr-mixrow__toggletext">{label}</span>
    </button>
  );
}

const defaultFormatVolume = (v: number) => `${Math.round(v * 100)} %`;

/** One voice of the mixer: badge + name, Focus / Solo / Mute toggles, volume slider. */
export function VoiceMixerRow({
  voice,
  name,
  mix,
  solo,
  focus,
  audible,
  onVolumeChange,
  onMutedChange,
  onSoloChange,
  onFocusChange,
  formatVolume = defaultFormatVolume,
  labels: labelOverrides,
  disabled = false,
  className,
}: VoiceMixerRowProps) {
  const labels = { ...DEFAULT_MIXER_LABELS, ...labelOverrides };
  const isAudible = audible ?? !mix.muted;
  return (
    <div
      role="group"
      aria-label={name}
      className={cx('sr-mixrow', voiceClass(voice), !isAudible && 'is-silent', className)}
    >
      <div className="sr-mixrow__head">
        <VoiceBadge voice={voice} name={name} showName variant={isAudible ? 'solid' : 'outline'} />
        <div className="sr-mixrow__toggles">
          <Toggle icon="focus" label={labels.focus} pressed={focus} disabled={disabled} onToggle={onFocusChange} />
          <Toggle icon="headphones" label={labels.solo} pressed={solo} disabled={disabled} onToggle={onSoloChange} />
          <Toggle icon="volume-off" label={labels.mute} pressed={mix.muted} disabled={disabled} onToggle={onMutedChange} />
        </div>
      </div>
      <Slider
        label={labels.volume}
        hideLabel
        hideValue
        value={mix.volume}
        min={0}
        max={1}
        step={0.05}
        voice={voice}
        formatValue={formatVolume}
        decrementLabel={labels.decrease}
        incrementLabel={labels.increase}
        onChange={onVolumeChange}
        disabled={disabled}
      />
    </div>
  );
}
