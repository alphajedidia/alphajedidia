import { describe, expect, it } from 'vitest';
import type { NoteEvent, Sequence } from '../core';
import { encodeVlq, exportMidi, MIDI_PPQ } from './export';

function ev(voice: NoteEvent['voice'], midi: number, startBeat: number, durationBeats: number): NoteEvent {
  return { voice, midi, startBeat, durationBeats, bar: 1 };
}

const SATB: Sequence = {
  events: [
    ev('S', 67, 0, 1),
    ev('S', 67, 1, 1), // repeated pitch: off and on on the same tick
    ev('A', 64, 0, 2),
    ev('T', 60, 0, 1.5),
    ev('B', 48, 0, 0.5),
    ev('B', 43, 0.5, 1.5),
  ],
  totalBeats: 2,
  bars: [{ number: 1, startBeat: 0, system: 0 }],
  beatsPerBar: 3,
  voices: ['S', 'A', 'T', 'B'],
};

interface Chunk {
  id: string;
  data: Uint8Array;
}

function readVlq(data: Uint8Array, pos: number): [number, number] {
  let value = 0;
  for (;;) {
    const b = data[pos++]!;
    value = value * 128 + (b & 0x7f);
    if (!(b & 0x80)) return [value, pos];
  }
}

function chunks(bytes: Uint8Array): Chunk[] {
  const out: Chunk[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let pos = 0; pos < bytes.length; ) {
    const id = String.fromCharCode(...bytes.subarray(pos, pos + 4));
    const len = view.getUint32(pos + 4);
    out.push({ id, data: bytes.subarray(pos + 8, pos + 8 + len) });
    pos += 8 + len;
  }
  return out;
}

interface Ev {
  tick: number;
  bytes: number[];
}

/** Decode a track (no running status: the writer never uses it). */
function events(track: Uint8Array): Ev[] {
  const out: Ev[] = [];
  let tick = 0;
  for (let pos = 0; pos < track.length; ) {
    const [delta, p] = readVlq(track, pos);
    tick += delta;
    pos = p;
    const status = track[pos]!;
    if (status === 0xff) {
      const [len, q] = readVlq(track, pos + 2);
      out.push({ tick, bytes: [...track.subarray(pos, q + len)] });
      pos = q + len;
    } else {
      const size = (status & 0xf0) === 0xc0 ? 2 : 3;
      out.push({ tick, bytes: [...track.subarray(pos, pos + size)] });
      pos += size;
    }
  }
  return out;
}

function trackName(track: Uint8Array): string {
  const name = events(track).find((e) => e.bytes[0] === 0xff && e.bytes[1] === 0x03)!;
  return new TextDecoder().decode(new Uint8Array(name.bytes.slice(3)));
}

describe('encodeVlq', () => {
  it('encodes MIDI variable-length quantities', () => {
    expect(encodeVlq(0)).toEqual([0x00]);
    expect(encodeVlq(0x40)).toEqual([0x40]);
    expect(encodeVlq(0x7f)).toEqual([0x7f]);
    expect(encodeVlq(0x80)).toEqual([0x81, 0x00]);
    expect(encodeVlq(480)).toEqual([0x83, 0x60]);
    expect(encodeVlq(0x2000)).toEqual([0xc0, 0x00]);
    expect(encodeVlq(0x3fff)).toEqual([0xff, 0x7f]);
    expect(encodeVlq(0x4000)).toEqual([0x81, 0x80, 0x00]);
    expect(encodeVlq(0x200000)).toEqual([0x81, 0x80, 0x80, 0x00]);
    expect(encodeVlq(0x0fffffff)).toEqual([0xff, 0xff, 0xff, 0x7f]);
    expect(encodeVlq(-5)).toEqual([0]);
  });
});

