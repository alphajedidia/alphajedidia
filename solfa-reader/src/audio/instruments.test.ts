import { describe, expect, it } from 'vitest';
import { INSTRUMENT_IDS } from './types';
import {
  bassSupport,
  INSTRUMENTS,
  layerDecay,
  MAX_PARTIAL_HZ,
  midiToFrequency,
  registerGain,
  shapeSpectrum,
} from './instruments';

/** Share of the energy (sum of squared amplitudes) at or above `hz`. */
function energyAbove(spectrum: Float32Array, f0: number, hz: number): number {
  let above = 0;
  let all = 0;
  for (let n = 1; n < spectrum.length; n++) {
    const e = spectrum[n]! ** 2;
    all += e;
    if (n * f0 >= hz) above += e;
  }
  return above / all;
}

describe('pitch', () => {
  it('converts MIDI to Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440);
    expect(midiToFrequency(60)).toBeCloseTo(261.626, 2);
    expect(midiToFrequency(40)).toBeCloseTo(82.407, 2);
  });
});

describe('phone-friendly spectra', () => {
  it('needs bass support only for low notes', () => {
    expect(bassSupport(82)).toBe(1);
    expect(bassSupport(110)).toBe(1);
    expect(bassSupport(330)).toBe(0);
    expect(bassSupport(800)).toBe(0);
    const mid = bassSupport(190);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it.each(INSTRUMENT_IDS)('%s: a low bass note (E2) has most of its energy where phone speakers play', (id) => {
    const f0 = midiToFrequency(40);
    for (const layer of INSTRUMENTS[id].layers) {
      const spectrum = shapeSpectrum(layer.partials, f0);
      expect(energyAbove(spectrum, f0, 150)).toBeGreaterThan(0.4);
    }
  });

  it.each(INSTRUMENT_IDS)('%s: a high soprano note (A5) is not harsh', (id) => {
    const f0 = midiToFrequency(81);
    for (const layer of INSTRUMENTS[id].layers) {
      const spectrum = shapeSpectrum(layer.partials, f0);
      expect(energyAbove(spectrum, f0, 4000)).toBeLessThan(0.03);
      expect((spectrum.length - 1) * f0).toBeLessThanOrEqual(MAX_PARTIAL_HZ);
    }
  });

  it('leaves mid-range notes close to the designed timbre and has no DC', () => {
    const partials = INSTRUMENTS.voice.layers[0]!.partials;
    const spectrum = shapeSpectrum(partials, midiToFrequency(67));
    expect(spectrum[0]).toBe(0);
    expect(spectrum[1]).toBeCloseTo(1, 2);
    expect(spectrum[2]).toBeCloseTo(partials[1]!, 2);
  });

  it('respects a lower maximum frequency (low sample rates)', () => {
    const spectrum = shapeSpectrum(INSTRUMENTS.piano.layers[0]!.partials, 1000, 3000);
    expect(spectrum.length - 1).toBe(3);
  });
});

describe('levels and envelopes', () => {
  it('lifts low notes and tames very high ones', () => {
    expect(registerGain(40)).toBeCloseTo(1.2);
    expect(registerGain(67)).toBe(1);
    expect(registerGain(84)).toBeCloseTo(0.85);
  });

  it('makes higher piano notes decay faster; organ never decays', () => {
    const piano = INSTRUMENTS.piano;
    const body = piano.layers[1]!;
    expect(layerDecay(piano, body, 60)).toBeCloseTo(body.decay);
    expect(layerDecay(piano, body, 84)).toBeCloseTo(body.decay / 2);
    expect(layerDecay(piano, body, 36)).toBeCloseTo(body.decay * 2);
    expect(layerDecay(INSTRUMENTS.organ, INSTRUMENTS.organ.layers[0]!, 80)).toBe(Infinity);
  });

  it('keeps every instrument sustained enough for long choir notes', () => {
    for (const id of INSTRUMENT_IDS) {
      const spec = INSTRUMENTS[id];
      const sustain = Math.max(...spec.layers.map((l) => l.sustain * l.level));
      expect(sustain).toBeGreaterThan(0.2);
      for (const l of spec.layers) expect(l.attack).toBeGreaterThan(0.002); // no click on attack
      expect(spec.release).toBeGreaterThan(0.02); // no click on release
    }
  });
});
