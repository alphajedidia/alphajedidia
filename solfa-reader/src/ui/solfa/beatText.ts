import type { Accent, Beat, SolfaItem } from '../../core';

const SEPARATORS: Record<Accent, string> = { bar: '|', medium: '!', weak: ':', none: '' };

/** The separator printed before a beat (`|`, `!`, `:` or nothing). */
export function separatorFor(accent: Accent): string {
  return SEPARATORS[accent];
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

function itemText(item: SolfaItem): string {
  if (item.kind === 'rest') return '';
  if (item.kind === 'hold') return '-';
  return item.text;
}

/**
 * Division mark written before a part that starts at `start` (SOLFA_FORMAT §5):
 * `.` = half, `.,` = three quarters, `,` = next quarter or a triplet third.
 */
function divisionMark(start: number, afterHalf: boolean): string {
  if (near(start, 0.5)) return '.';
  if (near(start, 0.75)) return afterHalf ? ',' : '.,';
  return ',';
}

/** Rebuild the written text of one beat from its parts, e.g. parts d½ r½ → "d.r". */
export function beatText(beat: Beat): string {
  let out = '';
  let afterHalf = false;
  beat.parts.forEach((part, i) => {
    if (i > 0) out += divisionMark(part.start, afterHalf);
    if (near(part.start, 0.5)) afterHalf = true;
    out += itemText(part.item);
  });
  return out;
}
