// Pure WAV helpers for the practice-file export (B-08).

/** Peak level of the exported file (≈ -1 dBFS) so every export sounds equally loud. */
export const WAV_TARGET_PEAK = 0.89;

/** Scale samples in place so the loudest one is `target`; returns the gain used (1 if silent). */
export function normalizePeak(samples: Float32Array, target: number = WAV_TARGET_PEAK): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]!);
    if (a > peak) peak = a;
  }
  if (!(peak > 1e-4)) return 1;
  const gain = target / peak;
  for (let i = 0; i < samples.length; i++) samples[i]! *= gain;
  return gain;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Encode mono float samples (-1..1) as a 16-bit PCM RIFF/WAVE file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const rate = Math.max(1, Math.round(sampleRate));
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const raw = samples[i]!;
    const s = Number.isNaN(raw) ? 0 : Math.min(1, Math.max(-1, raw));
    view.setInt16(44 + i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }
  return new Uint8Array(buffer);
}
