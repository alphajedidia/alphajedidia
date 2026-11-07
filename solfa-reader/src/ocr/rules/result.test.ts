import { describe, expect, it } from 'vitest';
import { analyzePage } from './page';
import { buildResult, cleanTextRow, type EngineReadings } from './result';
import { blank, drawRow } from './testing';
import { formatSolfa, parseSolfa } from '../../core';

/** Draw a page: two text rows, then systems of voice rows (and lyrics rows). */
function page(rows: { y: number; text: string; read?: string }[]) {
  const c = blank(900, 760);
  for (const r of rows) drawRow(c, r.text, 30, r.y, 20, r.text.includes('|') ? 24 : 0);
  return c;
}

const SYS1 = ['| d :m :s :f | s :- :m :d |', '| d :d :d :d | t,:- :d :d |', '| m :s :s :l | s :- :s :m |'];
const SYS2 = ["| m :r :d :r | d':- :- :- ||", '| s,:t,:d :t,| d :- :- :- ||', '| s :s :m :s | m :- :- :- ||'];

function readingsFor(an: ReturnType<typeof analyzePage>, music: string[], texts: string[]): EngineReadings {
  const rd: EngineReadings = { notes: new Map(), texts: new Map() };
  let mi = 0;
  let ti = 0;
  for (const r of an.rows) {
    if (r.kind === 'music') {
      const notes = music[mi++].match(/[drmfslt][eiao]?/g) ?? [];
      rd.notes.set(r.index, notes.map((t) => ({ text: t, conf: 0.95 })));
    } else rd.texts.set(r.index, { text: texts[ti++], conf: 0.9 });
  }
  return rd;
}

describe('result — whole pipeline on a synthetic page (pure part)', () => {
  const rows = [
    { y: 40, text: 'mmmmm ssss' },
    { y: 90, text: 'ddd ss m  mmm' },
    ...SYS1.map((t, i) => ({ y: 170 + i * 55, text: t })),
    { y: 335, text: 'mmmm-ss rr-mm-ss' },
    ...SYS2.map((t, i) => ({ y: 450 + i * 55, text: t })),
  ];
  const bmp = page(rows);
  const an = analyzePage(bmp);

  it('finds header, music and lyrics rows', () => {
    expect(an.rows.map((r) => r.kind)).toEqual(['text', 'text', 'music', 'music', 'music', 'text', 'music', 'music', 'music']);
    expect(an.xHeight).toBeCloseTo(20, 0);
    expect(an.warnings).toEqual([]);
  });

  const rd = readingsFor(an, [...SYS1, ...SYS2], ['Hira vaovao', 'Doh is G.    4/4', 'Ry Tompo ô']);
  const res = buildResult(an, rd);

  it('produces canonical text with headers, two systems and words', () => {
    expect(res.text).toBe(
      [
        'title: Hira vaovao',
        'key: G',
        'time: 4/4',
        '',
        'S: | d :m :s :f | s  :- :m :d |',
        'A: | d :d :d :d | t, :- :d :d |',
        'T: | m :s :s :l | s  :- :s :m |',
        'W: Ry Tompo ô',
        '',
        "S: | m  :r  :d :r  | d' :- :- :- ||",
        'A: | s, :t, :d :t, | d  :- :- :- ||',
        'T: | s  :s  :m :s  | m  :- :- :- ||',
        '',
      ].join('\n'),
    );
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('gives every line its image region', () => {
    const voice = res.lines.filter((l) => l.kind === 'voice');
    expect(voice.map((l) => l.voice)).toEqual(['S', 'A', 'T', 'S', 'A', 'T']);
    for (let i = 1; i < 3; i++) expect(voice[i].box!.y0).toBeGreaterThan(voice[i - 1].box!.y0);
    expect(res.lines.find((l) => l.kind === 'words')?.textLine).toBe(7);
  });

  it('parses with the core parser without errors or warnings, and is already tidy', () => {
    const p = parseSolfa(res.text);
    expect(p.diagnostics.filter((d) => d.severity !== 'info')).toEqual([]);
    expect(p.song.systems).toHaveLength(2);
    expect(p.song.key.name).toBe('G');
    expect(formatSolfa(res.text)).toBe(res.text);
  });

  it('flags a dropped colon as an inserted separator', () => {
    const broken = page(rows.map((r) => (r.text === SYS1[1] ? { ...r, text: '| d :d  d :d | t,:- :d :d |' } : r)));
    const an2 = analyzePage(broken);
    const res2 = buildResult(an2, readingsFor(an2, [...SYS1, ...SYS2], ['Hira vaovao', 'Doh is G.    4/4', 'Ry Tompo ô']));
    expect(res2.text.split('\n')[5]).toBe('A: | d :d :d :d | t, :- :d :d |');
    expect(res2.uncertain).toContainEqual(expect.objectContaining({ textLine: 5, col: 10, reason: 'inserted-separator' }));
  });

  it('warns when there is no music', () => {
    const empty = analyzePage(blank(100, 100));
    expect(buildResult(empty, { notes: new Map(), texts: new Map() }).warnings).toContain('no-text-found');
  });

  it('drops dotted leader lines and stray marks from text rows', () => {
    expect(cleanTextRow('hmmm...(+Narration)..........................')).toBe('hmmm (+Narration)');
    expect(cleanTextRow('— . , |')).toBe('');
    expect(cleanTextRow('pas - tures of peace')).toBe('pas - tures of peace');
  });
});
