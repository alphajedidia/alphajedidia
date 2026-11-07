import { describe, expect, it } from 'vitest';
import { completeMix, computeVoiceGains, defaultMix, FOCUS_OTHERS_GAIN } from './mix';

describe('computeVoiceGains', () => {
  it('passes volumes through by default', () => {
    const mix = completeMix({ S: { volume: 0.5 }, B: { volume: 0.8 } });
    expect(computeVoiceGains(mix, null, null)).toEqual({ S: 0.5, A: 1, T: 1, B: 0.8 });
  });

  it('mutes voices', () => {
    const mix = completeMix({ A: { muted: true } });
    expect(computeVoiceGains(mix, null, null)).toEqual({ S: 1, A: 0, T: 1, B: 1 });
  });

  it('solo plays only that voice, even if it was muted', () => {
    const mix = completeMix({ T: { volume: 0.7, muted: true } });
    expect(computeVoiceGains(mix, 'T', null)).toEqual({ S: 0, A: 0, T: 0.7, B: 0 });
  });

  it('focus keeps the voice at 100 % and the others at 25 %', () => {
    expect(FOCUS_OTHERS_GAIN).toBe(0.25);
    const gains = computeVoiceGains(defaultMix(), null, 'A');
    expect(gains).toEqual({ S: 0.25, A: 1, T: 0.25, B: 0.25 });
  });

  it('focus scales with each volume and respects mute', () => {
    const mix = completeMix({ S: { volume: 0.8 }, T: { muted: true }, A: { volume: 0.6 } });
    expect(computeVoiceGains(mix, null, 'A')).toEqual({ S: 0.2, A: 0.6, T: 0, B: 0.25 });
  });

  it('solo wins over focus', () => {
    expect(computeVoiceGains(defaultMix(), 'B', 'A')).toEqual({ S: 0, A: 0, T: 0, B: 1 });
  });
});

describe('completeMix', () => {
  it('fills defaults and clamps volumes', () => {
    expect(completeMix({ S: { volume: 2 }, A: { volume: -1 }, T: { volume: Number.NaN } })).toEqual({
      S: { volume: 1, muted: false },
      A: { volume: 0, muted: false },
      T: { volume: 1, muted: false },
      B: { volume: 1, muted: false },
    });
  });
});
