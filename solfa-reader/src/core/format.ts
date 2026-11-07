import { classifyLines, splitLines } from './lines';
import type { VoiceLineInfo } from './lines';
import { scanMusic } from './scan';

interface Row {
  index: number;
  label: string;
  /** Non-beat text before the first separator (only `{…}` groups), kept as is. */
  prefix: string;
  beats: Array<{ sep: string; text: string }>;
  /** Separator (and any `{…}` text) after the last beat. */
  closing: { sep: string; text: string } | null;
}

/** How a separator is written in canonical form: a bar line is followed by one space. */
function sepText(sep: string): string {
  return sep === '|' || sep === '||' ? `${sep} ` : sep;
}

function toRow(info: VoiceLineInfo): Row {
  const scanned = scanMusic(info.raw, info.musicCol);
  const row: Row = {
    index: info.index,
    label: info.label?.text ?? '',
    prefix: '',
    beats: [],
    closing: null,
  };
  scanned.cells.forEach((cell, k) => {
    const text = cell.raw.trim();
    if (cell.isBeat) row.beats.push({ sep: cell.sep, text });
    else if (k === 0) row.prefix = text;
    else row.closing = { sep: cell.sep, text };
  });
  return row;
}

function formatRows(rows: Row[]): string[] {
  const labelW = Math.max(0, ...rows.map((r) => r.label.length));
  const prefixW = Math.max(0, ...rows.map((r) => r.prefix.length));
  const columns = Math.max(0, ...rows.map((r) => r.beats.length));
  const sepW: number[] = [];
  const textW: number[] = [];
  for (let k = 0; k < columns; k++) {
    sepW.push(Math.max(0, ...rows.map((r) => sepText(r.beats[k]?.sep ?? '').length)));
    textW.push(Math.max(0, ...rows.map((r) => r.beats[k]?.text.length ?? 0)));
  }
  return rows.map((r) => {
    let out = labelW > 0 ? `${r.label.padEnd(labelW)} ` : '';
    if (prefixW > 0) out += `${r.prefix.padEnd(prefixW)} `;
    r.beats.forEach((b, k) => {
      out += sepText(b.sep).padEnd(sepW[k] ?? 0) + b.text.padEnd(textW[k] ?? 0) + ' ';
    });
    if (r.closing) {
      out += r.closing.sep + (r.closing.text ? ` ${r.closing.text}` : '');
    }
    return out.trimEnd();
  });
}

/**
 * Align beat columns of the voice lines of each system (SOLFA_FORMAT.md §9): every separator
 * at the same column in every voice, one space before each separator and after each bar line.
 * Headers, words, comments and blank lines are kept unchanged. Idempotent. B-03
 */
export function formatSolfa(text: string): string {
  const out = splitLines(text);
  const groups = new Map<number, VoiceLineInfo[]>();
  for (const line of classifyLines(text)) {
    if (line.kind !== 'voice') continue;
    const group = groups.get(line.system) ?? [];
    group.push(line);
    groups.set(line.system, group);
  }
  for (const group of groups.values()) {
    const rows = group.map(toRow);
    formatRows(rows).forEach((formatted, k) => {
      const row = rows[k];
      if (row) out[row.index] = formatted;
    });
  }
  return out.join('\n');
}
