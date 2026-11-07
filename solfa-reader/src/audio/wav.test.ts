import { describe, expect, it } from 'vitest';
import { encodeWav, normalizePeak, WAV_TARGET_PEAK } from './wav';

const text = (b: Uint8Array, from: number) => String.fromCharCode(...b.subarray(from, from + 4));

describe('encodeWav', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2, Number.NaN]);
  const bytes = encodeWav(samples, 22050);
  const view = new DataView(bytes.buffer);

  it('writes a 44-byte RIFF/WAVE PCM mono 16-bit header', () => {
    expect(bytes.length).toBe(44 + samples.length * 2);
    expect(text(bytes, 0)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
    expect(text(bytes, 8)).toBe('WAVE');
    expect(text(bytes, 12)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint32(28, true)).toBe(44100);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(bytes, 36)).toBe('data');
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
  });

  it('converts samples to little-endian int16, clipping out-of-range values', () => {
    const pcm = Array.from({ length: samples.length }, (_, i) => view.getInt16(44 + i * 2, true));
    expect(pcm).toEqual([0, 16384, -16384, 32767, -32768, 32767, -32768, 0]);
  });

  it('handles an empty buffer', () => {
    expect(encodeWav(new Float32Array(0), 8000).length).toBe(44);
  });
});

describe('normalizePeak', () => {
  it('scales the loudest sample to the target', () => {
    const s = new Float32Array([0.1, -0.4, 0.2]);
    const gain = normalizePeak(s);
    expect(gain).toBeCloseTo(WAV_TARGET_PEAK / 0.4);
    expect(Math.max(...s.map(Math.abs))).toBeCloseTo(WAV_TARGET_PEAK);
    expect(s[0]! / s[2]!).toBeCloseTo(0.5); // relative mix kept
  });

  it('leaves silence untouched', () => {
    const s = new Float32Array(4);
    expect(normalizePeak(s)).toBe(1);
    expect([...s]).toEqual([0, 0, 0, 0]);
  });
});
