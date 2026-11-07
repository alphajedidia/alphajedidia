import { describe, expect, it } from 'vitest';
import { hashPath, parseRoute, routePath, screenKey, type Route } from './router';

describe('parseRoute', () => {
  it('reads every route', () => {
    expect(parseRoute('')).toEqual({ name: 'library' });
    expect(parseRoute('#/')).toEqual({ name: 'library' });
    expect(parseRoute('#/new')).toEqual({ name: 'new' });
    expect(parseRoute('#/scan')).toEqual({ name: 'scan', step: 'capture' });
    expect(parseRoute('#/scan/crop')).toEqual({ name: 'scan', step: 'crop' });
    expect(parseRoute('#/scan/review')).toEqual({ name: 'scan', step: 'review' });
    expect(parseRoute('#/edit/abc')).toEqual({ name: 'edit', id: 'abc' });
    expect(parseRoute('#/play/sample-chorale-g')).toEqual({ name: 'play', id: 'sample-chorale-g' });
    expect(parseRoute('#/share/zAbC-_9')).toEqual({ name: 'share', payload: 'zAbC-_9' });
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
    expect(parseRoute('#/help')).toEqual({ name: 'help' });
    expect(parseRoute('#/gallery')).toEqual({ name: 'gallery' });
  });

  it('decodes ids and ignores a query', () => {
    expect(parseRoute('#/play/a%20b?x=1')).toEqual({ name: 'play', id: 'a b' });
    expect(hashPath('#/help?x')).toBe('/help');
    expect(hashPath('help')).toBe('/help');
  });

  it('gives notFound for unknown or malformed paths (never throws)', () => {
    expect(parseRoute('#/nope')).toEqual({ name: 'notFound', path: '/nope' });
    expect(parseRoute('#/play')).toMatchObject({ name: 'notFound' });
    expect(parseRoute('#/play/%E0%A4%A')).toMatchObject({ name: 'notFound' });
    expect(parseRoute('#/scan/x')).toMatchObject({ name: 'notFound' });
    expect(parseRoute('#/settings/x')).toMatchObject({ name: 'notFound' });
  });

  it('round-trips with routePath', () => {
    const routes: Route[] = [
      { name: 'library' },
      { name: 'new' },
      { name: 'scan', step: 'capture' },
      { name: 'scan', step: 'read' },
      { name: 'edit', id: 'x/y z' },
      { name: 'play', id: '123' },
      { name: 'share', payload: 'pAbc' },
      { name: 'settings' },
      { name: 'help' },
      { name: 'gallery' },
    ];
    for (const r of routes) expect(parseRoute(`#${routePath(r)}`)).toEqual(r);
  });

  it('keeps one editor screen for #/new and #/edit/:id', () => {
    expect(screenKey({ name: 'new' })).toBe(screenKey({ name: 'edit', id: 'a' }));
    expect(screenKey({ name: 'play', id: 'a' })).not.toBe(screenKey({ name: 'play', id: 'b' }));
  });
});
