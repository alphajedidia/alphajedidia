import { describe, expect, it } from 'vitest';
import { countSeparators, groupRowItems } from './marks';
import { labelComponents } from './components';
import { measureRow } from './symbols';
import { blank, drawRow } from './testing';

function items(text: string, xh = 20) {
  const c = blank(900, 200);
  drawRow(c, text, 10, 120, xh);
  const comps = labelComponents(c).components;
  const m = measureRow(comps, xh)!;
  return groupRowItems(comps, m);
}
const kinds = (text: string) =>
  items(text).map((i) => (i.kind === 'bar' && i.double ? '||' : i.kind));

describe('marks — grouping components into row items', () => {
  it('pairs dots into colons and keeps notes and bars', () => {
    expect(kinds('| d :m :s |')).toEqual(['bar', 'note', 'colon', 'note', 'colon', 'note', 'bar']);
  });

  it('recovers small marks: division dot, octave comma, apostrophe, hold dash', () => {
    expect(kinds("| d.r :s, :d' :- |")).toEqual([
      'bar', 'note', 'dot', 'note', 'colon', 'note', 'comma', 'colon', 'note', 'apostrophe', 'colon', 'dash', 'bar',
    ]);
  });

  it('distinguishes a dot from a comma by how far it reaches below the dot line', () => {
    const it1 = items('| d :d.,r :m |');
    expect(it1.map((i) => i.kind)).toEqual(['bar', 'note', 'colon', 'note', 'dot', 'comma', 'note', 'colon', 'note', 'bar']);
  });

  it('builds `!`, double bars and dotted i', () => {
    expect(kinds('| d !m :fi ||')).toEqual(['bar', 'note', 'medium', 'note', 'colon', 'note', '||']);
    // `fi`: f and the dotted i form one note cluster
    const fi = items('| fi :d |').find((i) => i.kind === 'note')!;
    expect(fi.comps.length).toBe(3);
  });

  it('flags a lone `l` that could be a bar line, and counts separators', () => {
    const it2 = items('| l :d |');
    const lah = it2.find((i) => i.kind === 'note')!;
    expect(lah.alt).toBe('bar');
    expect(countSeparators(it2)).toBe(3);
  });
});
