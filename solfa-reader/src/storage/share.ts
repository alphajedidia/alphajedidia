/**
 * Share-link codec (ADR-012): song text → URL-safe payload for `#/share/<payload>`.
 * Payload = 1-char version prefix + base64url body:
 *   'z' = UTF-8 compressed with deflate-raw (CompressionStream), 'p' = plain UTF-8.
 * Pure: no DOM, runs in Vitest's node environment.
 */

export type ShareErrorCode = 'empty' | 'bad-prefix' | 'bad-encoding' | 'bad-data' | 'too-large' | 'unsupported';

/** Thrown by `decodeShare` for links that cannot be read; `code` is stable for the UI. */
export class ShareDecodeError extends Error {
  readonly code: ShareErrorCode;
  constructor(code: ShareErrorCode, message: string) {
    super(message);
    this.name = 'ShareDecodeError';
    this.code = code;
  }
}

/** True for errors thrown by `decodeShare`. */
export function isShareDecodeError(err: unknown): err is ShareDecodeError {
  return err instanceof ShareDecodeError;
}

/** Largest decoded song we accept (protects against "zip bomb" links). */
export const MAX_SHARE_BYTES = 512 * 1024;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP: ReadonlyMap<string, number> = new Map(
  [...ALPHABET].map((c, i) => [c, i] as const).concat([
    ['+', 62],
    ['/', 63],
  ]),
);

/** Bytes → base64url without padding. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63);
    if (i + 1 < bytes.length) out += ALPHABET.charAt((n >> 6) & 63);
    if (i + 2 < bytes.length) out += ALPHABET.charAt(n & 63);
  }
  return out;
}

/** base64url (padding and standard `+/` tolerated) → bytes; throws `ShareDecodeError`. */
export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  const s = text.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new ShareDecodeError('bad-encoding', 'truncated base64 data');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let n = 0;
    const chunk = s.slice(i, i + 4);
    for (let k = 0; k < 4; k++) {
      const c = chunk.charAt(k);
      const v = c === '' ? 0 : LOOKUP.get(c);
      if (v === undefined) throw new ShareDecodeError('bad-encoding', `invalid character "${c}"`);
      n = (n << 6) | v;
    }
    const bytes = [(n >> 16) & 255, (n >> 8) & 255, n & 255].slice(0, chunk.length - 1);
    for (const b of bytes) out[o++] = b;
  }
  return out;
}

/** Run bytes through a (de)compression stream, stopping once `limit` output bytes are passed. */
async function pipeThrough(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  // Errors also surface on the read side; this only avoids an unhandled rejection.
  writer
    .write(bytes)
    .then(() => writer.close())
    .catch(() => undefined);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ShareDecodeError('too-large', 'shared song is too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function hasCompression(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

/** Song text → URL-safe payload for `#/share/<payload>`. B-09 */
export async function encodeShare(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const plain = `p${base64UrlEncode(bytes)}`;
  if (!hasCompression()) return plain;
  try {
    const packed = await pipeThrough(bytes, new CompressionStream('deflate-raw'), Number.MAX_SAFE_INTEGER);
    const zipped = `z${base64UrlEncode(packed)}`;
    return zipped.length < plain.length ? zipped : plain;
  } catch {
    return plain;
  }
}

/** Payload from a share link → song text. Throws `ShareDecodeError` for anything unreadable. B-09 */
export async function decodeShare(payload: string): Promise<string> {
  const p = typeof payload === 'string' ? payload.trim() : '';
  if (p === '') throw new ShareDecodeError('empty', 'empty share link');
  const kind = p.charAt(0);
  if (kind !== 'p' && kind !== 'z') throw new ShareDecodeError('bad-prefix', 'unknown share link version');
  const body = base64UrlDecode(p.slice(1));
  let bytes: Uint8Array<ArrayBuffer>;
  if (kind === 'p') {
    if (body.length > MAX_SHARE_BYTES) throw new ShareDecodeError('too-large', 'shared song is too large');
    bytes = body;
  } else {
    if (!hasCompression()) throw new ShareDecodeError('unsupported', 'this browser cannot open compressed links');
    try {
      bytes = await pipeThrough(body, new DecompressionStream('deflate-raw'), MAX_SHARE_BYTES);
    } catch (err) {
      if (isShareDecodeError(err)) throw err;
      throw new ShareDecodeError('bad-data', 'damaged share link');
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ShareDecodeError('bad-data', 'share link is not valid text');
  }
}
