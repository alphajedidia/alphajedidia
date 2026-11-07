/**
 * Hand-made Song fixtures for the Gallery and the UI tests.
 *
 * NOT the real parser (that is core/parseSolfa, solfa-backend): a tiny, forgiving reader for the
 * well-formed snippets below, so the design system can be developed and tested independently.
 */
import type {
  Accent,
  BeatPart,
  Beat,
  Degree,
  KeySignature,
  Song,
  SolfaItem,
  System,
  VoiceId,
  VoiceLine,
} from '../core';

const NOTE_LETTERS = 'drmfslt';
const TONICS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function keyOf(name: string): KeySignature {
  const letter = name.charAt(0).toUpperCase();
  let tonic = TONICS[letter] ?? 0;
  if (name.includes('#')) tonic += 1;
  if (name.length > 1 && name.charAt(1) === 'b') tonic -= 1;
  return { tonic: (tonic + 12) % 12, name: name.replace('b', '♭') };
}

interface Token {
  item: SolfaItem;
  /** Division mark written before it: '' (start), '.', '.,' or ','. */
  mark: string;
}

/** Parse the text of one beat ("d.,r", "s,", "-.m", "") into parts. */
export function fixtureBeatParts(raw: string): BeatPart[] {
  const text = raw.replace(/\{[^}]*\}/g, '').trim();
  const tokens: Token[] = [];
  let mark = '';
  let i = 0;
  const push = (item: SolfaItem) => {
    tokens.push({ item, mark: tokens.length === 0 ? '' : mark });
    mark = '';
  };
  while (i < text.length) {
    const c = text.charAt(i);
    if (c === ' ') {
      i += 1;
    } else if (c === '.' || c === ',') {
      if (tokens.length === 0) push({ kind: 'rest' });
      if (c === '.' && text.charAt(i + 1) === ',') {
        mark = '.,';
        i += 2;
      } else {
        mark = c;
        i += 1;
      }
    } else if (c === '-') {
      push({ kind: 'hold' });
      i += 1;
    } else if (NOTE_LETTERS.includes(c)) {
      const start = i;
      i += 1;
      let alter: -1 | 0 | 1 = 0;
      const next = text.charAt(i);
      if ('eiao'.includes(next) && next !== '') {
        alter = c === 't' && next === 'e' ? -1 : 'ei'.includes(next) ? 1 : -1;
        i += 1;
      }
      let octave = 0;
      while (text.charAt(i) === "'") {
        octave += 1;
        i += 1;
      }
      let commas = 0;
      while (text.charAt(i + commas) === ',') commas += 1;
      const after = text.charAt(i + commas);
      // A comma directly followed by a note or hold is a division (comma rule 2).
      const divisionComma = commas > 0 && (NOTE_LETTERS.includes(after) && after !== '' || after === '-');
      const octaveCommas = divisionComma ? commas - 1 : commas;
      octave -= octaveCommas;
      i += octaveCommas;
      const noteText = text.slice(start, i);
      push({ kind: 'note', degree: c as Degree, alter, octave, text: noteText });
      if (divisionComma) {
        mark = ',';
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  if (tokens.length === 0) return [{ item: { kind: 'rest' }, start: 0, length: 1 }];

  const commaCount = tokens.filter((t) => t.mark === ',').length;
  const triplet = commaCount === 2 && tokens.length === 3 && !tokens.some((t) => t.mark.startsWith('.'));
  const starts = tokens.map((t, idx) => {
    if (idx === 0) return 0;
    if (triplet) return idx / 3;
    if (t.mark === '.') return 0.5;
    if (t.mark === '.,') return 0.75;
    return -1; // ',' resolved below
  });
  for (let k = 1; k < starts.length; k++) {
    if (starts[k] === -1) starts[k] = (starts[k - 1] ?? 0) < 0.5 ? 0.25 : 0.75;
  }
  return tokens.map((t, idx) => {
    const start = starts[idx] ?? 0;
    const end = idx + 1 < starts.length ? (starts[idx + 1] ?? 1) : 1;
    return { item: t.item, start, length: end - start };
  });
}

const ACCENTS: Record<string, Accent> = { '|': 'bar', '||': 'bar', '!': 'medium', ':': 'weak' };

/** Split a voice line ("| d :r |") into beats with their accents. */
export function fixtureBeats(line: string): Beat[] {
  const pieces = line.split(/(\|\||\||!|:)/);
  const beats: Beat[] = [];
  let accent: Accent = 'none';
  pieces.forEach((piece, idx) => {
    const sep = ACCENTS[piece];
    if (sep) {
      accent = sep;
      return;
    }
    const isFirst = idx === 0;
    const isLast = idx === pieces.length - 1;
    if (piece.trim() === '' && (isFirst || isLast)) return;
    beats.push({ parts: fixtureBeatParts(piece), accent });
    accent = 'none';
  });
  return beats;
}

const LABEL = /^(S|A|T|B)\s*[:.=]\s/;

/**
 * Build a Song from well-formed .solfa text (headers title/key/time/tempo, labelled voice
 * lines, W: lines, blank lines between systems).
 */
export function songFromText(text: string): Song {
  const song: Song = {
    title: 'Untitled',
    key: keyOf('C'),
    tempo: 90,
    voices: [],
    systems: [],
    meta: {},
  };
  let key = song.key;
  let current: System | null = null;
  let startBeat = 0;
  const lines = text.split('\n');
  const close = () => {
    if (!current) return;
    startBeat += current.beatCount;
    song.systems.push(current);
    current = null;
  };
  lines.forEach((rawLine, lineNo) => {
    const line = rawLine.trim();
    if (line === '') return close();
    const header = /^(title|key|time|tempo):\s*(.+)$/.exec(line);
    if (header) {
      const value = header[2] ?? '';
      if (header[1] === 'title') song.title = value;
      if (header[1] === 'tempo') song.tempo = Number(value);
      if (header[1] === 'time') {
        const [b, u] = value.split('/');
        song.time = { beats: Number(b), unit: Number(u) };
      }
      if (header[1] === 'key') {
        key = keyOf(value);
        if (song.systems.length === 0 && !current) song.key = key;
      }
      return;
    }
    if (!current) current = { lines: {}, words: [], key, startBeat, beatCount: 0 };
    const sys: System = current;
    if (line.startsWith('W:')) {
      sys.words.push(line.slice(2).trim());
      return;
    }
    const label = LABEL.exec(line);
    const voice = (label?.[1] ?? 'S') as VoiceId;
    const voiceLine: VoiceLine = {
      voice,
      beats: fixtureBeats(label ? line.slice(label[0].length) : line),
      line: lineNo,
    };
    sys.lines[voice] = voiceLine;
    sys.beatCount = Math.max(sys.beatCount, voiceLine.beats.length);
    if (!song.voices.includes(voice)) song.voices.push(voice);
  });
  close();
  return song;
}

/** SOLFA_FORMAT.md §1 example (SATB, 4/4, two systems). */
export const DEMO_SONG_TEXT = `title: Hira fiderana (example)
key: G
time: 4/4
tempo: 84

S: | m  :m  :f  :s  | s  :f  :m  :r  |
A: | d  :d  :d  :t, | d  :r  :d  :t, |
T: | s  :s  :l  :s  | s  :l  :s  :s  |
B: | d  :d  :f, :s, | m, :r, :d, :s, |
W: Ry To-mpo ô, de-ra-in-ay i-an-ao

S: | d' :t  :l  :s  | s  :-  :-  :-  ||
A: | m  :r  :d  :d  | t, :-  :-  :-  ||
T: | s  :s  :f  :m  | r  :-  :-  :-  ||
B: | d  :s, :l, :d  | s, :-  :-  :-  ||`;

/** 3/4 with a pick-up, divided beats, a chromatic note and a key change. */
export const RHYTHM_SONG_TEXT = `title: Rhythm sampler
key: F
time: 3/4
tempo: 96

S: s, | d.,r :m   :f.m  | s   :-.l  :s    | fe  :s    :-    |
A: s, | s,.,t, :d :r.d  | m   :-.f  :m    | d   :t,   :-    |
T: m, | m.,f :s   :l.s  | d'  :-.d' :d'   | l   :s    :-    |
B: d, | d,   :d   :r    | d   :-.f, :s,   | r   :s,   :-    |
W: Sa-mbatra ny o-lo-na

key: G
S: | m,f.s :l   :t.d'  | d'  :-   :-   ||
A: | d,r.m :f   :f.m   | m   :-   :-   ||
T: | s     :d'  :r'    | d'  :-   :-   ||
B: | d     :f,  :s,    | d,  :-   :-   ||`;

/** The demo SATB song as a Song object. */
export function demoSong(): Song {
  return songFromText(DEMO_SONG_TEXT);
}

/** A song exercising divisions, pick-up, chromatics and a key change. */
export function rhythmSong(): Song {
  return songFromText(RHYTHM_SONG_TEXT);
}
