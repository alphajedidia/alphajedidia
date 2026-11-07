import type { VoiceId } from '../../core';
import { cx } from '../cx';
import { DEFAULT_VOICE_NAMES, voiceClass } from '../voices';
import './VoiceBadge.css';

export interface VoiceBadgeProps {
  voice: VoiceId;
  /** Translated full name ("Soprano", "Ténor"…). Read by screen readers; shown with showName. */
  name?: string;
  /** Show the name next to the letter. */
  showName?: boolean;
  /** solid = filled voice colour; soft = tint; outline = ring (inactive/muted voice). */
  variant?: 'solid' | 'soft' | 'outline';
  /** sm 24px, md 32px, lg 40px. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Voice identity: the letter S/A/T/B in the voice colour. The letter is always there, so
 * colour is never the only cue (colour-blind safe).
 */
export function VoiceBadge({
  voice,
  name,
  showName = false,
  variant = 'solid',
  size = 'md',
  className,
}: VoiceBadgeProps) {
  const fullName = name ?? DEFAULT_VOICE_NAMES[voice];
  return (
    <span
      className={cx(
        'sr-voicebadge',
        voiceClass(voice),
        `sr-voicebadge--${variant}`,
        `sr-voicebadge--${size}`,
        className,
      )}
    >
      <span className="sr-voicebadge__letter" aria-hidden="true">
        {voice}
      </span>
      {showName ? (
        <span className="sr-voicebadge__name">{fullName}</span>
      ) : (
        <span className="sr-visually-hidden">{fullName}</span>
      )}
    </span>
  );
}
