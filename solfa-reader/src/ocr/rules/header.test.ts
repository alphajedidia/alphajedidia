import { describe, expect, it } from 'vitest';
import { analyzeHeaderRow, buildHeaderLines, detectKey, detectTempo, detectTime } from './header';

describe('header — key detection (SOLFA_FORMAT §3 phrasings)', () => {
  const cases: [string, string | null][] = [
    ['Doh is G', 'G'],
    ['Doh is G.', 'G'],
    ['Doh = G', 'G'],
    ['Do = Sol', 'G'],
    ['Do dia Sol', 'G'],
    ['Do dia F#', 'F#'],
    ['Doh is Bb', 'Bb'],
    ['Do = Mi bémol', 'Eb'],
    ['Do dia Fa diesy', 'F#'],
    ['Key of G', 'G'],
    ['Key: D', 'D'],
    ['Do: A', 'A'],
    ['Hira fiderana', null],
    ['Do re mi song', null],
  ];
  for (const [text, key] of cases) it(`"${text}" → ${key}`, () => expect(detectKey(text)).toBe(key));
});

describe('header — time, tempo, rows', () => {
  it('detects time signatures', () => {
    expect(detectTime('Doh is G.   4/4')).toBe('4/4');
    expect(detectTime('Time 6 / 8')).toBe('6/8');
    expect(detectTime('1/2/2024')).toBeNull();
    expect(detectTime('no time')).toBeNull();
  });
  it('detects tempo marks', () => {
    expect(detectTempo('M. 84')).toBe(84);
    expect(detectTempo('MM = 120')).toBe(120);
    expect(detectTempo('♩ = 96')).toBe(96);
    expect(detectTempo('M. 5')).toBeNull();
  });
  it('analyses a key/time row and a title row', () => {
    expect(analyzeHeaderRow('Doh is G.      4/4      M. 84')).toEqual({ key: 'G', time: '4/4', tempo: 84 });
    expect(analyzeHeaderRow('  Hira  fiderana ')).toEqual({ other: 'Hira fiderana' });
  });
  it('builds header lines: first plain row is the title, others become comments', () => {
    expect(buildHeaderLines(['Hira fiderana', 'Doh is F.   3/4', 'J. Rakoto'])).toEqual([
      { text: 'title: Hira fiderana', row: 0 },
      { text: 'key: F', row: 1 },
      { text: 'time: 3/4', row: 1 },
      { text: '# J. Rakoto', row: 2 },
    ]);
  });
});
