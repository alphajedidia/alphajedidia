// Small display formatters (dates, clock time, file names). Month names come from the
// dictionaries, so Malagasy dates do not depend on the browser's Intl locale data.
import type { MessageKey, TFunction } from '../i18n';

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today", "Yesterday", "3 Nov", or "3 Nov 2025" for another year. */
export function formatDate(ts: number, t: TFunction, now: Date = new Date()): string {
  const d = new Date(ts);
  if (sameDay(d, now)) return t('date.today');
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return t('date.yesterday');
  const month = t(`date.month.${d.getMonth() + 1}` as MessageKey);
  const params = { day: d.getDate(), month, year: d.getFullYear() };
  return d.getFullYear() === now.getFullYear() ? t('date.dayMonth', params) : t('date.dayMonthYear', params);
}

/** Seconds → "m:ss". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A song title → a safe file name (no path characters), never empty. */
export function safeFileName(title: string, ext: string, fallback = 'solfa'): string {
  const base = title
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || fallback}.${ext}`;
}

/** Fold case and accents for search ("Ténor" matches "tenor"). */
export function searchKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
