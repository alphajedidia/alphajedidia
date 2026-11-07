import { describe, expect, it } from 'vitest';

interface FsLike {
  readFileSync(path: URL, encoding: 'utf8'): string;
}

/**
 * Read tokens.css from disk. Vitest does not process CSS (a `?raw` import comes back empty) and
 * the project has no @types/node, so fs is reached through process.getBuiltinModule (no import types needed).
 */
function readTokensCss(): string {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  const fs = proc?.getBuiltinModule?.('node:fs') as FsLike | undefined;
  if (!fs) throw new Error('node:fs is not available (needs Node >= 22.3)');
  return fs.readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
}

const css = readTokensCss();

/** `--sr-name: #rrggbb;` declarations of one CSS block. */
function tokensOf(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--sr-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = m;
    if (name && value) out[name] = value.toLowerCase();
  }
  return out;
}

function block(re: RegExp): string {
  const m = re.exec(css);
  if (!m?.[1]) throw new Error(`block not found: ${re}`);
  return m[1];
}

const LIGHT = tokensOf(block(/:root \{\s*color-scheme: light;([\s\S]*?)\n\}/));
const DARK_MEDIA = tokensOf(block(/:root:not\(\[data-theme='light'\]\) \{([\s\S]*?)\n {2}\}/));
const DARK_ATTR = tokensOf(block(/:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const VOICES = ['s', 'a', 't', 'b'];
const STATUS = ['danger', 'warning', 'success', 'info'];

/** [foreground, background, minimum ratio] — every pair the components actually draw. */
function pairs(): Array<[string, string, number]> {
  const p: Array<[string, string, number]> = [];
  const text = (fg: string, bgs: string[]) => bgs.forEach((bg) => p.push([fg, bg, 4.5]));
  const ui = (fg: string, bgs: string[]) => bgs.forEach((bg) => p.push([fg, bg, 3]));
  const softs = VOICES.map((v) => `voice-${v}-soft`);

  text('text', ['bg', 'surface', 'surface-2', 'surface-3', 'keypad-bg', 'brand-soft', 'loop-bg', 'uncertain-bg', ...softs, ...STATUS.map((s) => `${s}-soft`)]);
  text('text-muted', ['bg', 'surface', 'surface-2', 'loop-bg', ...softs]);
  text('brand-text', ['bg', 'surface', 'surface-2', 'brand-soft']);
  text('on-brand', ['brand', 'brand-hover', 'brand-pressed']);
  text('topbar-text', ['topbar-bg', 'topbar-hover']);
  text('on-danger', ['danger', 'danger-hover']);
  text('inverse-text', ['inverse-bg']);
  text('inverse-accent', ['inverse-bg']);
  STATUS.forEach((s) => text(s, ['bg', 'surface', `${s}-soft`]));
  VOICES.forEach((v) => {
    text(`voice-${v}`, ['bg', 'surface', 'surface-2', `voice-${v}-soft`, 'loop-bg']);
    text('on-voice', [`voice-${v}`]);
  });

  ui('border-strong', ['bg', 'surface', 'surface-2']);
  ui('focus', ['bg', 'surface', 'surface-2']);
  ui('topbar-focus', ['topbar-bg']);
  ui('brand', ['bg', 'surface', 'surface-3']);
  ui('loop-edge', ['surface']);
  ui('uncertain-line', ['uncertain-bg']);
  return p;
}

function failures(theme: Record<string, string>) {
  return pairs()
    .map(([fg, bg, min]) => {
      const a = theme[fg];
      const b = theme[bg];
      if (!a || !b) return `${fg} on ${bg}: missing token`;
      const ratio = contrast(a, b);
      return ratio >= min ? null : `${fg} ${a} on ${bg} ${b}: ${ratio.toFixed(2)} < ${min}`;
    })
    .filter((x): x is string => x !== null);
}

describe('design tokens', () => {
  it('parses both themes', () => {
    expect(Object.keys(LIGHT).length).toBeGreaterThan(40);
    expect(Object.keys(DARK_MEDIA).length).toBe(Object.keys(LIGHT).length);
  });

  it('keeps the two dark copies identical (system setting and data-theme="dark")', () => {
    expect(DARK_ATTR).toEqual(DARK_MEDIA);
  });

  it('defines the same colour tokens in light and dark', () => {
    expect(Object.keys(DARK_MEDIA).sort()).toEqual(Object.keys(LIGHT).sort());
  });

  it('light theme meets WCAG AA (4.5 text, 3 for UI parts)', () => {
    expect(failures(LIGHT)).toEqual([]);
  });

  it('dark theme meets WCAG AA (4.5 text, 3 for UI parts)', () => {
    expect(failures(DARK_MEDIA)).toEqual([]);
  });

  it('voice colours differ in lightness, in the same order in both themes', () => {
    for (const theme of [LIGHT, DARK_MEDIA]) {
      const lum = ['a', 's', 't', 'b'].map((v) => luminance(theme[`voice-${v}`] ?? '#000000'));
      // Alto lightest → Bass darkest, so the voices stay distinct in greyscale.
      for (let i = 1; i < lum.length; i++) expect(lum[i - 1]).toBeGreaterThan(lum[i] ?? 0);
      expect(contrast(theme['voice-a'] ?? '', theme['voice-b'] ?? '')).toBeGreaterThan(1.5);
    }
  });

  it('computes known contrast ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
