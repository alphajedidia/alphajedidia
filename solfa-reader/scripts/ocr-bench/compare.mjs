// Benchmark helpers: a minimal .solfa reader (independent of src/core) and beat-cell scoring.

const SEP_RE = /^(\|\||\||:|!|¦)/;
const LABEL_RE = /^(S|A|T|B|Sop|Soprano|Alt|Alto|Ten|Tenor|Ténor|Bas|Bass|Basse)[:.=]?\s+/;

/** Split a voice line (label removed) into cells { sep, content } (content without spaces). */
export function splitVoiceLine(line, keepTrailing = false) {
  const cells = [{ sep: '', content: '' }];
  let s = line.replace(/\{[^}]*\}/g, '');
  while (s.length) {
    const m = SEP_RE.exec(s);
    if (m) {
      cells.push({ sep: m[1] === '¦' ? '!' : m[1], content: '' });
      s = s.slice(m[1].length);
    } else {
      if (!/\s/.test(s[0])) cells[cells.length - 1].content += s[0];
      s = s.slice(1);
    }
  }
  // Empty text before the first / after the last separator is ignored (SOLFA_FORMAT §4).
  if (cells[0].content === '') cells.shift();
  if (!keepTrailing && cells.length && cells[cells.length - 1].content === '' && cells[cells.length - 1].sep) cells.pop();
  return cells;
}

/** Parse a document into headers and systems of voice lines (by order) and words. */
export function parseDoc(text, keepTrailing = false) {
  const headers = {};
  const systems = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      cur = null;
      continue;
    }
    const h = /^([a-z][a-z-]*)\s*:\s*(.*)$/.exec(line);
    if (h && ['title', 'key', 'time', 'tempo', 'voices', 'composer'].includes(h[1])) {
      headers[h[1]] = h[2].trim();
      continue;
    }
    if (line.startsWith('#')) continue;
    if (!cur) {
      cur = { voices: [], words: [] };
      systems.push(cur);
    }
    if (/^(W|Words|Tonony):/.test(line)) {
      cur.words.push(line.replace(/^\w+:\s*/, ''));
      continue;
    }
    const lm = LABEL_RE.exec(line);
    cur.voices.push({ label: lm ? lm[1][0] : null, cells: splitVoiceLine(lm ? line.slice(lm[0].length) : line, keepTrailing) });
  }
  return { headers, systems };
}

/** Edit-distance alignment of two cell lists; returns matched pairs. */
function alignCells(truth, pred) {
  const n = truth.length;
  const m = pred.length;
  const cost = (a, b) => (a.content === b.content && a.sep === b.sep ? 0 : a.content === b.content || a.sep === b.sep ? 0.6 : 1);
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + cost(truth[i - 1], pred[j - 1]));
  const pairs = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (D[i][j] === D[i - 1][j - 1] + cost(truth[i - 1], pred[j - 1])) {
      pairs.push([truth[i - 1], pred[j - 1]]);
      i--;
      j--;
    } else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  return pairs.reverse();
}

/**
 * Score a predicted document against the truth, per beat cell. A cell is correct when its
 * separator and its content are both right; content-only and separator-only rates are also
 * returned. Systems and voices are matched by order.
 */
export function scoreDoc(truthText, predText) {
  const T = parseDoc(truthText);
  const P = parseDoc(predText);
  let cells = 0;
  let correct = 0;
  let contentOk = 0;
  let sepOk = 0;
  const errors = [];
  T.systems.forEach((ts, si) => {
    const ps = P.systems[si];
    ts.voices.forEach((tv, vi) => {
      const pv = ps?.voices[vi];
      cells += tv.cells.length;
      if (!pv) return;
      for (const [a, b] of alignCells(tv.cells, pv.cells)) {
        const c = a.content === b.content;
        const s = a.sep === b.sep;
        if (c) contentOk++;
        if (s) sepOk++;
        if (c && s) correct++;
        else if (errors.length < 40) errors.push(`s${si + 1}v${vi + 1}: '${a.sep}${a.content}' → '${b.sep}${b.content}'`);
      }
    });
  });
  const keyOk = (T.headers.key ?? '') === (P.headers.key ?? '');
  const timeOk = (T.headers.time ?? '') === (P.headers.time ?? '');
  return {
    cells,
    correct,
    accuracy: cells ? correct / cells : 0,
    contentAccuracy: cells ? contentOk / cells : 0,
    sepAccuracy: cells ? sepOk / cells : 0,
    systemsTruth: T.systems.length,
    systemsPred: P.systems.length,
    voicesOk: T.systems.every((s, i) => (P.systems[i]?.voices.length ?? 0) === s.voices.length),
    keyOk,
    timeOk,
    errors,
  };
}
