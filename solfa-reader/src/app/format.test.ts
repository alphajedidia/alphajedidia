import { describe, expect, it } from 'vitest';
import { createI18n } from '../i18n';
import { en } from '../i18n/en';
import { mg } from '../i18n/mg';
import { formatClock, formatDate, safeFileName, searchKey } from './format';

describe('format', () => {
  const now = new Date(2026, 10, 7, 12);
  it('formats dates with dictionary month names', () => {
    const t = createI18n('en', en).t;
    expect(formatDate(now.getTime(), t, now)).toBe('Today');
    expect(formatDate(new Date(2026, 10, 6, 9).getTime(), t, now)).toBe('Yesterday');
    expect(formatDate(new Date(2026, 2, 3).getTime(), t, now)).toBe('3 Mar');
    expect(formatDate(new Date(2025, 11, 25).getTime(), t, now)).toBe('25 Dec 2025');
    expect(formatDate(new Date(2026, 5, 1).getTime(), createI18n('mg', mg).t, now)).toBe('1 Jona');
  });
  it('formats the clock, file names and search keys', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.7)).toBe('1:05');
    expect(safeFileName('Hira / fiderana: 1', 'wav')).toBe('Hira fiderana 1.wav');
    expect(safeFileName('  ', 'mid')).toBe('solfa.mid');
    expect(searchKey('Ténor ')).toBe('tenor');
  });
});
