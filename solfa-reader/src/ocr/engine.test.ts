import { describe, expect, it } from 'vitest';
import { assetUrl, MUSIC_WHITELIST } from './engine';

// Source text of every OCR module (Vite glob import, works in Vitest without node typings).
const sources = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('engine — self-hosted assets', () => {
  it('resolves asset paths relative to the page (never a CDN)', () => {
    expect(assetUrl('./tesseract/core')).toBe('http://localhost/tesseract/core');
    expect(assetUrl('./tesseract/lang')).toMatch(/\/tesseract\/lang$/);
  });

  it('whitelists only sol-fa letters and voice labels for note strips', () => {
    expect([...MUSIC_WHITELIST].sort().join('')).toBe('ABSTadefilmorst');
  });

  it('has no CDN URL anywhere in the OCR module', () => {
    const files = Object.keys(sources);
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(sources[f], f).not.toMatch(/jsdelivr|unpkg|cdn\.|https?:\/\/(?!localhost)/);
  });
});
