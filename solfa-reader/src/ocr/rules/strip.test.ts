import { describe, expect, it } from 'vitest';
import { assignReadings, composeStrip } from './strip';
import { labelComponents } from './components';
import { blank, drawRow } from './testing';
import type { RowMetrics } from './symbols';

describe('strip — letters cut out and spaced for the text engine', () => {
  const c = blank(400, 160);
  drawRow(c, '| d :m.r |', 10, 100, 20);
  const lab = labelComponents(c);
  const m: RowMetrics = { baseline: 100, xHeight: 20, ascHeight: 29, measured: true };
  const notes = lab.components.filter((k) => k.y1 === 100 && k.x1 - k.x0 > 6 && k.y1 - k.y0 >= 20);
  const clusters = notes.map((k) => ({ box: k, ids: [k.id] }));

  it('copies only the letters, baseline-aligned, with wide gaps', () => {
    const { bitmap, plan } = composeStrip(lab, clusters, m);
    expect(plan.placements).toHaveLength(3);
    const [a, b] = plan.placements;
    expect(b.dst.x0 - a.dst.x1).toBeGreaterThanOrEqual(20);
    // every placement keeps its height and the same baseline
    for (const p of plan.placements) {
      expect(p.dst.y1 - p.dst.y0).toBe(p.src.y1 - p.src.y0);
      expect(p.dst.y1).toBe(plan.placements[0].dst.y1);
    }
    const ink = bitmap.data.reduce((s, v) => s + v, 0);
    expect(ink).toBe(notes.reduce((s, k) => s + k.area, 0)); // no colon/dot/bar pixels
  });

  it('attributes engine symbols to clusters (scaled strip coordinates)', () => {
    const { plan } = composeStrip(lab, clusters, m);
    const s = 2;
    const sym = (text: string, i: number, conf = 90) => ({
      text,
      confidence: conf,
      box: { x0: plan.placements[i].dst.x0 * s, x1: plan.placements[i].dst.x1 * s, y0: 0, y1: 10 },
    });
    const r = assignReadings(plan, [sym('d', 0), sym('m', 1, 60), sym('r', 2)], s);
    expect(r).toEqual([
      { text: 'd', conf: 0.9 },
      { text: 'm', conf: 0.6 },
      { text: 'r', conf: 0.9 },
    ]);
    expect(assignReadings(plan, [], s)[1]).toEqual({ text: '', conf: 0 });
  });
});
