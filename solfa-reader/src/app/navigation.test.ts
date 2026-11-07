// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { canGoBack, goBack, navigate } from './navigation';

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('navigation', () => {
  it('pushes, replaces and goes back inside the app', async () => {
    expect(canGoBack()).toBe(false);
    navigate('/help');
    expect(window.location.hash).toBe('#/help');
    expect(canGoBack()).toBe(true);
    navigate('/settings', { replace: true });
    expect(window.location.hash).toBe('#/settings');
    goBack();
    await flush();
    expect(window.location.hash).toBe('');
    expect(canGoBack()).toBe(false);
  });

  it('back with no app history replaces with the fallback', () => {
    goBack('/help');
    expect(window.location.hash).toBe('#/help');
    expect(canGoBack()).toBe(false);
  });
});
