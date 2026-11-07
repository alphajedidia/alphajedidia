import { describe, expect, it } from 'vitest';
import { inferBeatsPerBar, linesOfVoice, referenceVoice } from './bars';
import { parseSolfa } from './parser';

const song = (text: string) => parseSolfa(text).song;

describe('bars helpers', () => {
  it('linesOfVoice lists a voice across systems', () => {
    const s = song('S: | d |\nA: | m |\n\nA: | r |');
    expect(linesOfVoice(s, 'A').map((p) => p.system)).toEqual([0, 1]);
    expect(linesOfVoice(s, 'S').map((p) => p.system)).toEqual([0]);
  });

  it('referenceVoice is the top voice present', () => {
    expect(referenceVoice(song('A: | m |\nB: | d |').systems[0]?.lines ?? {})).toBe('A');
    expect(referenceVoice({})).toBeUndefined();
  });

  it('inferBeatsPerBar uses the first complete bar of the first voice', () => {
    expect(inferBeatsPerBar(song(':s, | d :r :m | f |'))).toBe(3);
    expect(inferBeatsPerBar(song('| d :r :m :f |'))).toBe(4);
    expect(inferBeatsPerBar(song('| d :r\n\n:m | f |'))).toBe(3);
    expect(inferBeatsPerBar(song('| d :r\n\n| m |'))).toBe(2);
    expect(inferBeatsPerBar(song('d :r :m'))).toBeUndefined();
    expect(inferBeatsPerBar(song(''))).toBeUndefined();
  });
});
