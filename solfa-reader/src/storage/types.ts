import type { InstrumentId, VoiceMix } from '../audio/types';
import type { VoiceId } from '../core';

export type SongSource = 'typed' | 'scanned' | 'shared' | 'imported' | 'sample';

/** Player settings remembered per song. */
export interface PlayerPrefs {
  tempo?: number;
  instrument?: InstrumentId;
  transpose?: number;
  octaveShift?: Partial<Record<VoiceId, number>>;
  mix?: Partial<Record<VoiceId, VoiceMix>>;
  focus?: VoiceId | null;
}

export interface SongRecord {
  id: string;
  title: string;
  /** .solfa text (docs/SOLFA_FORMAT.md) */
  text: string;
  source: SongSource;
  createdAt: number;
  updatedAt: number;
  prefs?: PlayerPrefs;
}

export type Language = 'mg' | 'en' | 'fr';
export type ThemePref = 'auto' | 'light' | 'dark';

export interface AppSettings {
  language: Language;
  theme: ThemePref;
  instrument: InstrumentId;
  countIn: boolean;
  /** Handwriting option pre-selected on the scan screen. */
  handwriting: boolean;
  /** Has the user seen the first-run hints? */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'mg',
  theme: 'auto',
  instrument: 'piano',
  countIn: true,
  handwriting: false,
  onboarded: false,
};
