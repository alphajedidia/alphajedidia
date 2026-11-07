import { describe, expect, it } from 'vitest';
import { decodeShare } from '../storage';
import { createShareUrl, shareUrlFromPayload } from './share';
import { parseRoute } from './router';

const loc = { origin: 'https://example.github.io', pathname: '/alphajedidia/' };

describe('share URL', () => {
  it('puts the payload in the fragment of the app URL', () => {
    expect(shareUrlFromPayload('pAbc', loc)).toBe('https://example.github.io/alphajedidia/#/share/pAbc');
  });

  it('round-trips a song through the link and the router', async () => {
    const text = 'title: Hira\nkey: G\n\nS: | d :r :m :f |\nA: | d :t, :d :r |';
    const url = await createShareUrl(text, loc);
    const route = parseRoute(new URL(url).hash);
    expect(route.name).toBe('share');
    if (route.name !== 'share') return;
    expect(await decodeShare(route.payload)).toBe(text);
  });
});
