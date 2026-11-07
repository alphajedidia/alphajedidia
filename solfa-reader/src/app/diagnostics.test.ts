import { describe, expect, it } from 'vitest';
import { parseSolfa } from '../core';
import { createI18n } from '../i18n';
import { en } from '../i18n/en';
import { fr } from '../i18n/fr';
import { countProblems, describeDiagnostic, mismatchCounts, sortDiagnostics } from './diagnostics';

describe('diagnostics', () => {
  const { t } = createI18n('en', en);
  it('translates parser diagnostics with their details', () => {
    const text = 'key: H\nS: | d :r :m :f |\nA: | d :r :m |\nT: | x :r :m :f |';
    const ds = sortDiagnostics(parseSolfa(text).diagnostics);
    const msgs = ds.map((d) => describeDiagnostic(d, text, t, en).message);
    expect(msgs).toContain('“x” is not a note. Notes are d r m f s l t.');
    expect(msgs).toContain('Alto has 3 beats here, the other voices have 4.');
    expect(msgs.some((m) => m.startsWith('Key “H” not understood'))).toBe(true);
    expect(ds[0]?.severity).toBe('error');
    expect(countProblems(ds)).toBe(ds.filter((d) => d.severity !== 'info').length);
  });

  it('gives a location, and French text in French', () => {
    const text = 'S: | d :r |\nA: | d |';
    const d = parseSolfa(text).diagnostics.find((x) => x.code === 'beat-count-mismatch');
    expect(d).toBeDefined();
    if (!d) return;
    expect(describeDiagnostic(d, text, t, en).where).toMatch(/^Line 2/);
    expect(describeDiagnostic(d, text, createI18n('fr', fr).t, fr).message).toBe('Alto a 1 temps ici, les autres voix en ont 2.');
  });

  it('falls back for unknown codes and unreadable counts', () => {
    const d = { severity: 'warning' as const, code: 'new-code', message: 'odd', line: 0, col: 0, endCol: 1 };
    expect(describeDiagnostic(d, 'x', t, en).message).toBe('Problem: odd');
    const m = { ...d, code: 'bar-count-mismatch', message: 'different', voice: 'T' as const };
    expect(describeDiagnostic(m, 'x', t, en).message).toBe('Tenor does not have as many bars as the other voices.');
    expect(mismatchCounts('3 beats instead of 4; padded')).toEqual([3, 4]);
  });
});
