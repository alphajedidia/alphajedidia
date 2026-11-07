/** Shared helpers for core unit tests (not exported from the module index). */
import type { Beat, BeatPart, SolfaItem } from './model';

/** The full example of SOLFA_FORMAT.md §1. */
export const SPEC_EXAMPLE = `title: Hira fiderana (example)
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
B: | d  :s, :l, :d  | s, :-  :-  :-  ||
`;

/** Compact description of an item: note text, "-" for hold, "_" for rest. */
export function itemText(item: SolfaItem): string {
  if (item.kind === 'note') return item.text;
  return item.kind === 'hold' ? '-' : '_';
}

/** Compact description of a beat's parts: [["d", 0, 0.5], ["r", 0.5, 0.5]]. */
export function partsOf(beat: Beat | undefined): Array<[string, number, number]> {
  return (beat?.parts ?? []).map((p: BeatPart) => [itemText(p.item), p.start, p.length]);
}

/** Small seeded PRNG (mulberry32) so fuzz tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random text made of format characters, notes, labels, headers and noise. */
export function randomSolfa(next: () => number): string {
  const pieces = [
    'd', 'r', 'm', 'f', 's', 'l', 't', 'de', 'ta', 'te', 'fe', 'x', 'rr', 'D',
    ':', '|', '||', '!', '¦', '.', ',', '.,', "'", '’', '`', '¹', '²', '₁', '₂', '-', '—', '_',
    ' ', ' ', ' ', '  ', '\n', '\n', '\n\n', '{', '}', '{rall.}', '*', '?', '\t', '\r\n',
    'S: ', 'A: ', 'T. ', 'Bass ', 'Soprano: ', 'W: words ', '# c', 'key: ', 'G', 'Do dia Sol',
    'time: 3/4', 'tempo: ', '84', 'voices: S A B', 'title: x', 'do', 'do: ', 'Doh is ', '=',
    'é', '♭', '#', '🎵', '́',
  ];
  let out = '';
  const len = Math.floor(next() * 80);
  for (let i = 0; i < len; i++) out += pieces[Math.floor(next() * pieces.length)] ?? '';
  return out;
}
