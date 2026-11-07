// Real-photo benchmark: scripts/ocr-bench/real/*.jpg + ground truth *.solfa + crops.json
// (all git-ignored: the songs may be copyrighted). Same pipeline as the app's scan flow.
//   node scripts/ocr-bench/run-real.mjs [--mode=rect|quad|auto|all] [--photo=<id>] [--verbose] [--debug] [--handwriting]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreDoc } from './compare.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const realDir = join(here, 'real');
const outDir = join(here, 'out');
const PORT = 5175;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));

if (!existsSync(join(realDir, 'crops.json'))) {
  console.log('no real photos (scripts/ocr-bench/real/crops.json missing) — nothing to do');
  process.exit(0);
}
const crops = JSON.parse(readFileSync(join(realDir, 'crops.json'), 'utf8'));
const pct = (x) => `${(100 * x).toFixed(1)}%`;

const server = spawn('npx', ['vite', '--config', join(here, 'vite.bench.config.mjs'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', detached: true });
const browser = await chromium.launch();
try {
  const url = `http://localhost:${PORT}/scripts/ocr-bench/bench.html`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(() => typeof window.__ocrReal === 'function', null, { timeout: 60000 });
  mkdirSync(outDir, { recursive: true });
  const rows = [];
  for (const [id, c] of Object.entries(crops)) {
    if (args.photo && args.photo !== id) continue;
    const truth = readFileSync(join(realDir, `${id}.solfa`), 'utf8');
    const modes = args.mode === 'all' || !args.mode ? ['rect', ...(c.quad ? ['quad'] : []), 'auto'] : [args.mode];
    for (const mode of modes) {
      const opts = { ...c, mode, srcWidth: c.srcWidth ?? 3000, handwriting: !!args.handwriting, png: !!args.dump };
      const res = await page.evaluate(([u, o]) => window.__ocrReal(u, o), [`/scripts/ocr-bench/real/${id}.jpg`, opts]);
      const sc = scoreDoc(truth, res.text);
      rows.push({ id, mode, ...sc, ms: res.ms, parse: res.parse, warnings: res.warnings });
      if (res.quad) console.log("   auto quad:", JSON.stringify(res.quad.map((p) => [Math.round(p.x), Math.round(p.y)])), "size", res.size);
      console.log(`${id.padEnd(26)} ${mode.padEnd(5)} cells ${pct(sc.accuracy).padStart(6)} (${sc.correct}/${sc.cells})  content ${pct(sc.contentAccuracy)}  seps ${pct(sc.sepAccuracy)}  systems ${sc.systemsPred}  key ${sc.keyOk ? 'ok' : 'NO'}  parse ${res.parse.errors === 0 ? 'ok' : 'ERR'} ${res.parse.codes.join(',')}  ${res.ms} ms  [${res.warnings.join(',')}]`);
      if (args.verbose) console.log(sc.errors.slice(0, 30).join('\n') + '\n' + res.text);
      writeFileSync(join(outDir, `real-${id}-${mode}.txt`), res.text);
      if (res.png) writeFileSync(join(outDir, `real-${id}-${mode}.png`), Buffer.from(res.png.split(',')[1], 'base64'));
      if (args.debug && mode !== 'auto') {
        const dbg = await page.evaluate(([u, o]) => window.__debugReal(u, o), [`/scripts/ocr-bench/real/${id}.jpg`, opts]);
        writeFileSync(join(outDir, `real-${id}-${mode}.debug.png`), Buffer.from(dbg.png.split(',')[1], 'base64'));
        for (const r of dbg.rows) console.log(`  ${r.kind.padEnd(5)} y=${r.band.y0}-${r.band.y1} xh=${r.metrics.xHeight.toFixed(1)} ${r.items}`);
      }
    }
  }
  writeFileSync(join(outDir, 'real-results.json'), JSON.stringify(rows, null, 2));
} finally {
  await browser.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
}
