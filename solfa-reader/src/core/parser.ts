import { parseBeatText } from './beat';
import { inferBeatsPerBar } from './bars';
import { classifyLines, parseVoicesValue } from './lines';
import type { HeaderLine, VoiceLineInfo } from './lines';
import { VOICE_IDS } from './model';
import type {
  Beat,
  Diagnostic,
  KeySignature,
  ParseResult,
  Severity,
  Song,
  System,
  TimeSignature,
  VoiceId,
  VoiceLine,
} from './model';
import { parseKey } from './pitch';
import { scanMusic } from './scan';

const DEFAULT_KEY: KeySignature = { tonic: 0, name: 'C' };
const DEFAULT_TEMPO = 90;

/** Per-line data the parser needs after the line is built (not part of the model). */
interface LineMeta {
  info: VoiceLineInfo;
  /** For each beat, the column of each part's item (parallel to `beat.parts`). */
  cols: number[][];
  /** 1-based bar of each beat (undefined in a pick-up). */
  bars: Array<number | undefined>;
  barLines: number;
}

interface SystemBuilder {
  system: System;
  metas: Partial<Record<VoiceId, LineMeta>>;
}

class Collector {
  readonly list: Diagnostic[] = [];
  add(
    severity: Severity,
    code: string,
    message: string,
    line: number,
    col: number,
    endCol: number,
    extra?: { voice?: VoiceId; bar?: number },
  ): void {
    const d: Diagnostic = { severity, code, message, line, col, endCol };
    if (extra?.voice) d.voice = extra.voice;
    if (extra?.bar !== undefined && extra.bar > 0) d.bar = extra.bar;
    this.list.push(d);
  }
}

function lineSpan(raw: string, from = 0): { col: number; endCol: number } {
  const body = raw.slice(from);
  const lead = body.length - body.trimStart().length;
  return { col: from + lead, endCol: Math.max(from + lead, raw.trimEnd().length) };
}

