import { describe, expect, it } from 'vitest';
import { estimateCharHeight, fillRatio, inkIn, labelComponents, splitPageComponents } from './components';
import { blank, drawRow } from './testing';

describe('components', () => {
  it('labels 8-connected components with boxes and areas', () => {
    const c = blank(20, 10).rect(1, 1, 3, 3).rect(10, 2, 2, 5);
    // diagonal touch joins (8-connectivity)
    c.rect(4, 4, 1, 1);
    const l = labelComponents(c);
    expect(l.components).toHaveLength(2);
    const [a, b] = l.components;
    expect(a).toMatchObject({ x0: 1, y0: 1, x1: 5, y1: 5, area: 10 });
    expect(b).toMatchObject({ x0: 10, y0: 2, x1: 12, y1: 7, area: 10 });
    expect(l.labels[2 * 20 + 2]).toBe(a.id);
    expect(fillRatio(b)).toBe(1);
    expect(inkIn(l, b.id, { x0: 0, y0: 0, x1: 20, y1: 4 })).toBe(4);
  });

  it('merges U-shapes whose arms meet later (union-find)', () => {
    const c = blank(10, 6).rect(1, 0, 1, 5).rect(6, 0, 1, 5).rect(1, 4, 6, 1);
    expect(labelComponents(c).components).toHaveLength(1);
  });

  it('estimates the character height (dots do not dominate)', () => {
    const c = blank(700, 80);
    drawRow(c, '| d :m :s :d | r :d :m :s |', 10, 50, 20);
    const h = estimateCharHeight(labelComponents(c).components);
    expect(h).toBeGreaterThanOrEqual(19);
    expect(h).toBeLessThanOrEqual(30);
  });

  it('separates ruled lines and speckles from text', () => {
    const c = blank(300, 200).rect(100, 10, 3, 150).rect(10, 180, 280, 2).rect(250, 50, 1, 1);
    drawRow(c, 'd m s', 20, 60, 20);
    const l = labelComponents(c);
    const s = splitPageComponents(l.components, 25);
    expect(s.vertical).toHaveLength(1);
    expect(s.horizontal).toHaveLength(1);
    expect(s.noise).toHaveLength(1);
    expect(s.rest).toHaveLength(3);
  });
});
