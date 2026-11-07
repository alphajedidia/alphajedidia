import { describe, expect, it } from 'vitest';
import {
  classifyLines,
  matchHeader,
  matchLabel,
  parseVoicesValue,
  splitLines,
  voiceFromWord,
} from './lines';

describe('matchLabel', () => {
  it('finds labels with optional punctuation and columns', () => {
    expect(matchLabel('S: | d |')).toEqual({ voice: 'S', text: 'S:', col: 0 });
    expect(matchLabel('  Tenor. | d |')).toEqual({ voice: 'T', text: 'Tenor.', col: 2 });
    expect(matchLabel('Basse= | d |')).toEqual({ voice: 'B', text: 'Basse=', col: 0 });
    expect(matchLabel('A|d')).toEqual({ voice: 'A', text: 'A', col: 0 });
    expect(matchLabel('Sop')).toEqual({ voice: 'S', text: 'Sop', col: 0 });
  });
  it('needs an upper-case first letter and a word end', () => {
    expect(matchLabel('s: | d |')).toBeNull();
    expect(matchLabel('Sx | d')).toBeNull();
    expect(matchLabel('d :r')).toBeNull();
    expect(matchLabel('')).toBeNull();
  });
});

describe('matchHeader', () => {
  it('reads known headers with value columns', () => {
    expect(matchHeader('title:  Hira ')).toEqual({
      field: 'title',
      name: 'title',
      value: 'Hira',
      valueCol: 8,
      valueEndCol: 12,
    });
    expect(matchHeader('Author: X')?.field).toBe('composer');
    expect(matchHeader('mpanoratra: Y')?.field).toBe('lyricist');
  });
  it('reads key phrases', () => {
    expect(matchHeader('Doh is G')).toMatchObject({ field: 'key', value: 'G', valueCol: 7 });
    expect(matchHeader('Do dia Sol')).toMatchObject({ field: 'key', value: 'Sol' });
    expect(matchHeader('Key of Bb')).toMatchObject({ field: 'key', value: 'Bb' });
    expect(matchHeader('key: H')).toMatchObject({ field: 'key', value: 'H' });
  });
  it('keeps unknown name: value pairs as meta, but not music', () => {
    expect(matchHeader('Arranger: Me')).toMatchObject({ field: 'meta', name: 'arranger', value: 'Me' });
    expect(matchHeader('S: | d |')).toBeNull();
    expect(matchHeader('de:r :m')).toBeNull();
    expect(matchHeader('do :r :m')).toBeNull();
    expect(matchHeader('Sopran: | d :r |')).toBeNull();
    expect(matchHeader('| d :r |')).toBeNull();
  });
});

describe('voices', () => {
  it('maps words to voices', () => {
    expect(voiceFromWord('soprano')).toBe('S');
    expect(voiceFromWord('Ténor')).toBe('T');
    expect(voiceFromWord('x')).toBeNull();
  });
  it('parses the voices: value', () => {
    expect(parseVoicesValue('S, A / B b', 8)).toEqual({ voices: ['S', 'A', 'B'], unknown: [] });
    expect(parseVoicesValue('S Q', 8)).toEqual({ voices: ['S'], unknown: [{ col: 10, endCol: 11, word: 'Q' }] });
  });
});

describe('splitLines / classifyLines', () => {
  it('splits LF, CRLF and CR', () => {
    expect(splitLines('a\nb\r\nc\rd')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('classifies lines and groups systems', () => {
    const lines = classifyLines('title: x\n# c\nS: | d |\nW: w\n| m |\n\n| s |\nS: | d |\nS: | r |');
    expect(lines.map((l) => l.kind)).toEqual([
      'header',
      'comment',
      'voice',
      'words',
      'voice',
      'blank',
      'voice',
      'voice',
      'voice',
    ]);
    const voices = lines.flatMap((l) => (l.kind === 'voice' ? [[l.voice, l.system, l.musicCol]] : []));
    expect(voices).toEqual([
      ['S', 0, 2],
      ['A', 0, 0],
      ['S', 1, 0],
      ['S', 2, 2],
      ['S', 3, 2],
    ]);
  });
  it('marks lines beyond the voice list as voice null', () => {
    const lines = classifyLines('voices: S\n| d |\n| m |');
    expect(lines.flatMap((l) => (l.kind === 'voice' ? [l.voice] : []))).toEqual(['S', null]);
  });
});
