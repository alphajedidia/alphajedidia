import { describe, expect, it } from 'vitest';
import { countSeparators, groupRowItems, hasGluedApostrophe, looksLikeMergedColon } from './marks';
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

  it('does not take an octave apostrophe above a division dot for a colon', () => {
    expect(kinds("| d'.r :m |")).toEqual(['bar', 'note', 'apostrophe', 'dot', 'note', 'colon', 'note', 'bar']);
  });

  it('accepts a squashed colon top (looks like a stubby dash) above a dot', () => {
    const c = blank(300, 200);
    drawRow(c, '| d  m |', 10, 120, 20);
    c.rect(52, 102, 7, 5).rect(53, 116, 4, 4); // squashed top + round bottom between d and m
    const comps = labelComponents(c).components;
    const got = groupRowItems(comps, measureRow(comps, 20)!).map((i) => i.kind);
    expect(got).toEqual(['bar', 'note', 'colon', 'note', 'bar']);
  });

  it('flags a lone `l` that could be a bar line, and counts separators', () => {
    const it2 = items('| l :d |');
    const lah = it2.find((i) => i.kind === 'note')!;
    expect(lah.alt).toBe('bar');
    expect(countSeparators(it2)).toBe(3);
  });

  it('reads a short thin blob standing alone as a colon whose dots ran together', () => {
    const c = blank(300, 200);
    drawRow(c, '| d', 10, 120, 20);
    c.rect(60, 102, 4, 18); // merged colon: thin, x-height tall, on the baseline
    drawRow(c, 'm |', 80, 120, 20);
    const comps = labelComponents(c).components;
    const m = measureRow(comps, 20)!;
    expect(groupRowItems(comps, m).map((i) => i.kind)).toEqual(['bar', 'note', 'colon', 'note', 'bar']);
    expect(looksLikeMergedColon({ x0: 0, y0: 71, x1: 4, y1: 100, area: 116 }, m)).toBe(false); // an l
  });

  it('detects an octave apostrophe glued to its letter', () => {
    const c = blank(200, 200);
    drawRow(c, 'd', 10, 120, 20); // d: x 10..23, top at 91
    c.rect(23, 91, 4, 8); // apostrophe touching the stem at the top right
    drawRow(c, 'm', 60, 120, 20);
    const lab = labelComponents(c);
    const m = measureRow(lab.components, 20)!;
    const [d, mm] = lab.components.sort((a, b) => a.x0 - b.x0);
    expect(hasGluedApostrophe(lab, d, m)).toBe(true);
    expect(hasGluedApostrophe(lab, mm, m)).toBe(false);
  });
});
