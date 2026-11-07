import { describe, expect, it } from 'vitest';
import { buildSequence, formatSolfa, parseSolfa, VOICE_IDS } from '../core';
import type { NoteEvent, VoiceId } from '../core';
import { encodeShare } from '../storage/share';
import { listSamples } from './index';

/** Written ranges of SOLFA_FORMAT §6 / the agent brief, as MIDI numbers. */
const RANGES: Record<VoiceId, [number, number]> = {
  S: [60, 79], // C4–G5
  A: [55, 74], // G3–D5
  T: [48, 67], // C3–G4
  B: [40, 60], // E2–C4
};

/** Pitch of each voice sounding at `beat` (undefined = silent). */
function sounding(events: NoteEvent[], beat: number): Partial<Record<VoiceId, number>> {
  const out: Partial<Record<VoiceId, number>> = {};
  for (const e of events) {
    if (e.startBeat <= beat + 1e-9 && beat < e.startBeat + e.durationBeats - 1e-9) out[e.voice] = e.midi;
  }
  return out;
}

/** Consecutive perfect 5ths / octaves / unisons between two voices that both move. */
function parallelFifthsAndOctaves(events: NoteEvent[]): string[] {
  const times = [...new Set(events.map((e) => e.startBeat))].sort((a, b) => a - b);
  const problems: string[] = [];
  for (let k = 1; k < times.length; k++) {
    const t0 = times[k - 1] ?? 0;
    const t1 = times[k] ?? 0;
    const a = sounding(events, t0);
    const b = sounding(events, t1);
    for (let i = 0; i < VOICE_IDS.length; i++) {
      for (let j = i + 1; j < VOICE_IDS.length; j++) {
        const vi = VOICE_IDS[i] as VoiceId;
        const vj = VOICE_IDS[j] as VoiceId;
        const [p0, q0, p1, q1] = [a[vi], a[vj], b[vi], b[vj]];
        if (p0 === undefined || q0 === undefined || p1 === undefined || q1 === undefined) continue;
        if (p0 === p1 || q0 === q1) continue;
        const i0 = (((p0 - q0) % 12) + 12) % 12;
        const i1 = (((p1 - q1) % 12) + 12) % 12;
        if (i0 === i1 && (i0 === 0 || i0 === 7)) problems.push(`${vi}-${vj} beat ${t0}→${t1}`);
      }
    }
  }
  return problems;
}

describe('listSamples', () => {
  const samples = listSamples();

  it('lists three original songs with unique ids', () => {
    expect(samples).toHaveLength(3);
    expect(new Set(samples.map((s) => s.id)).size).toBe(3);
  });

  it('returns copies', () => {
    const first = listSamples()[0];
    if (first) first.title = 'changed';
    expect(listSamples()[0]?.title).not.toBe('changed');
  });

  describe.each(samples.map((s) => [s.id, s] as const))('%s', (_id, sample) => {
    const { song, diagnostics } = parseSolfa(sample.text);
    const seq = buildSequence(song);

    it('parses with zero diagnostics and its title', () => {
      expect(diagnostics).toEqual([]);
      expect(song.title).toBe(sample.title);
      expect(song.voices).toEqual(['S', 'A', 'T', 'B']);
    });

    it('has all four voices with equal beats in every system', () => {
      for (const sys of song.systems) {
        for (const v of VOICE_IDS) expect(sys.lines[v]?.beats.length).toBe(sys.beatCount);
      }
    });

    it('is already in canonical form', () => {
      expect(formatSolfa(sample.text)).toBe(sample.text);
    });

    it('keeps every voice in its range', () => {
      for (const e of seq.events) {
        const [lo, hi] = RANGES[e.voice];
        expect(e.midi, `${e.voice} at beat ${e.startBeat}`).toBeGreaterThanOrEqual(lo);
        expect(e.midi, `${e.voice} at beat ${e.startBeat}`).toBeLessThanOrEqual(hi);
      }
    });

    it('fits in a share link of less than 2000 characters', async () => {
      expect((await encodeShare(sample.text)).length).toBeLessThan(1900);
    });
  });

  describe.each(samples.filter((s) => s.id !== 'sample-warm-up').map((s) => [s.id, s] as const))(
    '%s voice leading',
    (_id, sample) => {
      const seq = buildSequence(parseSolfa(sample.text).song);
      const times = [...new Set(seq.events.map((e) => e.startBeat))];

      it('has no parallel fifths or octaves', () => {
        expect(parallelFifthsAndOctaves(seq.events)).toEqual([]);
      });

      it('has no voice crossing and close upper spacing', () => {
        for (const t of times) {
          const p = sounding(seq.events, t);
          const [s, a, tn, b] = [p.S ?? 0, p.A ?? 0, p.T ?? 0, p.B ?? 0];
          expect(s >= a && a >= tn && tn >= b, `beat ${t}`).toBe(true);
          expect(s - a, `S-A at beat ${t}`).toBeLessThanOrEqual(12);
          expect(a - tn, `A-T at beat ${t}`).toBeLessThanOrEqual(12);
        }
      });
    },
  );

  it('has the requested shapes', () => {
    const [warm, chorale, waltz] = samples.map((s) => parseSolfa(s.text).song);
    expect(warm?.key.name).toBe('C');
    expect(chorale?.key.name).toBe('G');
    expect(chorale?.time?.beats).toBe(4);
    const choraleBars = buildSequence(chorale ?? parseSolfa('').song).bars;
    expect(choraleBars.length).toBeGreaterThanOrEqual(8);
    expect(choraleBars.length).toBeLessThanOrEqual(16);
    expect(waltz?.key.name).toBe('F');
    expect(waltz?.time?.beats).toBe(3);
    const waltzSeq = buildSequence(waltz ?? parseSolfa('').song);
    expect(waltzSeq.bars[0]?.number).toBe(0); // pick-up
    const dotted = waltzSeq.events.filter((e) => e.voice === 'S' && Math.abs(e.durationBeats - 0.75) < 1e-9);
    expect(dotted.length).toBeGreaterThanOrEqual(2);
  });
});
