import { describe, expect, it } from 'vitest';
import { ascenderReference, buildRowTokens, cellText, completeLabels, splitCells, tokensFromText } from './tokens';
import { labelComponents } from './components';
import { groupRowItems } from './marks';
import { measureRow } from './symbols';
import { blank, drawRow } from './testing';

function row(text: string, letters: string[]) {
  const c = blank(900, 200);
  drawRow(c, text, 10, 120, 20);
  const comps = labelComponents(c).components;
  const m = measureRow(comps, 20)!;
  const items = groupRowItems(comps, m);
  const readings = letters.map((t) => ({ text: t, conf: 0.9 }));
  return { items, m, readings };
}

describe('tokens', () => {
  it('turns items + readings into sol-fa tokens and cells', () => {
    const { items, m, readings } = row("| d.r :s, :d' :- |", ['d', 'r', 's', 'd']);
    const t = buildRowTokens(items, readings, m);
    expect(t.tokens.map((k) => k.text).join(' ')).toBe("| d . r : s , : d ' : - |");
    const cells = splitCells(t.tokens);
    expect(cells.map((c) => (c.sep?.text ?? '') + cellText(c))).toEqual(['', '|d.r', ':s,', ":d'", ':-', '|']);
  });

  it('marks unread or corrected letters as uncertain', () => {
    const { items, m } = row('| m :d |', []);
    const t = buildRowTokens(items, [{ text: 'rn', conf: 0.9 }, undefined], m);
    const notes = t.tokens.filter((k) => k.kind === 'note');
    expect(notes[0]).toMatchObject({ text: 'm', reason: 'corrected-letter' });
    expect(notes[1]).toMatchObject({ reason: 'unread-glyph' });
    expect(notes[1].conf).toBeLessThan(0.6);
  });

  it('reads a printed label and drops its full stop', () => {
    // a capital-height "S" before the first bar
    const { items, m } = row('d. | m :s |', ['S', 'm', 's']);
    const t = buildRowTokens(items, [{ text: 'S', conf: 0.9 }, { text: 'm', conf: 0.9 }, { text: 's', conf: 0.9 }], m);
    expect(t.label).toBe('S');
    expect(t.tokens[0].text).toBe('|');
  });

  it('recovers a misread label from the label column of the other rows', () => {
    const a = row('d. | m :s |', ['S', 'm', 's']);
    const b = row('d. | d :d |', ['m', 'd', 'd']);
    const ta = buildRowTokens(a.items, [{ text: 'S', conf: 0.9 }, ...a.readings.slice(1)], a.m);
    const tb = buildRowTokens(b.items, [{ text: 'm', conf: 0.9 }, { text: 'd', conf: 0.9 }, { text: 'd', conf: 0.9 }], b.m);
    expect(tb.tokens[0].kind).toBe('note');
    expect(completeLabels([ta, tb], 20)).toBe(1);
    expect(tb.tokens[0].text).toBe('|');
  });

  it('fixes f/t from the letter height compared with d and l', () => {
    const { items, m } = row('| d :l :f :t |', ['d', 'l', 't', 'f']);
    const ref = ascenderReference([{ items, readings: ['d', 'l', 't', 'f'].map((t) => ({ text: t, conf: 0.9 })) }]);
    expect(ref).toBe(29);
    const t = buildRowTokens(items, ['d', 'l', 't', 'f'].map((x) => ({ text: x, conf: 0.9 })), m, ref);
    expect(t.tokens.filter((k) => k.kind === 'note').map((k) => k.text)).toEqual(['d', 'l', 'f', 't']);
  });

  it('builds rough tokens from a plain-text music line', () => {
    const t = tokensFromText('| d :m.r |', { x0: 0, x1: 100, y0: 0, y1: 10 });
    expect(t.map((k) => k.kind)).toEqual(['sep', 'note', 'sep', 'note', 'mark', 'note', 'sep']);
    expect(t[1].box.x0).toBeGreaterThan(t[0].box.x0);
  });
});