function parseTime(value: string): TimeSignature | null {
  const v = value.trim();
  if (v === 'C') return { beats: 4, unit: 4 };
  if (v === '¢') return { beats: 2, unit: 2 };
  const m = /^(\d{1,2})(?:\s*\/\s*(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  const beats = Number(m[1]);
  const unit = m[2] === undefined ? 4 : Number(m[2]);
  if (beats < 1 || unit < 1) return null;
  return { beats, unit };
}

function parseTempo(value: string): number | null {
  const m = /\d+(?:[.,]\d+)?/.exec(value);
  if (!m) return null;
  const bpm = Math.round(Number(m[0].replace(',', '.')));
  return bpm >= 20 && bpm <= 300 ? bpm : null;
}

interface State {
  song: Song;
  key: KeySignature;
  time: TimeSignature | null;
  diags: Collector;
  builders: SystemBuilder[];
  pendingWords: string[];
  barState: Record<VoiceId, { bar: number; closed: boolean }>;
}

function applyHeader(st: State, line: HeaderLine): void {
  const { header, index, raw } = line;
  const where = header.value === '' ? lineSpan(raw) : { col: header.valueCol, endCol: header.valueEndCol };
  switch (header.field) {
    case 'title':
      if (header.value) st.song.title = header.value;
      break;
    case 'composer':
      if (header.value) st.song.composer = header.value;
      break;
    case 'lyricist':
      if (header.value) st.song.meta.lyricist = header.value;
      break;
    case 'key': {
      const key = parseKey(header.value);
      if (key) st.key = key;
      else
        st.diags.add('warning', 'bad-key', `key "${header.value}" not understood`, index, where.col, where.endCol);
      break;
    }
    case 'time': {
      const time = parseTime(header.value);
      if (time) st.time = time;
      break;
    }
    case 'tempo': {
      const bpm = parseTempo(header.value);
      if (bpm !== null) st.song.tempo = bpm;
      else
        st.diags.add('warning', 'bad-tempo', 'tempo must be a number from 20 to 300', index, where.col, where.endCol);
      break;
    }
    case 'voices':
      for (const u of parseVoicesValue(header.value, header.valueCol).unknown) {
        st.diags.add('warning', 'unknown-voice', `unknown voice "${u.word}"`, index, u.col, u.endCol);
      }
      break;
    case 'meta':
      st.song.meta[header.name] = header.value;
      break;
  }
}

function parseVoiceLine(st: State, info: VoiceLineInfo, voice: VoiceId): { line: VoiceLine; meta: LineMeta } {
  const { raw, index } = info;
  const scanned = scanMusic(raw, info.musicCol);
  const state = st.barState[voice];
  const beats: Beat[] = [];
  const cols: number[][] = [];
  const bars: Array<number | undefined> = [];
  let barLines = 0;

  for (const col of scanned.strayBraces) {
    st.diags.add('error', 'unknown-char', 'unmatched brace', index, col, col + 1, { voice });
  }
  for (const cell of scanned.cells) {
    if (!cell.isBeat) continue;
    if (cell.accent === 'bar') barLines++;
    if (cell.accent === 'bar' || (beats.length === 0 && state.closed)) state.bar++;
    const bar = state.bar > 0 ? state.bar : undefined;
    const parsed = parseBeatText(cell.masked, cell.textCol);
    for (const d of parsed.diagnostics) {
      st.diags.add(d.severity, d.code, d.message, index, d.col, d.endCol, { voice, bar });
    }
    const lead = cell.raw.length - cell.raw.trimStart().length;
    const trimmed = cell.raw.trim();
    let col = cell.textCol + lead;
    let endCol = cell.textCol + cell.raw.trimEnd().length;
    if (trimmed === '') {
      col = cell.textCol;
      endCol = cell.textCol + cell.raw.length;
      if (endCol === col && cell.sep !== '') {
        col = cell.sepCol;
        endCol = cell.sepCol + cell.sep.length;
      }
    }
    beats.push({ parts: parsed.parts, accent: cell.accent, source: { line: index, col, endCol } });
    cols.push(parsed.cols);
    bars.push(bar);
  }
  state.closed = scanned.endsWithBar;
  const line: VoiceLine = { voice, beats, line: index, endsWithBar: scanned.endsWithBar };
  return { line, meta: { info, cols, bars, barLines } };
}

function finishSystem(st: State, b: SystemBuilder): void {
  const entries = VOICE_IDS.flatMap((v) => {
    const line = b.system.lines[v];
    const meta = b.metas[v];
    return line && meta ? [{ voice: v, line, meta }] : [];
  });
  const beatCount = Math.max(0, ...entries.map((e) => e.line.beats.length));
  b.system.beatCount = beatCount;

  for (const { voice, line, meta } of entries) {
    if (line.beats.length < beatCount) {
      const span = lineSpan(meta.info.raw, meta.info.musicCol);
      st.diags.add(
        'warning',
        'beat-count-mismatch',
        `${line.beats.length} beats instead of ${beatCount}; padded with rests`,
        line.line,
        span.col,
        span.endCol,
        { voice },
      );
      while (line.beats.length < beatCount) {
        line.beats.push({ parts: [{ item: { kind: 'rest' }, start: 0, length: 1 }], accent: 'weak' });
        meta.cols.push([-1]);
        meta.bars.push(undefined);
      }
    }
  }

  // Blame the lines whose bar count differs from the most common one (ties: the top line).
  const counts = entries.map((e) => e.meta.barLines);
  const mode = counts.reduce(
    (best, c) => (counts.filter((x) => x === c).length > counts.filter((x) => x === best).length ? c : best),
    counts[0] ?? 0,
  );
  for (const { voice, line, meta } of entries) {
    if (meta.barLines !== mode) {
      const span = lineSpan(meta.info.raw, meta.info.musicCol);
      st.diags.add(
        'warning',
        'bar-count-mismatch',
        `${meta.barLines} bars instead of ${mode}`,
        line.line,
        span.col,
        span.endCol,
        { voice },
      );
    }
  }
}

/** Convert holds that have nothing to hold into rests (§5), voice by voice in song order. */
function resolveHolds(st: State): void {
  const sounding: Record<VoiceId, boolean> = { S: false, A: false, T: false, B: false };
  for (const b of st.builders) {
    for (const voice of VOICE_IDS) {
      const line = b.system.lines[voice];
      const meta = b.metas[voice];
      if (!line || !meta) {
        sounding[voice] = false;
        continue;
      }
      line.beats.forEach((beat, k) => {
        beat.parts.forEach((part, p) => {
          if (part.item.kind === 'note') sounding[voice] = true;
          else if (part.item.kind === 'rest') sounding[voice] = false;
          else if (!sounding[voice]) {
            part.item = { kind: 'rest' };
            const col = meta.cols[k]?.[p] ?? beat.source?.col ?? 0;
            st.diags.add('warning', 'hold-without-note', 'nothing to hold here', line.line, col, col + 1, {
              voice,
              bar: meta.bars[k],
            });
          }
        });
      });
    }
  }
}

function parseText(text: string): ParseResult {
  const st: State = {
    song: { title: 'Untitled', key: DEFAULT_KEY, tempo: DEFAULT_TEMPO, voices: [], systems: [], meta: {} },
    key: DEFAULT_KEY,
    time: null,
    diags: new Collector(),
    builders: [],
    pendingWords: [],
    barState: {
      S: { bar: 0, closed: false },
      A: { bar: 0, closed: false },
      T: { bar: 0, closed: false },
      B: { bar: 0, closed: false },
    },
  };
  let lastSystem = -1;

  for (const line of classifyLines(text)) {
    if (line.kind === 'words') {
      const target = st.builders[lastSystem];
      if (target) target.system.words.push(line.words);
      else st.pendingWords.push(line.words);
    } else if (line.kind === 'header') {
      applyHeader(st, line);
    } else if (line.kind === 'voice') {
      let b = st.builders[line.system];
      if (!b) {
        b = {
          system: { lines: {}, words: st.pendingWords, key: st.key, startBeat: 0, beatCount: 0 },
          metas: {},
        };
        st.pendingWords = [];
        st.builders[line.system] = b;
      }
      lastSystem = line.system;
      if (line.voice === null) {
        const span = lineSpan(line.raw);
        st.diags.add('warning', 'unknown-voice', 'more voice lines than voices; line ignored', line.index, span.col, span.endCol);
        continue;
      }
      const parsed = parseVoiceLine(st, line, line.voice);
      b.system.lines[line.voice] = parsed.line;
      b.metas[line.voice] = parsed.meta;
    }
  }

  st.builders = st.builders.filter((b): b is SystemBuilder => b !== undefined && Object.keys(b.metas).length > 0);
  for (const b of st.builders) finishSystem(st, b);
  resolveHolds(st);

  const song = st.song;
  let start = 0;
  song.systems = st.builders.map((b) => {
    b.system.startBeat = start;
    start += b.system.beatCount;
    return b.system;
  });
  song.voices = VOICE_IDS.filter((v) => song.systems.some((s) => s.lines[v] !== undefined));
  song.key = song.systems[0]?.key ?? st.key;
  if (st.time) {
    song.time = st.time;
  } else {
    const beats = inferBeatsPerBar(song);
    if (beats !== undefined) song.time = { beats, unit: 4 };
  }
  if (song.systems.length === 0) {
    st.diags.add('error', 'empty-song', 'no voice lines found', 0, 0, 0);
  }
  const diagnostics = st.diags.list
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.line - b.d.line || a.d.col - b.d.col || a.i - b.i)
    .map((x) => x.d);
  return { song, diagnostics };
}

/** Parse .solfa text (docs/SOLFA_FORMAT.md). Never throws on bad input. B-02 */
export function parseSolfa(text: string): ParseResult {
  const input = typeof text === 'string' ? text : '';
  try {
    return parseText(input);
  } catch (err) {
    // Safety net: a parser bug must never crash the editor.
    const message = err instanceof Error ? err.message : String(err);
    return {
      song: { title: 'Untitled', key: DEFAULT_KEY, tempo: DEFAULT_TEMPO, voices: [], systems: [], meta: {} },
      diagnostics: [
        { severity: 'error', code: 'internal-error', message: `parser error: ${message}`, line: 0, col: 0, endCol: 0 },
      ],
    };
  }
}
