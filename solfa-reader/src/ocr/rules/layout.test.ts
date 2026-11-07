import { describe, expect, it } from 'vitest';
import { assignVoices, classifyRowText, columnAgreement, groupSystems, segmentRows, type SystemRow } from './layout';
import { labelComponents } from './components';
import { blank, drawRow } from './testing';

describe('layout — rows', () => {
  it('segments rows and attaches small marks to their row', () => {
    const c = blank(600, 300);
    drawRow(c, "| d' :m :s, |", 10, 60, 20);
    drawRow(c, '| d :- :t |', 10, 130, 20);
    drawRow(c, 'm s r', 10, 200, 20);
    const rows = segmentRows(labelComponents(c).components, 25);
    expect(rows).toHaveLength(3);
    expect(rows[0].y1).toBeLessThan(rows[1].y0);
    // the apostrophe and the comma of row 1 stay in row 1
    expect(rows[0].comps.length).toBe(11);
  });
});

describe('layout — row kinds from text', () => {
  const cases: [string, ReturnType<typeof classifyRowText>][] = [
    ['| m :m :f :s | s :f :m :r |', 'music'],
    [":s, | d :-.r :m | s :f :m |", 'music'],
    ['Ry Tompo ô, deraina anie', 'words'],
    ['Doh is G.   4/4', 'header'],
    ['Do dia F', 'header'],
    ['', 'words'],
  ];
  for (const [t, k] of cases) it(`"${t}" → ${k}`, () => expect(classifyRowText(t)).toBe(k));
});

describe('layout — systems', () => {
  const row = (y: number, seps = [10, 50, 90]): SystemRow => ({ box: { x0: 0, x1: 300, y0: y, y1: y + 30 }, seps });
  it('measures how well separators line up', () => {
    expect(columnAgreement([10, 50, 90], [11, 49, 91], 5)).toBe(1);
    expect(columnAgreement([10, 50, 90], [30, 70], 5)).toBe(0);
  });
  it('groups 8 rows into two SATB systems by the larger gap between systems', () => {
    const ys = [0, 45, 90, 135, 240, 285, 330, 375];
    expect(groupSystems(ys.map((y) => row(y)), [], 20)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]);
  });
  it('does not split a system at a lyrics row printed between two voices', () => {
    // S A [lyrics] T B   (gap) S A [lyrics] T B
    const ys = [0, 45, 130, 175, 290, 335, 420, 465];
    const lyrics = [
      { x0: 0, x1: 300, y0: 82, y1: 118 },
      { x0: 0, x1: 300, y0: 372, y1: 408 },
    ];
    expect(groupSystems(ys.map((y) => row(y)), [], 20, 4, lyrics)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]);
  });
  it('follows ruled bar lines that span the voices of a system', () => {
    const ys = [0, 45, 90, 160, 205, 250];
    const rules = [
      { x0: 5, x1: 7, y0: 0, y1: 120 },
      { x0: 5, x1: 7, y0: 160, y1: 280 },
    ];
    expect(groupSystems(ys.map((y) => row(y)), rules, 20)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });
  it('keeps up to four evenly spaced rows as one system', () => {
    expect(groupSystems([row(0), row(45), row(90)], [], 20)).toEqual([[0, 1, 2]]);
    expect(groupSystems([], [], 20)).toEqual([]);
  });
});

describe('layout — voices', () => {
  it('assigns voices by order, honouring printed labels', () => {
    expect(assignVoices(4)).toEqual(['S', 'A', 'T', 'B']);
    expect(assignVoices(3, ['S', null, 'B'])).toEqual(['S', 'A', 'B']);
    expect(assignVoices(2)).toEqual(['S', 'A']);
  });
});
