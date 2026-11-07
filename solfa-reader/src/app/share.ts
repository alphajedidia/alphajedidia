// Share links (I-07): the song text, compressed by storage.encodeShare, travels in the URL
// fragment `#/share/<payload>`; fragments are never sent to a server (ADR-012).
import { encodeShare } from '../storage';

/** Above this many characters some chat apps cut links (warn the user). */
export const LONG_LINK = 2000;

/** Location parts needed to build a link to this app (injectable for tests). */
export interface AppLocation {
  origin: string;
  pathname: string;
}

/** `https://host/path/` + `#/share/<payload>` (query and current fragment are dropped). */
export function shareUrlFromPayload(payload: string, loc: AppLocation = window.location): string {
  return `${loc.origin}${loc.pathname}#/share/${payload}`;
}

/** Song text → full share link. */
export async function createShareUrl(text: string, loc: AppLocation = window.location): Promise<string> {
  return shareUrlFromPayload(await encodeShare(text), loc);
}

/** Copy text to the clipboard (Clipboard API, else the old `execCommand` way). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or not focused: try the fallback below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Can the phone's share sheet be used for this data? */
export function canNativeShare(data: ShareData): boolean {
  if (typeof navigator.share !== 'function') return false;
  try {
    return typeof navigator.canShare === 'function' ? navigator.canShare(data) : true;
  } catch {
    return false;
  }
}
