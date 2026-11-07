/**
 * Bar logic shared by the parser (time inference) and the sequencer (bar list), §7.
 */
import { VOICE_IDS } from './model';
import type { Song, VoiceId, VoiceLine } from './model';

/** A voice line together with the system it belongs to. */
export interface PlacedLine {
  system: number;
  line: VoiceLine;
}

/** The lines of one voice, in song order. */
export function linesOfVoice(song: Song, voice: VoiceId): PlacedLine[] {
  const out: PlacedLine[] = [];
  song.systems.forEach((sys, system) => {
    const line = sys.lines[voice];
    if (line) out.push({ system, line });
  });
  return out;
}

/** First voice present in a system, in score order (the reference for bar lines). */
export function referenceVoice(lines: Partial<Record<VoiceId, VoiceLine>>): VoiceId | undefined {
  return VOICE_IDS.find((v) => lines[v] !== undefined);
}

/**
 * Beats per bar from the first complete bar of the first voice (a bar that starts with a bar
 * line and is closed by the next one). Undefined when the song has no complete bar.
 */
export function inferBeatsPerBar(song: Song): number | undefined {
  const voice = song.voices[0] ?? VOICE_IDS.find((v) => song.systems.some((s) => s.lines[v]));
  if (!voice) return undefined;
  let count = -1; // -1 = no bar started yet
  let closedPrev = false;
  for (const { line } of linesOfVoice(song, voice)) {
    for (let k = 0; k < line.beats.length; k++) {
      const beat = line.beats[k];
      const startsBar = beat?.accent === 'bar' || (k === 0 && closedPrev);
      if (startsBar) {
        if (count > 0) return count;
        count = 0;
      }
      if (count >= 0) count++;
    }
    closedPrev = line.endsWithBar === true;
    if (closedPrev && count > 0) return count;
  }
  return undefined;
}
