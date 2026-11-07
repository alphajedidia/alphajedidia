// Theme (FR-30): `data-theme` on <html> (tokens.css reacts to it) and the browser bar colour.
import type { ThemePref } from '../storage';

/** `--sr-topbar-bg` of each theme (DESIGN.md §2): used for <meta name="theme-color">. */
export const TOPBAR_COLORS = { light: '#1f3a5f', dark: '#1a2638' } as const;

/** Apply a theme preference to the document. `auto` follows the phone. */
export function applyTheme(pref: ThemePref, doc: Document = document): void {
  const root = doc.documentElement;
  if (pref === 'auto') delete root.dataset.theme;
  else root.dataset.theme = pref;

  // index.html has one theme-color meta per colour scheme; a forced theme overrides both.
  const metas = Array.from(doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  if (metas.length === 0) {
    const meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.appendChild(meta);
    metas.push(meta);
  }
  for (const meta of metas) {
    const scheme = /dark/.test(meta.media) ? 'dark' : 'light';
    meta.content = TOPBAR_COLORS[pref === 'auto' ? scheme : pref];
  }
}
