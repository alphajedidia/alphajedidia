import { describe, expect, it } from 'vitest';
import type { Degree, SolfaNote } from './model';
import { midiToName, noteToMidi, parseKey } from './pitch';

const note = (degree: Degree, octave = 0, alter: -1 | 0 | 1 = 0): SolfaNote => ({
  kind: 'note',
  degree,
  alter,
  octave,
  text: degree,
});

describe('parseKey', () => {
  it.each([
    'G',
    'Doh is G',
    'Doh = G',
    'Do = Sol',
    'Do dia Sol',
    'Key of G',
    'Key G',
    'Do: G',
    'key: G',
    'g',
    'Sol',
    'SOL',
    'so',
    'G major',
    'Sol majeur',
    'Doh is G major',
  ])('"%s" means doh is G (§3)', (value) => {
    expect(parseKey(value)).toEqual({ tonic: 7, name: 'G' });
  });

  it.each([
    ['C', 0, 'C'],
    ['D', 2, 'D'],
    ['E', 4, 'E'],
    ['F', 5, 'F'],
    ['A', 9, 'A'],
    ['B', 11, 'B'],
    ['Bb', 10, 'B♭'],
    ['B♭', 10, 'B♭'],
    ['bb', 10, 'B♭'],
    ['B b', 10, 'B♭'],
    ['Key of Bb', 10, 'B♭'],
    ['Eb', 3, 'E♭'],
    ['Ab major', 8, 'A♭'],
    ['F#', 6, 'F#'],
    ['F♯', 6, 'F#'],
    ['C#', 1, 'C#'],
    ['Doh is F#', 6, 'F#'],
    ['Cb', 11, 'C♭'],
  ])('letter name %s → tonic %i (%s)', (value, tonic, name) => {
    expect(parseKey(value)).toEqual({ tonic, name });
  });

  it.each([
    ['Do', 0, 'C'],
    ['Ré', 2, 'D'],
    ['Re', 2, 'D'],
    ['RÉ', 2, 'D'],
    ['Ré', 2, 'D'],
    ['Mi', 4, 'E'],
    ['Fa', 5, 'F'],
    ['La', 9, 'A'],
    ['Si', 11, 'B'],
    ['Fa#', 6, 'F#'],
    ['Fa ♯', 6, 'F#'],
    ['Fa dièse', 6, 'F#'],
    ['Fa diese', 6, 'F#'],
    ['Fa diesy', 6, 'F#'],
    ['Do diesy', 1, 'C#'],
    ['Do#', 1, 'C#'],
    ['Si bémol', 10, 'B♭'],
    ['si bemol', 10, 'B♭'],
    ['Si bemola', 10, 'B♭'],
    ['Sib', 10, 'B♭'],
    ['Mi♭', 3, 'E♭'],
    ['Mi bémol majeur', 3, 'E♭'],
    ['Do dia Fa', 5, 'F'],
    ['Do dia Si bemola', 10, 'B♭'],
    ['Do = Ré', 2, 'D'],
    ['Doh = Mi', 4, 'E'],
    ['  la  ', 9, 'A'],
  ])('Latin / Malagasy %s → tonic %i (%s)', (value, tonic, name) => {
    expect(parseKey(value)).toEqual({ tonic, name });
  });

  it.each(['', '   ', 'H', 'xyz', 'A minor', 'G##', 'Doh is', 'Key', 'Do dia', '7', 'Bbb', 'Sol x'])(
    '"%s" is not a key',
    (value) => {
      expect(parseKey(value)).toBeNull();
    },
  );
});

describe('noteToMidi (§6)', () => {
  const G = { tonic: 7, name: 'G' };
  it('matches the examples of §6 in key G', () => {
    expect(noteToMidi(note('d'), 'S', G)).toBe(67);
    expect(noteToMidi(note('s', -1), 'S', G)).toBe(62);
    expect(noteToMidi(note('d'), 'T', G)).toBe(55);
    expect(noteToMidi(note('d', -1), 'B', G)).toBe(43);
  });

  it('uses base 60 for S/A and 48 for T/B', () => {
    const C = { tonic: 0, name: 'C' };
    expect(noteToMidi(note('d'), 'A', C)).toBe(60);
    expect(noteToMidi(note('d'), 'B', C)).toBe(48);
    expect(noteToMidi(note('t'), 'S', C)).toBe(71);
    expect(noteToMidi(note('d', 1), 'S', C)).toBe(72);
    expect(noteToMidi(note('l', -2), 'B', C)).toBe(33);
  });

  it('applies chromatic alteration', () => {
    const C = { tonic: 0, name: 'C' };
    expect(noteToMidi(note('f', 0, 1), 'S', C)).toBe(66);
    expect(noteToMidi(note('t', 0, -1), 'S', C)).toBe(70);
  });

  it('applies octaveShift per voice and transpose', () => {
    expect(noteToMidi(note('d'), 'T', G, { octaveShift: { T: 1 } })).toBe(67);
    expect(noteToMidi(note('d'), 'S', G, { octaveShift: { T: 1 } })).toBe(67);
    expect(noteToMidi(note('d'), 'S', G, { transpose: -2 })).toBe(65);
    expect(noteToMidi(note('d', -1), 'B', G, { transpose: 3, octaveShift: { B: -1 } })).toBe(34);
  });
});

describe('midiToName', () => {
  it.each([
    [67, 'G4'],
    [60, 'C4'],
    [61, 'C#4'],
    [71, 'B4'],
    [72, 'C5'],
    [21, 'A0'],
    [0, 'C-1'],
    [127, 'G9'],
    [43, 'G2'],
  ])('%i → %s', (midi, name) => {
    expect(midiToName(midi)).toBe(name);
  });
});