describe('exportMidi', () => {
  const bytes = exportMidi(SATB, { tempo: 120, title: 'Hira fiderana' });
  const all = chunks(bytes);

  it('writes an MThd header: format 1, conductor + 4 tracks, 480 PPQ', () => {
    expect([...bytes.subarray(0, 4)]).toEqual([0x4d, 0x54, 0x68, 0x64]); // "MThd"
    expect([...bytes.subarray(4, 14)]).toEqual([0, 0, 0, 6, 0, 1, 0, 5, 0x01, 0xe0]);
    expect(MIDI_PPQ).toBe(480);
    expect(all.map((c) => c.id)).toEqual(['MThd', 'MTrk', 'MTrk', 'MTrk', 'MTrk', 'MTrk']);
  });

  it('puts title, time signature and tempo in track 0', () => {
    const conductor = events(all[1]!.data);
    expect(trackName(all[1]!.data)).toBe('Hira fiderana');
    expect(conductor).toContainEqual({ tick: 0, bytes: [0xff, 0x58, 0x04, 3, 2, 24, 8] });
    // 120 BPM = 500 000 µs per quarter = 0x07A120
    expect(conductor).toContainEqual({ tick: 0, bytes: [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20] });
    expect(conductor.at(-1)!.bytes).toEqual([0xff, 0x2f, 0x00]);
  });

  it('writes one named track per voice with its channel and the piano program', () => {
    const names = all.slice(2).map((c) => trackName(c.data));
    expect(names).toEqual(['Soprano', 'Alto', 'Tenor', 'Bass']);
    all.slice(2).forEach((c, ch) => {
      const evs = events(c.data);
      expect(evs).toContainEqual({ tick: 0, bytes: [0xc0 | ch, 0] });
      for (const e of evs) if (e.bytes[0]! < 0xf0) expect(e.bytes[0]! & 0x0f).toBe(ch);
      expect(evs.at(-1)!.bytes).toEqual([0xff, 0x2f, 0x00]);
    });
  });

  it('writes note on/off at the right ticks, offs before ons on the same tick', () => {
    const soprano = events(all[2]!.data).filter((e) => (e.bytes[0]! & 0xe0) === 0x80);
    expect(soprano).toEqual([
      { tick: 0, bytes: [0x90, 67, 88] },
      { tick: 480, bytes: [0x80, 67, 64] },
      { tick: 480, bytes: [0x90, 67, 88] },
      { tick: 960, bytes: [0x80, 67, 64] },
    ]);
    const bass = events(all[5]!.data).filter((e) => (e.bytes[0]! & 0xe0) === 0x80);
    expect(bass).toEqual([
      { tick: 0, bytes: [0x93, 48, 88] },
      { tick: 240, bytes: [0x83, 48, 64] },
      { tick: 240, bytes: [0x93, 43, 88] },
      { tick: 960, bytes: [0x83, 43, 64] },
    ]);
    // The raw delta of the tenor note-off (1.5 beats = 720 ticks) is a 2-byte VLQ.
    const tenor = all[4]!.data;
    const off = [0x85, 0x50, 0x82, 60, 64];
    expect(tenor.join(',')).toContain(off.join(','));
  });

  it('exports only the voices present, and skips the title when absent', () => {
    const seq: Sequence = { ...SATB, events: [ev('T', 57, 0, 1)], voices: ['T'] };
    const out = chunks(exportMidi(seq, { tempo: 60 }));
    expect(out).toHaveLength(3);
    expect(trackName(out[2]!.data)).toBe('Tenor');
    expect(events(out[2]!.data)).toContainEqual({ tick: 0, bytes: [0x92, 57, 88] });
    expect(events(out[1]!.data).some((e) => e.bytes[1] === 0x03)).toBe(false);
    // 60 BPM = 1 000 000 µs = 0x0F4240
    expect(events(out[1]!.data)).toContainEqual({ tick: 0, bytes: [0xff, 0x51, 0x03, 0x0f, 0x42, 0x40] });
  });
});
