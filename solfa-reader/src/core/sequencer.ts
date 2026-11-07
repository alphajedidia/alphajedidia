import { inferBeatsPerBar, referenceVoice } from './bars';
import { VOICE_IDS } from './model';
import type { BarInfo, NoteEvent, Sequence, SequenceOptions, Song, VoiceId } from './model';
import { noteToMidi } from './pitch';

const EPS = 1e-6;

/** Bar list (§7): bar lines of the top voice of each system; a leading pick-up is bar 0. */
export function computeBars(song: Song, beatsPerBar: number): BarInfo[] {
  const bars: BarInfo[] = [];
  let number = 0;
  let closedPrev = false;
  let anyBarLine = false;
  song.systems.forEach((sys, system) => {
    const ref = referenceVoice(sys.lines);
    const line = ref ? sys.lines[ref] : undefined;
    for (let k = 0; k < sys.beatCount; k++) {
      const beat = line?.beats[k];
      if (beat?.accent === 'bar' || (k === 0 && closedPrev)) {
        anyBarLine = true;
        number++;
        bars.push({ number, startBeat: sys.startBeat + k, system });
      } else if (bars.length === 0) {
        bars.push({ number: 0, startBeat: sys.startBeat + k, system });
      }
    }
    closedPrev = line?.endsWithBar === true;
    if (closedPrev) anyBarLine = true;
  });
  if (anyBarLine) return bars;

  // No bar lines at all: make regular bars so loops and highlighting still work.
  const out: BarInfo[] = [];
  const total = totalBeatsOf(song);
  const per = Math.max(1, beatsPerBar);
  for (let start = 0, n = 1; start < total; start += per, n++) {
    const system = song.systems.findIndex((s) => start < s.startBeat + s.beatCount);
    out.push({ number: n, startBeat: start, system: Math.max(0, system) });
  }
  return out;
}

function totalBeatsOf(song: Song): number {
  return song.systems.reduce((max, s) => Math.max(max, s.startBeat + s.beatCount), 0);
}

function barAt(bars: BarInfo[], beat: number): number {
  let found = bars[0]?.number ?? 1;
  for (const bar of bars) {
    if (bar.startBeat <= beat + EPS) found = bar.number;
    else break;
  }
  return found;
}

function eventsOfVoice(song: Song, voice: VoiceId, opts: SequenceOptions | undefined): NoteEvent[] {
  const events: NoteEvent[] = [];
  let open: NoteEvent | null = null;
  const close = (): void => {
    if (open) events.push(open);
    open = null;
  };
  for (const sys of song.systems) {
    const line = sys.lines[voice];
    if (!line) {
      close();
      continue;
    }
    for (let k = 0; k < sys.beatCount; k++) {
      const beat = line.beats[k];
      if (!beat) {
        close();
        continue;
      }
      for (const part of beat.parts) {
        const start = sys.startBeat + k + part.start;
        const item = part.item;
        if (item.kind === 'note') {
          close();
          open = {
            voice,
            midi: noteToMidi(item, voice, sys.key, opts),
            startBeat: start,
            durationBeats: part.length,
            bar: 0,
          };
          if (beat.source) open.source = beat.source;
        } else if (item.kind === 'hold' && open) {
          const current: NoteEvent = open;
          if (Math.abs(current.startBeat + current.durationBeats - start) < EPS) {
            current.durationBeats = start + part.length - current.startBeat;
          } else {
            close();
          }
        } else {
          close();
        }
      }
    }
  }
  close();
  return events;
}

/** Turn a parsed song into timed note events (in beats). Pure. B-04 */
export function buildSequence(song: Song, opts?: SequenceOptions): Sequence {
  const beatsPerBar = song.time?.beats ?? inferBeatsPerBar(song) ?? 4;
  const bars = computeBars(song, beatsPerBar);
  const voices = song.voices.length > 0 ? song.voices : VOICE_IDS.filter((v) => song.systems.some((s) => s.lines[v]));
  const order = (v: VoiceId): number => VOICE_IDS.indexOf(v);
  const events = voices
    .flatMap((v) => eventsOfVoice(song, v, opts))
    .map((e) => ({ ...e, bar: barAt(bars, e.startBeat) }))
    .sort((a, b) => a.startBeat - b.startBeat || order(a.voice) - order(b.voice));
  return { events, totalBeats: totalBeatsOf(song), bars, beatsPerBar, voices };
}
