import { describe, expect, it } from 'vitest';
import { parseSolfa } from '../core';
import { barEnd, keyAtLine, noteFromKeypad, readTitleHeader, setTitleHeader, voiceAtLine } from './songText';

describe('title header', () => {
  it('reads and sets the title', () => {
    expect(readTitleHeader('title: Hira\nkey: G')).toBe('Hira');
    expect(readTitleHeader('key: G')).toBeNull();
    expect(readTitleHeader('Title:   ')).toBeNull();
    expect(setTitleHeader('title: Old\nkey: G', 'New')).toBe('title: New\nkey: G');
    expect(setTitleHeader('key: G', 'New\nline')).toBe('title: New line\nkey: G');
  });
});

describe('noteFromKeypad', () => {
  it('maps keys to notes (Curwen and American chromatics, te = lowered)', () => {
    expect(noteFromKeypad('d')).toMatchObject({ degree: 'd', alter: 0 });
    expect(noteFromKeypad('fe')).toMatchObject({ degree: 'f', alter: 1 });
    expect(noteFromKeypad('si')).toMatchObject({ degree: 's', alter: 1 });
    expect(noteFromKeypad('ta')).toMatchObject({ degree: 't', alter: -1 });
    expect(noteFromKeypad('te')).toMatchObject({ degree: 't', alter: -1 });
    expect(noteFromKeypad('lo')).toMatchObject({ degree: 'l', alter: -1 });
    expect(noteFromKeypad(':')).toBeNull();
    expect(noteFromKeypad('S: ')).toBeNull();
    expect(noteFromKeypad('dx')).toBeNull();
  });
});

describe('voice and key at a line', () => {
  const text = 'key: G\n\nS: | d :r |\nA: | m :f |\n\nkey: F\n\n| s :l |\n| d :r |';
  const song = parseSolfa(text).song;
  it('uses the label, else the parser, else Soprano', () => {
    expect(voiceAtLine(song, 'A: | m', 3)).toBe('A');
    expect(voiceAtLine(song, 'Tenor: | m', 99)).toBe('T');
    expect(voiceAtLine(song, '| d :r |', 8)).toBe('A');
    expect(voiceAtLine(null, '| d', 0)).toBe('S');
  });
  it('follows key changes', () => {
    expect(keyAtLine(song, 2).name).toBe('G');
    expect(keyAtLine(song, 8).name).toBe('F');
  });
  it('finds the end of a bar', () => {
    const bars = [{ number: 1, startBeat: 0 }, { number: 2, startBeat: 4 }];
    expect(barEnd(bars, 1, 8)).toBe(4);
    expect(barEnd(bars, 2, 8)).toBe(8);
  });
});
