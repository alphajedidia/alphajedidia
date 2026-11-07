// Render a .solfa fixture as a printed tonic sol-fa page (HTML/CSS), the way hymn books lay it
// out: one CSS grid per system so beat separators line up across voices, lyrics rows between
// or under the voices, optional ruled (graphic) bar lines spanning the voices.
import { parseDoc } from './compare.mjs';

const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// "Hand-written" look: every glyph slightly rotated, shifted and resized (deterministic).
let jitter = null;
function seeded(seed) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const esc = (s) => {
  if (!jitter) return escText(s);
  return [...s]
    .map((ch) => {
      if (ch === ' ') return ' ';
      const r = jitter.rnd;
      const rot = (r() - 0.5) * 2 * jitter.rot;
      const dy = (r() - 0.5) * 2 * jitter.dy;
      const sc = 1 + (r() - 0.5) * 2 * jitter.scale;
      const dx = (r() - 0.5) * 2 * jitter.dx;
      return `<span style="display:inline-block;transform:translate(${dx.toFixed(3)}em,${dy.toFixed(3)}em) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(2)})">${escText(ch)}</span>`;
    })
    .join('');
};

/** Read the voice/words lines of each system in printed order (words keep their position). */
function systemsInOrder(text) {
  const out = [];
  let cur = null;
  const doc = parseDoc(text, true);
  let vi = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      cur = null;
      continue;
    }
    if (/^(title|key|time|tempo|voices|composer)\s*:/.test(line) || line.startsWith('#')) continue;
    if (!cur) {
      cur = { rows: [], sys: doc.systems[out.length] };
      out.push(cur);
      vi = 0;
    }
    if (/^W:/.test(line)) cur.rows.push({ kind: 'words', text: line.slice(2).trim() });
    else {
      const v = cur.sys.voices[vi++];
      cur.rows.push({ kind: 'voice', label: v.label ?? 'SATB'[vi - 1], cells: v.cells });
    }
  }
  return { headers: doc.headers, systems: out };
}

/**
 * style: { font, size (px), bars: 'text' | 'rule', labels: boolean, lineHeight, width (px) }
 */
export function renderHtml(fixture, style) {
  jitter = style.jitter ? { rnd: seeded(style.seed ?? 7), rot: 7, dy: 0.08, dx: 0.05, scale: 0.12 } : null;
  const { headers, systems } = systemsInOrder(fixture.text);
  const font = style.font ?? 'DejaVu Serif';
  const size = style.size ?? 20;
  const lh = style.lineHeight ?? 1.75;
  const labels = style.labels ?? fixture.labels ?? false;
  const rule = style.bars === 'rule';
  const keyLine = [`Doh is ${headers.key ?? 'C'}.`, headers.time ?? '', headers.tempo ? `M. ${headers.tempo}` : '']
    .filter(Boolean)
    .join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
  let body = `<h1>${esc(headers.title ?? '')}</h1><div class="key">${keyLine}</div>`;
  for (const s of systems) {
    // Column count: pick-up column + one (sep, content) pair per separator.
    const voices = s.rows.filter((r) => r.kind === 'voice');
    const hasPick = voices.some((v) => v.cells[0] && v.cells[0].sep === '');
    const maxSeps = Math.max(...voices.map((v) => v.cells.filter((c) => c.sep).length + 1));
    const ncols = (labels ? 1 : 0) + 1 + 2 * maxSeps;
    let grid = `<div class="sys" style="grid-template-columns: repeat(${ncols}, max-content)">`;
    for (const r of s.rows) {
      if (r.kind === 'words') {
        grid += `<div class="words" style="grid-column: 1 / -1">${esc(r.text)}</div>`;
        continue;
      }
      if (labels) grid += `<div class="label">${r.label}.</div>`;
      const cells = [...r.cells];
      const pick = cells[0] && cells[0].sep === '' ? cells.shift() : null;
      grid += `<div class="c pre">${hasPick && pick ? esc(pick.content) : ''}</div>`;
      for (let j = 0; j < maxSeps; j++) {
        const c = cells[j];
        grid += c ? sepCell(c.sep, rule) : '<div class="s"></div>';
        grid += `<div class="c">${c ? esc(c.content) : ''}</div>`;
      }
    }
    grid += '</div>';
    body += grid;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#fff;color:#111}
  body{width:${style.width ?? 980}px;padding:36px 44px;box-sizing:border-box;font-family:'${font}';font-size:${size}px;${style.jitter ? 'font-weight:bold;letter-spacing:.04em;' : ''}}
  h1{font-size:1.45em;text-align:center;margin:0 0 .5em;font-weight:bold}
  .key{margin:0 0 1.1em;font-size:1em}
  .sys{display:grid;margin:0 0 ${(style.systemGap ?? 1.6).toFixed(2)}em;line-height:${lh}}
  .c{padding:0 .55em 0 .12em;white-space:pre}
  .pre{text-align:right}
  .s{text-align:center;min-width:.35em}
  .label{padding-right:.8em;font-weight:bold}
  .words{font-style:italic;font-size:.88em;padding:.05em 0 .25em 2.2em;line-height:1.5}
  .rb{width:0;border-left:${rule ? 2 : 0}px solid #111;margin:0 .25em}
  .rbb{width:4px;border-left:2px solid #111;border-right:5px solid #111;margin:0 .25em}
  </style></head><body>${body}</body></html>`;
}

function sepCell(sep, rule) {
  if (rule && sep === '|') return '<div class="s"><div class="rb" style="height:100%"></div></div>';
  if (rule && sep === '||') return '<div class="s"><div class="rbb" style="height:100%"></div></div>';
  return `<div class="s">${esc(sep)}</div>`;
}
