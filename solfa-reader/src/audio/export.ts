// Exports (B-08): a Standard MIDI File written by hand, and a WAV practice file rendered with
// the same synthesiser as the live player (OfflineAudioContext).
import type { NoteEvent, Sequence, VoiceId } from '../core';
import { completeMix, computeVoiceGains, MIX_VOICES } from './mix';
import { clampTempo, soundingDuration } from './beats';
import { createVoiceBuses, startNote } from './synth';
import type { RenderOptions } from './types';
import { encodeWav, normalizePeak } from './wav';

/** Ticks per quarter note (one sol-fa beat = one quarter note in the file). */
export const MIDI_PPQ = 480;
const VELOCITY = 88;
const MIDI_CHANNEL: Readonly<Record<VoiceId, number>> = { S: 0, A: 1, T: 2, B: 3 };
const TRACK_NAME: Readonly<Record<VoiceId, string>> = { S: 'Soprano', A: 'Alto', T: 'Tenor', B: 'Bass' };

/** MIDI variable-length quantity (7 bits per byte, high bit = "more bytes follow"). */
export function encodeVlq(value: number): number[] {
  let v = Math.min(0x0fffffff, Math.max(0, Math.floor(value)));
  const bytes = [v & 0x7f];
  v = Math.floor(v / 128);
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  return bytes;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function u16(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

function ascii(text: string): number[] {
  return Array.from(text, (c) => c.charCodeAt(0) & 0x7f);
}

function meta(type: number, data: readonly number[]): number[] {
  return [0xff, type, ...encodeVlq(data.length), ...data];
}

function chunk(id: string, body: readonly number[]): number[] {
  return [...ascii(id), ...u32(body.length), ...body];
}

interface TrackEvent {
  tick: number;
  /** Same tick: lower first (meta 0, note-off 1, note-on 2) so repeated pitches re-strike. */
  order: number;
  data: number[];
}

function track(events: TrackEvent[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [];
  let last = 0;
  for (const e of events) {
    body.push(...encodeVlq(e.tick - last), ...e.data);
    last = e.tick;
  }
  body.push(0, ...meta(0x2f, [])); // end of track
  return chunk('MTrk', body);
}

/** Voices to export: the sequence's voices plus any voice that has notes, in S A T B order. */
function exportVoices(seq: Sequence): VoiceId[] {
  const present = new Set<VoiceId>(seq.voices);
  for (const e of seq.events) present.add(e.voice);
  return MIX_VOICES.filter((v) => present.has(v));
}

function noteEvents(events: readonly NoteEvent[], channel: number): TrackEvent[] {
  const out: TrackEvent[] = [];
  for (const e of events) {
    if (!(e.durationBeats > 0)) continue;
    const pitch = Math.min(127, Math.max(0, Math.round(e.midi)));
    const on = Math.max(0, Math.round(e.startBeat * MIDI_PPQ));
    const off = Math.max(on + 1, Math.round((e.startBeat + e.durationBeats) * MIDI_PPQ));
    out.push({ tick: on, order: 2, data: [0x90 | channel, pitch, VELOCITY] });
    out.push({ tick: off, order: 1, data: [0x80 | channel, pitch, 64] });
  }
  return out;
}

/**
 * Standard MIDI File type 1 at 480 PPQ: track 0 holds title, time signature and tempo; then one
 * track per voice ("Soprano"…), channel S=0 A=1 T=2 B=3, program 0 (piano).
 */
export function exportMidi(seq: Sequence, opts: { tempo: number; title?: string }): Uint8Array<ArrayBuffer> {
  const usPerBeat = Math.round(60_000_000 / clampTempo(opts.tempo));
  const beatsPerBar = Math.min(255, Math.max(1, Math.round(seq.beatsPerBar) || 4));
  const conductor: TrackEvent[] = [];
  if (opts.title) conductor.push({ tick: 0, order: 0, data: meta(0x03, [...new TextEncoder().encode(opts.title)]) });
  conductor.push({ tick: 0, order: 0, data: meta(0x58, [beatsPerBar, 2, 24, 8]) });
  conductor.push({ tick: 0, order: 0, data: meta(0x51, u32(usPerBeat).slice(1)) });
  const tracks = [track(conductor)];
  for (const voice of exportVoices(seq)) {
    const ch = MIDI_CHANNEL[voice];
    tracks.push(
      track([
        { tick: 0, order: 0, data: meta(0x03, ascii(TRACK_NAME[voice])) },
        { tick: 0, order: 0, data: [0xc0 | ch, 0] },
        ...noteEvents(
          seq.events.filter((e) => e.voice === voice),
          ch,
        ),
      ]),
    );
  }
  const header = chunk('MThd', [...u16(1), ...u16(tracks.length), ...u16(MIDI_PPQ)]);
  const bytes = new Uint8Array(header.length + tracks.reduce((n, t) => n + t.length, 0));
  bytes.set(header, 0);
  let offset = header.length;
  for (const t of tracks) {
    bytes.set(t, offset);
    offset += t.length;
  }
  return bytes;
}

/** Silence before the first note and after the last one (release tails), in seconds. */
const LEAD_SECONDS = 0.05;
const TAIL_SECONDS = 1.2;
/** Notes are created this many seconds of music at a time (keeps long renders light). */
const CHUNK_SECONDS = 8;

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

function offlineCtor(): OfflineCtor | null {
  const g = globalThis as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  return g.OfflineAudioContext ?? g.webkitOfflineAudioContext ?? null;
}

/**
 * Render the sequence with the given instrument and mix to a mono 16-bit WAV (default
 * 22050 Hz), normalised to -1 dBFS. Rejects when the browser has no OfflineAudioContext.
 */
export async function renderWav(seq: Sequence, opts: RenderOptions): Promise<Blob> {
  const Ctor = offlineCtor();
  if (!Ctor) throw new Error('OfflineAudioContext is not available in this browser');
  const sampleRate = Math.round(opts.sampleRate ?? 22050);
  const secondsPerBeat = 60 / clampTempo(opts.tempo);
  const seconds = LEAD_SECONDS + Math.max(0, seq.totalBeats) * secondsPerBeat + TAIL_SECONDS;
  const ctx = new Ctor(1, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  const gains = computeVoiceGains(completeMix(opts.mix), null, null);
  const buses = createVoiceBuses(ctx, gains);
  const notes = seq.events
    .filter((e) => e.durationBeats > 0 && gains[e.voice] > 0)
    .map((e) => ({
      voice: e.voice,
      midi: Math.min(127, Math.max(0, Math.round(e.midi))),
      time: LEAD_SECONDS + e.startBeat * secondsPerBeat,
      duration: soundingDuration(e.durationBeats * secondsPerBeat),
    }))
    .sort((a, b) => a.time - b.time);
  let next = 0;
  const scheduleUntil = (limit: number) => {
    for (; next < notes.length && notes[next]!.time < limit; next++) {
      const n = notes[next]!;
      startNote(ctx, buses.voices[n.voice], opts.instrument, n.midi, n.time, n.duration);
    }
  };
  if (typeof (ctx as { suspend?: unknown }).suspend === 'function') {
    // Create the nodes of each 8 s block one second before it plays (no thousands of idle nodes).
    scheduleUntil(CHUNK_SECONDS);
    for (let k = 1; k * CHUNK_SECONDS < seconds; k++) {
      const limit = (k + 1) * CHUNK_SECONDS;
      void ctx.suspend(k * CHUNK_SECONDS - 1).then(() => {
        scheduleUntil(limit);
        return ctx.resume();
      });
    }
  } else {
    scheduleUntil(Infinity);
  }
  const buffer = await ctx.startRendering();
  const samples = buffer.getChannelData(0);
  normalizePeak(samples);
  return new Blob([encodeWav(samples, sampleRate)], { type: 'audio/wav' });
}
