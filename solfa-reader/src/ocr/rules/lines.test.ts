import { describe, expect, it } from 'vitest';
import { findFrames, removeRuledLines } from './lines';
import { labelComponents } from './components';
import { blank, drawRow } from './testing';

describe('lines — tables and ruled lines', () => {
  it('erases table rules, keeps letters, and returns the verticals as bar lines', () => {
    const c = blank(500, 220);
    c.rect(10, 20, 480, 2).rect(10, 200, 480, 2); // top / bottom rules
    c.rect(10, 20, 2, 182).rect(250, 20, 2, 182).rect(488, 20, 2, 182); // verticals
    drawRow(c, 'd m s', 40, 80, 20);
    drawRow(c, 'r t', 40, 150, 20);
    const r = removeRuledLines(c, 25);
    expect(r.horizontalPixels).toBeGreaterThan(1500);
    expect(r.vertical.map((v) => v.x0).sort((a, b) => a - b)).toEqual([10, 250, 488]);
    const comps = labelComponents(r.cleaned).components;
    expect(comps).toHaveLength(5); // only the letters remain
  });

  it('finds a slanted frame (perspective) and the bar lines inside it', () => {
    const c = blank(400, 200);
    // top and bottom edges slope by 6 px: run-based removal alone would miss them
    for (let x = 0; x < 380; x++) {
      c.rect(10 + x, 20 + Math.floor((x * 6) / 380), 1, 2);
      c.rect(10 + x, 180 + Math.floor((x * 6) / 380), 1, 2);
    }
    c.rect(10, 20, 2, 162).rect(200, 23, 2, 160).rect(388, 26, 2, 160);
    drawRow(c, 'd m', 50, 100, 20);
    const lab = labelComponents(c);
    const f = findFrames(lab, 25);
    expect(f.ids.size).toBe(1);
    expect(f.vertical).toHaveLength(3);
    expect(f.vertical[1].x0).toBe(200);
  });
});
