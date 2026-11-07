// OCR benchmark: render synthetic printed sol-fa pages in Chromium, run the real pipeline
// (src/ocr via the Vite dev server) in the browser, score beat cells against ground truth.
//
//   node scripts/ocr-bench/run.mjs            # full matrix (clean + degraded)
//   node scripts/ocr-bench/run.mjs --quick    # clean pages, one font
//   options: --fixture=<id> --font="<family>" --deg=<name> --no-server --dump --verbose
//
// Uses port 5175 (dev server started and stopped by this script unless --no-server).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from './fixtures.mjs';
import { renderHtml } from './render.mjs';
import { scoreDoc } from './compare.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const outDir = join(here, 'out');
const PORT = 5175;
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const FONTS = ['DejaVu Serif', 'Liberation Serif', 'Liberation Sans', 'DejaVu Sans', 'FreeSerif'];
const DEGRADATIONS = {
  rotate2: { rotate: 2 },
  rotate4: { rotate: -4 },
  blur: { blur: 0.9 },
  noise: { noise: 28 },
  jpeg: { jpeg: 0.45 },
  small: { scale: 0.62 },
  photo: { rotate: 1.3, shade: 0.35, noise: 14, blur: 0.5, jpeg: 0.6 },
};

function cases() {
  const out = [];
  const fx = FIXTURES.filter((f) => !args.fixture || f.id === args.fixture);
  const fonts = args.font ? [args.font] : args.quick ? ['DejaVu Serif'] : FONTS;
  for (const f of fx) {
    if (!args.deg || args.deg === 'clean') {
      for (const font of fonts) out.push({ set: 'clean', f, style: { font, size: 20, bars: 'text' }, deg: {}, degName: 'clean' });
      if (!args.quick && !args.font) {
        for (const font of ['Liberation Sans', 'DejaVu Serif']) {
          out.push({ set: 'clean', f, style: { font, size: 20, bars: 'rule' }, deg: {}, degName: 'clean-ruled' });
        }
        out.push({ set: 'clean', f, style: { font: 'Liberation Serif', size: 26, bars: 'text' }, deg: {}, degName: 'clean-large' });
      }
    }
    if (args.quick && !args.deg) continue;
    for (const [name, deg] of Object.entries(DEGRADATIONS)) {
      if (args.deg && args.deg !== name) continue;
      for (const font of args.font ? [args.font] : ['DejaVu Serif', 'Liberation Sans']) {
        out.push({ set: 'degraded', f, style: { font, size: 20, bars: name === 'photo' ? 'rule' : 'text' }, deg, degName: name });
      }
    }
  }
  return out;
}

async function waitForServer(url, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`server not reachable: ${url}`);
}

const pct = (x) => `${(100 * x).toFixed(1)}%`;

async function main() {
  let server = null;
  if (!args['no-server']) {
    server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', detached: true });
  }
  const benchUrl = `http://localhost:${PORT}/scripts/ocr-bench/bench.html`;
  const browser = await chromium.launch();
  try {
    await waitForServer(benchUrl);
    const renderPage = await browser.newPage({ deviceScaleFactor: 1.6, viewport: { width: 980, height: 600 } });
    const ocrPage = await browser.newPage();
    if (args.verbose) ocrPage.on('console', (m) => console.log('[page]', m.text()));
    await ocrPage.goto(benchUrl);
    await ocrPage.waitForFunction(() => typeof window.__ocr === 'function', null, { timeout: 60000 });
    const rows = [];
    if (args.dump) mkdirSync(outDir, { recursive: true });
    for (const c of cases()) {
      await renderPage.setContent(renderHtml(c.f, c.style));
      const png = await renderPage.screenshot({ fullPage: true, type: 'png' });
      const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
      const res = await ocrPage.evaluate(([d, deg]) => window.__ocr(d, deg), [dataUrl, c.deg]);
      const sc = scoreDoc(c.f.text, res.text);
      const row = {
        set: c.set,
        fixture: c.f.id,
        font: c.style.font,
        bars: c.style.bars,
        deg: c.degName,
        cells: sc.cells,
        correct: sc.correct,
        accuracy: sc.accuracy,
        content: sc.contentAccuracy,
        seps: sc.sepAccuracy,
        systemsOk: sc.systemsPred === sc.systemsTruth && sc.voicesOk,
        keyOk: sc.keyOk,
        timeOk: sc.timeOk,
        ms: res.durationMs,
        uncertain: res.uncertain.length,
        warnings: res.warnings,
        errors: sc.errors,
      };
      rows.push(row);
      console.log(
        `${row.set.padEnd(8)} ${row.fixture.padEnd(17)} ${row.font.padEnd(16)} ${row.deg.padEnd(11)} cells ${pct(row.accuracy).padStart(6)}  content ${pct(row.content).padStart(6)}  seps ${pct(row.seps).padStart(6)}  sys ${row.systemsOk ? 'ok' : 'NO'}  key ${row.keyOk ? 'ok' : 'NO'}  ${row.ms} ms`,
      );
      if (args.verbose && row.errors.length) console.log('   ', row.errors.slice(0, 12).join('\n    '));
      if (args.verbose) console.log(res.text);
      if (args.dump) {
        const base = `${c.f.id}__${c.style.font.replace(/\s+/g, '')}__${c.degName}`;
        writeFileSync(join(outDir, `${base}.png`), png);
        writeFileSync(join(outDir, `${base}.txt`), res.text);
      }
    }
    // Summary per set and per degradation.
    const agg = (list) => {
      const cells = list.reduce((s, r) => s + r.cells, 0);
      const correct = list.reduce((s, r) => s + r.correct, 0);
      return { n: list.length, cells, acc: cells ? correct / cells : 0, ms: Math.round(list.reduce((s, r) => s + r.ms, 0) / Math.max(1, list.length)) };
    };
    const lines = ['', '| Set | Variant | Pages | Beat cells | Correct | Mean time |', '|---|---|---|---|---|---|'];
    const groups = new Map();
    for (const r of rows) {
      const k = `${r.set}|${r.deg}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    for (const [k, list] of groups) {
      const [set, deg] = k.split('|');
      const a = agg(list);
      lines.push(`| ${set} | ${deg} | ${a.n} | ${a.cells} | ${pct(a.acc)} | ${a.ms} ms |`);
    }
    for (const set of ['clean', 'degraded']) {
      const list = rows.filter((r) => r.set === set);
      if (list.length) {
        const a = agg(list);
        lines.push(`| **${set} total** | | ${a.n} | ${a.cells} | **${pct(a.acc)}** | ${a.ms} ms |`);
      }
    }
    const fxLines = ['', '| Fixture | Clean pages | Correct (clean) |', '|---|---|---|'];
    for (const f of FIXTURES) {
      const list = rows.filter((r) => r.set === 'clean' && r.fixture === f.id);
      if (list.length) fxLines.push(`| ${f.id} | ${list.length} | ${pct(agg(list).acc)} |`);
    }
    console.log([...lines, ...fxLines].join('\n'));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'results.json'), JSON.stringify(rows, null, 2));
    writeFileSync(join(outDir, 'summary.md'), [...lines, ...fxLines].join('\n') + '\n');
  } finally {
    await browser.close();
    if (server) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        server.kill('SIGTERM');
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
