// Timbre definitions for the synthesiser (B-05) and the pure spectrum maths behind them.
// Everything here is data or pure functions so it can be unit-tested without Web Audio.
import type { InstrumentId } from './types';

/** Slow pitch wobble (sung "ooh"). */
export interface VibratoSpec {
  /** Hz. */
  rate: number;
  /** Peak deviation in cents. */
  depthCents: number;
  /** Seconds after the note start before the vibrato fades in (singers start straight). */
  delay: number;
  /** Seconds to reach full depth. */
  rampIn: number;
}

/** One oscillator of a note. A note sums its layers, then a release gate shapes the end. */
export interface LayerSpec {
  /** Harmonic amplitudes, index 0 = fundamental. Shaped per pitch by {@link shapeSpectrum}. */
  partials: readonly number[];
  /** Peak level of the layer relative to the instrument level. */
  level: number;
  detuneCents: number;
  /** Linear attack time (s); shortened for very short notes. */
  attack: number;
  /** Exponential decay time constant (s) after the attack; Infinity = organ-like sustain. */
  decay: number;
  /** Level the decay tends to, as a fraction of the peak. */
  sustain: number;
  vibrato?: VibratoSpec;
}

export interface InstrumentSpec {
  layers: readonly LayerSpec[];
  /** Release time constant (s) of the gate when the note ends. */
  release: number;
  /** Overall note level (before the voice bus and master). */
  level: number;
  /** Higher notes decay faster (piano strings). */
  pitchDependentDecay: boolean;
}

export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentSpec>> = {
  // Two layers: a bright "strike" that dies quickly and a warm body that settles to a quiet
  // sustain, so long choir notes stay audible instead of vanishing like a real piano would.
  piano: {
    level: 0.3,
    release: 0.08,
    pitchDependentDecay: true,
    layers: [
      {
        partials: [1, 0.72, 0.5, 0.38, 0.28, 0.2, 0.15, 0.11, 0.08, 0.06, 0.045, 0.035, 0.025, 0.02],
        level: 0.5,
        detuneCents: 0,
        attack: 0.004,
        decay: 0.22,
        sustain: 0,
      },
      {
        partials: [1, 0.38, 0.14, 0.07, 0.035, 0.02],
        level: 0.75,
        detuneCents: 0.8,
        attack: 0.006,
        decay: 1.0,
        sustain: 0.34,
      },
    ],
  },
  // Principal-like drawbars (8', 4', 2 2/3', 2', 1 1/3', 1') plus a slightly detuned flute
  // for a gentle chorus.
  organ: {
    level: 0.26,
    release: 0.05,
    pitchDependentDecay: false,
    layers: [
      {
        partials: [1, 0.55, 0.32, 0.26, 0.06, 0.13, 0, 0.07],
        level: 0.72,
        detuneCents: 0,
        attack: 0.025,
        decay: Infinity,
        sustain: 1,
      },
      {
        partials: [1, 0.12, 0.05],
        level: 0.38,
        detuneCents: 6,
        attack: 0.035,
        decay: Infinity,
        sustain: 1,
      },
    ],
  },
  // Soft rounded "ooh": almost a sine, two slightly detuned layers with delayed vibrato.
  voice: {
    level: 0.32,
    release: 0.1,
    pitchDependentDecay: false,
    layers: [
      {
        partials: [1, 0.2, 0.07, 0.035, 0.015],
        level: 0.75,
        detuneCents: 0,
        attack: 0.09,
        decay: 2.5,
        sustain: 0.85,
        vibrato: { rate: 5.3, depthCents: 14, delay: 0.22, rampIn: 0.4 },
      },
      {
        partials: [1, 0.15, 0.05],
        level: 0.35,
        detuneCents: -7,
        attack: 0.13,
        decay: Infinity,
        sustain: 1,
        vibrato: { rate: 4.8, depthCents: 10, delay: 0.3, rampIn: 0.5 },
      },
    ],
  },
};

/** Equal-tempered frequency of a MIDI note (A4 = 69 = 440 Hz). */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Phone speakers reproduce little below ~150–200 Hz. */
const PHONE_LOW_HZ = 150;
/** Upper edge of the band where added harmonics carry the pitch of low notes. */
const SUPPORT_TOP_HZ = 1500;
/** Corner of the gentle treble roll-off that keeps the sound from getting harsh. */
const TREBLE_CORNER_HZ = 3000;
/** No partial above this frequency (also well under Nyquist at 22050 Hz renders). */
export const MAX_PARTIAL_HZ = 8000;

/**
 * How much a note needs extra harmonics to be heard on a phone speaker:
 * 1 at or below A2 (110 Hz), 0 at or above E4 (≈ 330 Hz), log-linear in between.
 */
export function bassSupport(f0: number): number {
  const lo = Math.log2(110);
  const hi = Math.log2(330);
  const x = (hi - Math.log2(Math.max(f0, 1))) / (hi - lo);
  return Math.min(1, Math.max(0, x));
}

/**
 * Harmonic amplitudes for one pitch, ready for `createPeriodicWave` (index 0 = DC = 0).
 * Low notes get extra harmonics in the 150–1500 Hz band (the "missing fundamental" makes the
 * ear hear the bass on a phone speaker); every note gets a gentle treble roll-off.
 */
export function shapeSpectrum(
  partials: readonly number[],
  f0: number,
  maxHz: number = MAX_PARTIAL_HZ,
): Float32Array<ArrayBuffer> {
  const support = bassSupport(f0);
  const count = Math.max(1, Math.min(64, Math.floor(maxHz / f0)));
  const out = new Float32Array(count + 1);
  for (let n = 1; n <= count; n++) {
    const f = n * f0;
    let a = partials[n - 1] ?? 0;
    if (n === 1) a *= 1 - 0.2 * support;
    else if (support > 0 && f >= PHONE_LOW_HZ && f <= SUPPORT_TOP_HZ) a += support * 0.45 * n ** -0.6;
    a /= Math.sqrt(1 + (f / TREBLE_CORNER_HZ) ** 4);
    out[n] = a;
  }
  return out;
}

/** Loudness compensation per register: lift low notes a little, tame very high ones. */
export function registerGain(midi: number): number {
  const f0 = midiToFrequency(midi);
  const high = Math.min(1, Math.max(0, (midi - 72) / 12));
  return (1 + 0.2 * bassSupport(f0)) * (1 - 0.15 * high);
}

/** Decay time constant of a layer for one pitch (piano: one octave up = 1.4× shorter). */
export function layerDecay(spec: InstrumentSpec, layer: LayerSpec, midi: number): number {
  if (!Number.isFinite(layer.decay) || !spec.pitchDependentDecay) return layer.decay;
  return layer.decay * 2 ** (-(midi - 60) / 24);
}
