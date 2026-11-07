import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPEC_EXAMPLE } from '../core/test-helpers';
import {
  MAX_SHARE_BYTES,
  ShareDecodeError,
  base64UrlDecode,
  base64UrlEncode,
  decodeShare,
  encodeShare,
  isShareDecodeError,
} from './share';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'no error';
  } catch (err) {
    return isShareDecodeError(err) ? err.code : `other: ${String(err)}`;
  }
}

/** Raw deflate of bytes (test helper). */
async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe('base64url', () => {
  // RFC 4648 §10 test vectors, without padding.
  it.each([
    ['', ''],
    ['f', 'Zg'],
    ['fo', 'Zm8'],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg'],
    ['fooba', 'Zm9vYmE'],
    ['foobar', 'Zm9vYmFy'],
  ])('round-trips "%s"', (s, expected) => {
    const bytes = new TextEncoder().encode(s);
    const enc = base64UrlEncode(bytes);
    expect(enc).toBe(expected);
    expect(base64UrlDecode(enc)).toEqual(bytes);
  });

  it('uses the URL-safe alphabet', () => {
    expect(base64UrlEncode(Uint8Array.from([0xfb, 0xff, 0xbf]))).toBe('-_-_');
  });

  it('round-trips all byte values', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
  });

  it('tolerates padding and the standard alphabet', () => {
    expect(new TextDecoder().decode(base64UrlDecode('Zm9vYg=='))).toBe('foob');
    expect(base64UrlDecode('+/+/')).toEqual(base64UrlDecode('-_-_'));
  });

  it('rejects invalid input with a typed error', () => {
    expect(() => base64UrlDecode('ab$c')).toThrow(ShareDecodeError);
    expect(() => base64UrlDecode('abcde')).toThrow(ShareDecodeError);
  });
});

describe('share codec', () => {
  it('round-trips the spec example compressed', async () => {
    const payload = await encodeShare(SPEC_EXAMPLE);
    expect(payload.startsWith('z')).toBe(true);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(payload.length).toBeLessThan(SPEC_EXAMPLE.length);
    expect(await decodeShare(payload)).toBe(SPEC_EXAMPLE);
  });

  it('round-trips unicode, empty and short texts', async () => {
    for (const text of ['', 'd', 'Ténor: | d :r |\nW: Ry Tompo ô 🎵', 'B♭ dièse ₁ ² — ¦']) {
      expect(await decodeShare(await encodeShare(text))).toBe(text);
    }
  });

  it('uses plain encoding when it is shorter', async () => {
    const payload = await encodeShare('d');
    expect(payload).toBe('pZA');
    expect(await decodeShare(payload)).toBe('d');
  });

  it('falls back to plain when CompressionStream is missing', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const payload = await encodeShare(SPEC_EXAMPLE);
    expect(payload.startsWith('p')).toBe(true);
    expect(await decodeShare(payload)).toBe(SPEC_EXAMPLE);
  });

  it('reports compressed links as unsupported without DecompressionStream', async () => {
    const payload = await encodeShare(SPEC_EXAMPLE);
    vi.stubGlobal('DecompressionStream', undefined);
    expect(await codeOf(decodeShare(payload))).toBe('unsupported');
  });

  it('trims whitespace around the payload', async () => {
    const payload = await encodeShare('S: | d |');
    expect(await decodeShare(`  ${payload}\n`)).toBe('S: | d |');
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['x123', 'bad-prefix'],
    ['p$$$', 'bad-encoding'],
    ['pabcde', 'bad-encoding'],
    ['zAAAA', 'bad-data'],
    ['z' + 'A'.repeat(40), 'bad-data'],
    ['p_w', 'bad-data'],
  ])('rejects garbage %j with %s', async (payload, code) => {
    expect(await codeOf(decodeShare(payload))).toBe(code);
  });

  it('rejects a truncated compressed link', async () => {
    const payload = await encodeShare(SPEC_EXAMPLE);
    expect(await codeOf(decodeShare(payload.slice(0, Math.floor(payload.length / 2))))).toMatch(/bad-data|bad-encoding/);
  });

  it('rejects links that inflate to a huge text', async () => {
    const huge = new Uint8Array(MAX_SHARE_BYTES + 10).fill(65);
    const payload = `z${base64UrlEncode(await deflate(huge))}`;
    expect(payload.length).toBeLessThan(5000);
    expect(await codeOf(decodeShare(payload))).toBe('too-large');
  });

  it('rejects a plain link that is too large', async () => {
    const payload = `p${base64UrlEncode(new Uint8Array(MAX_SHARE_BYTES + 3).fill(65))}`;
    expect(await codeOf(decodeShare(payload))).toBe('too-large');
  });

  it('never throws anything but ShareDecodeError on random payloads', async () => {
    const chars = 'pzAZaz09-_=+/$ é';
    let seed = 3;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 300; i++) {
      let s = '';
      const len = Math.floor(next() * 40);
      for (let k = 0; k < len; k++) s += chars.charAt(Math.floor(next() * chars.length));
      const code = await codeOf(decodeShare(s));
      expect(code.startsWith('other')).toBe(false);
    }
  });
});
