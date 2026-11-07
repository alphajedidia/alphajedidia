import { describe, expect, it } from 'vitest';
import { parseSolfa, type Beat } from '../../core';
import {
  DEMO_SONG_TEXT,
  RHYTHM_SONG_TEXT,
  demoSong,
  fixtureBeatParts,
  fixtureBeats,
  rhythmSong,
  songFromText,
} from '../fixtures';
import { beatText, separatorFor } from './beatText';
import { buildScoreModel } from './scoreModel';

const beat = (text: string): Beat => ({ parts: fixtureBeatParts(text), accent: 'weak' });

describe('beatText', () => {
  // Every division example of SOLFA_FORMAT.md §5 survives fixture → parts → text.
  it.each([
    'd', 'd.r', 'd.,r', 'd,r.m', 'd.r,m', 'd,r.m,f', 'd,r,m', '.r', '-.r',
    "d'", 't,', 's,,', 'fe', 'ta', 't,.d', 'd,,r', 's,.,t,', 'm,f.s', '-', '',
  ])('round-trips %j', (text) => {
    expect(beatText(beat(text))).toBe(text);
  });

  it('reads part positions like the format says', () => {
    expect(fixtureBeatParts('d.,r').map((p) => [p.start, p.length])).toEqual([[0, 0.75], [0.75, 0.25]]);
    expect(fixtureBeatParts('d,r,m').map((p) => p.start)).toEqual([0, 1 / 3, 2 / 3]);
    expect(fixtureBeatParts('d,r.m').map((p) => p.start)).toEqual([0, 0.25, 0.5]);
    const low = fixtureBeatParts('d,,r')[0]?.item;
    expect(low?.kind === 'note' && low.octave).toBe(-1);
  });

  it('maps accents to separators', () => {
    expect(['bar', 'medium', 'weak', 'none'].map((a) => separatorFor(a as Beat['accent']))).toEqual(['|', '!', ':', '']);
  });
});

describe('fixtures', () => {
  it('splits voice lines into beats with accents (pick-up has none)', () => {
    const beats = fixtureBeats('s, | d :- :m.r |');
    expect(beats.map((b) => b.accent)).toEqual(['none', 'bar', 'weak', 'weak']);
    expect(beats.map(beatText)).toEqual(['s,', 'd', '-', 'm.r']);
  });

  it('builds the SOLFA_FORMAT §1 example', () => {
    const song = demoSong();
    expect(song.title).toBe('Hira fiderana (example)');
    expect(song.key).toEqual({ tonic: 7, name: 'G' });
    expect(song.voices).toEqual(['S', 'A', 'T', 'B']);
    expect(song.systems.map((s) => [s.startBeat, s.beatCount])).toEqual([[0, 8], [8, 8]]);
    expect(song.systems[0]?.words).toEqual(['Ry To-mpo ô, de-ra-in-ay i-an-ao']);
  });

  it('handles a key change between systems', () => {
    const song = songFromText('key: F\nS: | d :r |\n\nkey: G\nS: | m :f |');
    expect(song.key.tonic).toBe(5);
    expect(song.systems[1]?.key.tonic).toBe(7);
  });
});

describe('buildScoreModel', () => {
  it('numbers bars on the top voice and gives absolute beats', () => {
    const model = buildScoreModel(demoSong());
    expect(model[0]?.bars).toEqual([
      { col: 0, bar: 1, beat: 0 },
      { col: 4, bar: 2, beat: 4 },
    ]);
    expect(model[1]?.bars.map((b) => b.bar)).toEqual([3, 4]);
    expect(model[1]?.rows[0]?.cells[0]).toEqual({ beat: 8, sep: '|', text: "d'" });
    expect(model[0]?.endSep).toBe('|');
    expect(model[1]?.endSep).toBe('||');
  });

  it('counts a pick-up as bar 0 and flags key changes', () => {
    const model = buildScoreModel(rhythmSong());
    expect(model[0]?.barAt.slice(0, 2)).toEqual([0, 1]);
    expect(model[0]?.keyChanged).toBe(false);
    expect(model[1]?.keyChanged).toBe(true);
    expect(model[0]?.rows.map((r) => r.voice)).toEqual(['S', 'A', 'T', 'B']);
  });

  it('continues a bar across systems unless the previous line ended with a bar line', () => {
    const open = buildScoreModel(songFromText('S: | d :r :m\n\nS: f | s :l |'));
    expect(open[0]?.endSep).toBe('');
    expect(open[1]?.barAt).toEqual([1, 2, 2]);
    const closed = buildScoreModel(songFromText('S: | d :r |\n\nS: m :f |'));
    expect(closed[1]?.bars).toEqual([{ col: 0, bar: 2, beat: 2 }]);
  });

  it('gives regular bars to a song without bar lines', () => {
    const song = songFromText('time: 3/4\nS: d :r :m :f :s :l :t');
    expect(buildScoreModel(song)[0]?.barAt).toEqual([1, 1, 1, 2, 2, 2, 3]);
  });

  // Integration check with core/parseSolfa (solfa-backend): the real parser's Song must draw
  // exactly like the fixtures the gallery and these tests use.
  it.each([
    ['demo', DEMO_SONG_TEXT],
    ['rhythm', RHYTHM_SONG_TEXT],
  ])('draws the parser output of the %s song like the fixture', (_, text) => {
    const draw = (song: ReturnType<typeof songFromText>) =>
      buildScoreModel(song).map((sys) => ({
        bars: sys.barAt,
        end: sys.endSep,
        key: sys.keyChanged,
        rows: sys.rows.map((r) => `${r.voice}:${r.cells.map((c) => c.sep + c.text).join(' ')}`),
      }));
    const parsed = parseSolfa(text);
    expect(parsed.diagnostics.filter((d) => d.severity !== 'info')).toEqual([]);
    expect(draw(parsed.song)).toEqual(draw(songFromText(text)));
  });
});
