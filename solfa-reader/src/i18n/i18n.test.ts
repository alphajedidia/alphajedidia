import { describe, expect, it } from 'vitest';
import { DIAGNOSTIC_CODES } from '../app/diagnostics';
import { createI18n, interpolate, loadMessages, type Messages } from './index';
import { en } from './en';
import { fr } from './fr';
import { mg } from './mg';

const DICTS: Record<string, Messages> = { en, mg, fr };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('have the same keys in every language and no empty text', () => {
    const keys = Object.keys(en).sort();
    for (const [lang, dict] of Object.entries(DICTS)) {
      expect(Object.keys(dict).sort(), lang).toEqual(keys);
      for (const [k, v] of Object.entries(dict)) expect(v.trim(), `${lang} ${k}`).not.toBe('');
    }
  });

  it('use the same placeholders as English', () => {
    for (const [lang, dict] of Object.entries(DICTS)) {
      for (const k of Object.keys(en) as Array<keyof typeof en>) {
        expect(placeholders(dict[k]), `${lang} ${k}`).toEqual(placeholders(en[k]));
      }
    }
  });

  it('translate every parser diagnostic code (SOLFA_FORMAT §8)', () => {
    for (const code of DIAGNOSTIC_CODES) expect(Object.keys(en)).toContain(`diag.${code}`);
  });

  it('translate every share-link error code', () => {
    for (const code of ['empty', 'bad-prefix', 'bad-encoding', 'bad-data', 'too-large', 'unsupported']) {
      expect(Object.keys(en)).toContain(`shareOpen.error.${code}`);
    }
  });

  it('translate every OCR warning and uncertain reason (docs/OCR.md §1)', () => {
    const warnings = ['no-text-found', 'no-music-found', 'low-resolution', 'alignment-poor', 'beat-count-mismatch', 'music-read-as-text', 'handwriting-mode'];
    const reasons = ['low-confidence', 'corrected-letter', 'unread-glyph', 'inserted-separator', 'dropped-separator', 'corrected-separator', 'bar-as-lah', 'lah-as-bar', 'dot-or-comma', 'semicolon-as-colon', 'comma-position', 'stray-mark', 'text-fallback'];
    for (const w of warnings) expect(Object.keys(en)).toContain(`ocrWarn.${w}`);
    for (const r of reasons) expect(Object.keys(en)).toContain(`ocrReason.${r}`);
  });

  it('have both plural forms for every plural key', () => {
    for (const k of Object.keys(en)) {
      if (k.endsWith('_one')) expect(Object.keys(en)).toContain(k.replace(/_one$/, '_other'));
    }
  });
});

describe('t()', () => {
  it('interpolates and pluralises', () => {
    expect(interpolate('Bar {bar} / {total}', { bar: 2, total: 8 })).toBe('Bar 2 / 8');
    expect(interpolate('{missing}', {})).toBe('{missing}');
    const { t, tp } = createI18n('en', en);
    expect(t('player.bar', { bar: 3, total: 4 })).toBe('Bar 3 / 4');
    expect(tp('editor.problems', 1)).toBe('1 problem');
    expect(tp('editor.problems', 3)).toBe('3 problems');
    expect(createI18n('mg', mg).tp('editor.problems', 2)).toBe('Olana 2');
  });

  it('loads dictionaries lazily, Malagasy by default', async () => {
    expect(await loadMessages('mg')).toBe(mg);
    expect(await loadMessages('fr')).toBe(fr);
    expect((await loadMessages('en'))['app.name']).toBe('Solfa Reader');
  });
});
