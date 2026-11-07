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
  /** Closing separator after the last beat: "|", "||" (end of song) or "" (open line). */
  endSep: string;
}

/** Top voice present in a system (bars are read on it, like the sequencer). */
function referenceLine(song: Song, system: Song['systems'][number]) {
  const voice = song.voices.find((v) => system.lines[v]);
  return voice ? system.lines[voice] : undefined;
}

/**
 * Turn a parsed Song into display rows. Bar numbers follow ADR-021, like the sequencer: bars
 * are read on the top voice; a beat starts a bar after `|`, or at the start of a system whose
 * previous line ended with a bar line; beats before the first bar line are bar 0 (pick-up);
 * a song without any bar line gets regular bars of `time.beats` (default 4).
 */
export function buildScoreModel(song: Song): ScoreSystemModel[] {
  const lastIndex = song.systems.length - 1;
  const anyBarLine = song.systems.some((sys) =>
    Object.values(sys.lines).some((line) => line?.beats.some((b) => b.accent === 'bar')),
  );
  const beatsPerBar = Math.max(1, song.time?.beats ?? 4);
  let bar = 0;
  let previousEndedWithBar = false;

  return song.systems.map((system, index) => {
    const voices = song.voices.filter((v) => system.lines[v]);
    const isLast = index === lastIndex;
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

    const reference = referenceLine(song, system);
    const refBeats = reference?.beats ?? [];
    const bars: ScoreBarMark[] = [];
    const barAt: number[] = [];
    for (let col = 0; col < system.beatCount; col++) {
      const absolute = system.startBeat + col;
      const accent = refBeats[col]?.accent;
      const starts = anyBarLine
        ? accent === 'bar' || (col === 0 && index > 0 && accent === 'none' && previousEndedWithBar)
        : absolute % beatsPerBar === 0;
      if (starts) {
        bar += 1;
        bars.push({ col, bar, beat: absolute });
      }
      barAt.push(bar);
    }
    const hasBarLines = refBeats.some((b) => b.accent === 'bar');
    const endsWithBar = reference?.endsWithBar ?? hasBarLines;
    previousEndedWithBar = endsWithBar;

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
      endSep: endsWithBar ? (isLast ? '||' : '|') : '',
    };
  });
}
