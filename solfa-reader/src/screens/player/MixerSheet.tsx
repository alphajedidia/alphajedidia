// "Voices and sound" sheet: per-voice Focus / Solo / Mute / volume, count-in, metronome,
// instrument, transpose and (advanced) per-voice octave.
import { useRef } from 'react';
import type { InstrumentId, VoiceMix } from '../../audio';
import type { VoiceId } from '../../core';
import { useTestIds } from '../../app/hooks';
import { useT, type MessageKey } from '../../i18n';
import { SegmentedControl, Sheet, Slider, Switch, VoiceMixerRow } from '../../ui';

export interface MixerState {
  mix: Record<VoiceId, VoiceMix>;
  solo: VoiceId | null;
  focus: VoiceId | null;
  countIn: boolean;
  metronome: boolean;
  instrument: InstrumentId;
  transpose: number;
  octaveShift: Partial<Record<VoiceId, number>>;
}

export interface MixerSheetProps {
  open: boolean;
  onClose: () => void;
  voices: readonly VoiceId[];
  state: MixerState;
  onChange: (patch: Partial<MixerState>) => void;
}

function MixerRow({ voice, state, onChange }: { voice: VoiceId; state: MixerState; onChange: MixerSheetProps['onChange'] }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useTestIds(ref, '.sr-mixrow__toggle', [`mixer-focus-${voice}`, `mix-solo-${voice}`, `mix-mute-${voice}`]);
  const mix = state.mix[voice];
  const setMix = (patch: Partial<VoiceMix>) => onChange({ mix: { ...state.mix, [voice]: { ...mix, ...patch } } });
  return (
    <div ref={ref}>
      <VoiceMixerRow
        voice={voice}
        name={t(`voice.${voice}` as MessageKey)}
        mix={mix}
        solo={state.solo === voice}
        focus={state.focus === voice}
        audible={state.solo ? state.solo === voice : !mix.muted}
        onVolumeChange={(volume) => setMix({ volume })}
        onMutedChange={(muted) => setMix({ muted })}
        onSoloChange={(on) => onChange({ solo: on ? voice : null })}
        onFocusChange={(on) => onChange({ focus: on ? voice : null })}
        formatVolume={(v) => t('mixer.volumeValue', { value: Math.round(v * 100) })}
        labels={{
          volume: t('mixer.volume'),
          focus: t('mixer.focus'),
          solo: t('mixer.solo'),
          mute: t('mixer.mute'),
          decrease: t('mixer.softer'),
          increase: t('mixer.louder'),
        }}
      />
    </div>
  );
}

/** Bottom sheet with the mixer and sound options. */
export function MixerSheet({ open, onClose, voices, state, onChange }: MixerSheetProps) {
  const t = useT();
  const octaveOptions = [
    { value: '-1', label: t('player.octaveDown'), icon: 'chevron-down', iconOnly: true },
    { value: '0', label: t('player.octaveNormal'), icon: 'music', iconOnly: true },
    { value: '1', label: t('player.octaveUp'), icon: 'chevron-up', iconOnly: true },
  ] as const;
  return (
    <Sheet open={open} onClose={onClose} title={t('player.mixerTitle')} closeLabel={t('common.close')}>
      <div className="sr-mixer sr-stack">
        <p className="sr-muted sr-mixer__legend">{t('player.legend')}</p>
        <div className="sr-stack sr-stack--sm">
          {voices.map((v) => (
            <MixerRow key={v} voice={v} state={state} onChange={onChange} />
          ))}
        </div>
        <Switch label={t('player.countIn')} description={t('player.countInDesc')} checked={state.countIn} onChange={(countIn) => onChange({ countIn })} />
        <Switch
          label={t('player.metronome')}
          description={t('player.metronomeDesc')}
          checked={state.metronome}
          onChange={(metronome) => onChange({ metronome })}
        />
        <div className="sr-stack sr-stack--sm">
          <h3 className="sr-section-title">{t('player.instrument')}</h3>
          <SegmentedControl
            label={t('player.instrument')}
            block
            value={state.instrument}
            onChange={(instrument) => onChange({ instrument })}
            options={[
              { value: 'piano', label: t('instrument.piano'), icon: 'piano' },
              { value: 'organ', label: t('instrument.organ'), icon: 'music' },
              { value: 'voice', label: t('instrument.voice'), icon: 'headphones' },
            ]}
          />
        </div>
        <Slider
          label={t('player.transpose')}
          value={state.transpose}
          min={-6}
          max={6}
          onChange={(transpose) => onChange({ transpose })}
          formatValue={(v) => t('player.transposeValue', { value: v > 0 ? `+${v}` : String(v) })}
          decrementLabel={t('player.transposeLower')}
          incrementLabel={t('player.transposeHigher')}
        />
        <details className="sr-mixer__advanced">
          <summary>{t('player.advanced')}</summary>
          <div className="sr-stack sr-stack--sm">
            <h3 className="sr-section-title">{t('player.octave')}</h3>
            <p className="sr-muted">{t('player.octaveHint')}</p>
            {voices.map((v) => (
              <div key={v} className="sr-mixer__octave">
                <span className="sr-mixer__octave-name">{t(`voice.${v}` as MessageKey)}</span>
                <SegmentedControl
                  label={`${t('player.octave')}: ${t(`voice.${v}` as MessageKey)}`}
                  value={String(state.octaveShift[v] ?? 0)}
                  onChange={(value) => onChange({ octaveShift: { ...state.octaveShift, [v]: Number(value) } })}
                  options={octaveOptions}
                />
              </div>
            ))}
          </div>
        </details>
      </div>
    </Sheet>
  );
}
