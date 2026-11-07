import type { Song, VoiceId } from '../../core';
import { beatText, separatorFor } from './beatText';

/** One beat cell as displayed. */
export interface ScoreCell {
  /** Absolute beat index from the song start. */
  beat: number;
  sep: string;
  text: string;
}

export interface ScoreRow {
  voice: VoiceId;
  cells: ScoreCell[];
}

/** A bar number shown above the column where the bar starts. */
export interface ScoreBarMark {
  /** Column inside the system (0-based). */
  col: number;
  /** 1-based bar number. */
  bar: number;
  /** Absolute beat where the bar starts. */
  beat: number;
}

export interface ScoreSystemModel {
  index: number;
  startBeat: number;
  beatCount: number;
  rows: ScoreRow[];
  bars: ScoreBarMark[];
  /** Bar number in force at each column (0 = pick-up). */
  barAt: number[];
  words: string[];
  /** True when the key differs from the previous system (shown as "Do = …"). */
  keyChanged: boolean;
  /** Closing separator drawn after the last beat: "|", "||" (end of song) or "". */
  endSep: string;
}

/**
 * Turn a parsed Song into display rows. Bars are counted on the top voice of each system,
 * like the sequencer: a pick-up before the first `|` is bar 0.
 */
export function buildScoreModel(song: Song): ScoreSystemModel[] {
  let bar = 0;
  const lastIndex = song.systems.length - 1;
  return song.systems.map((system, index) => {
    const voices = song.voices.filter((v) => system.lines[v]);
    const rows: ScoreRow[] = voices.map((voice) => {
      const beats = system.lines[voice]?.beats ?? [];
      const cells: ScoreCell[] = [];
      for (let col = 0; col < system.beatCount; col++) {
        const beat = beats[col];
        cells.push({
          beat: system.startBeat + col,
          sep: beat ? separatorFor(beat.accent) : '',
          text: beat ? beatText(beat) : '',
        });
      }
      return { voice, cells };
    });

    const reference = voices[0] ? (system.lines[voices[0]]?.beats ?? []) : [];
    const bars: ScoreBarMark[] = [];
    const barAt: number[] = [];
    let hasBarLines = false;
    for (let col = 0; col < system.beatCount; col++) {
      if (reference[col]?.accent === 'bar') {
        bar += 1;
        hasBarLines = true;
        bars.push({ col, bar, beat: system.startBeat + col });
      }
      barAt.push(bar);
    }

    const previous = index > 0 ? song.systems[index - 1] : undefined;
    return {
      index,
      startBeat: system.startBeat,
      beatCount: system.beatCount,
      rows,
      bars,
      barAt,
      words: system.words,
      keyChanged: previous !== undefined && previous.key.tonic !== system.key.tonic,
      endSep: index === lastIndex ? '||' : hasBarLines ? '|' : '',
    };
  });
}
