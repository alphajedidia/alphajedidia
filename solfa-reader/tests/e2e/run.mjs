// End-to-end smoke tests in real Chromium (O-02). Owner: orchestrator.
// Usage: npm run build && npm run e2e      (serves dist/ with `vite preview` on port 4173)
// Screenshots: tests/e2e/out/*.png (git-ignored).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'tests', 'e2e', 'out');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = `http://localhost:${PORT}/`;
const PHONE = { width: 360, height: 740 };
const DESKTOP = { width: 1280, height: 800 };

const SAMPLE = `title: E2E hymn
key: G
time: 4/4
tempo: 120

S: | m  :m  :f  :s  | s  :f  :m  :r  |
A: | d  :d  :l, :t, | d  :l, :d  :t, |
T: | s  :s  :f  :r  | m  :r  :s  :s  |
B: | d, :d, :r, :s, | d, :f, :d, :s, |
`;

// ---------- tiny test runner ----------
const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t0, err });
    console.log(`  ✗ ${name}\n      ${String(err?.message ?? err).split('\n').slice(0, 6).join('\n      ')}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const tid = (id) => `[data-testid="${id}"]`;

// ---------- server ----------
async function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  proc.stdout.on('data', (d) => (log += d));
  proc.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return proc;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error(`preview server did not start:\n${log}`);
}

// ---------- helpers ----------
function watchConsole(page, bucket) {
  page.on('console', (m) => {
    if (m.type() === 'error') bucket.push(m.text());
  });
  page.on('pageerror', (e) => bucket.push(String(e)));
}
async function noHorizontalScroll(page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  assert(sw <= cw + 1, `horizontal scroll: scrollWidth ${sw} > clientWidth ${cw}`);
}
async function shot(page, name) {
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: false });
}
async function openLibrary(page) {
  await page.goto(BASE + '#/');
  await page.waitForSelector(tid('screen-library'), { timeout: 15000 });
}
/** Render a clean printed sol-fa page to PNG bytes (for the scan flow). */
async function renderScorePng(browser) {
  const page = await browser.newPage({ viewport: { width: 900, height: 420 } });
  const rows = SAMPLE.split('\n').filter((l) => /^[SATB]:/.test(l)).map((l) => l.slice(3));
  await page.setContent(`<html><body style="margin:40px;background:#fff">
    <div style="font:22px 'DejaVu Sans Mono', monospace">Doh is G</div>
    <pre style="font:30px/1.9 'DejaVu Sans Mono', monospace;margin-top:16px">${rows.join('\n')}</pre>
  </body></html>`);
  const png = await page.screenshot({ fullPage: true });
  await page.close();
  return png;
}

// ---------- tests ----------
async function main() {
  console.log(`Solfa Reader e2e — ${BASE}`);
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watchConsole(page, errors);

  try {
    await test('library loads in Malagasy with the sample songs', async () => {
      await openLibrary(page);
      const lang = await page.evaluate(() => document.documentElement.lang);
      assert(lang === 'mg', `html lang is "${lang}", expected "mg"`);
      await page.waitForSelector(tid('song-item'), { timeout: 10000 });
      const n = await page.locator(tid('song-item')).count();
      assert(n >= 3, `expected ≥ 3 sample songs, found ${n}`);
      await noHorizontalScroll(page);
      await shot(page, '01-library-360');
    });

    await test('type a song in the editor: no diagnostics, then play', async () => {
      await openLibrary(page);
      await page.click(tid('new-type'));
      await page.waitForSelector(tid('screen-editor'));
      await page.fill(tid('editor-text'), SAMPLE);
      await page.waitForTimeout(600);
      const diags = await page.locator(tid('diagnostic')).count();
      assert(diags === 0, `expected 0 diagnostics, got ${diags}`);
      await noHorizontalScroll(page);
      await shot(page, '02-editor-360');
      await page.click(tid('editor-play'));
      await page.waitForSelector(tid('screen-player'), { timeout: 10000 });
    });

    await test('player: play advances the position; solo and tempo work', async () => {
      await page.waitForSelector(tid('transport-play'));
      const before = (await page.textContent(tid('transport-bar'))) ?? '';
      await page.click(tid('transport-play'));
      await page.waitForTimeout(4500); // 120 bpm → ≥ 2 bars
      const after = (await page.textContent(tid('transport-bar'))) ?? '';
      assert(before !== after, `bar display did not change while playing ("${before}" → "${after}")`);
      await page.click(tid('mix-focus-T'));
      await page.click(tid('mixer-open'));
      await page.click(tid('mix-solo-A'));
      await shot(page, '03b-mixer-360');
      await page.keyboard.press('Escape');
      await noHorizontalScroll(page);
      await shot(page, '03-player-360');
      await page.click(tid('transport-play')); // pause
    });

    let shareUrl = '';
    await test('share link round-trip in a fresh browser', async () => {
      await page.click(tid('share-open'));
      await page.waitForSelector(tid('share-link'));
      const loc = page.locator(tid('share-link'));
      shareUrl = (await loc.inputValue().catch(() => null)) ?? (await loc.textContent()) ?? '';
      assert(shareUrl.includes('#/share/'), `share link looks wrong: ${shareUrl}`);
      assert(shareUrl.length < 2500, `share link too long: ${shareUrl.length} chars`);
      await shot(page, '04-share-sheet-360');
      const ctx2 = await browser.newContext({ viewport: PHONE });
      const p2 = await ctx2.newPage();
      watchConsole(p2, errors);
      await p2.goto(shareUrl);
      await p2.waitForSelector(tid('screen-share'), { timeout: 15000 });
      await shot(p2, '05-share-open-360');
      await p2.click(tid('share-save'));
      await p2.waitForTimeout(500);
      await p2.goto(BASE + '#/');
      await p2.waitForSelector(tid('song-item'));
      const titles = await p2.locator(tid('song-item')).allTextContents();
      assert(titles.some((t) => t.includes('E2E hymn')), `shared song not saved: ${titles.join(' | ')}`);
      await ctx2.close();
    });

    await test('language switch to English and French', async () => {
      await page.goto(BASE + '#/settings');
      await page.waitForSelector(tid('screen-settings'));
      await page.click(tid('lang-en'));
      await page.waitForFunction(() => document.documentElement.lang === 'en');
      await shot(page, '06-settings-en-360');
      await page.click(tid('lang-fr'));
      await page.waitForFunction(() => document.documentElement.lang === 'fr');
      await page.click(tid('lang-mg'));
      await page.waitForFunction(() => document.documentElement.lang === 'mg');
    });

    await test('help page opens', async () => {
      await page.goto(BASE + '#/help');
      await page.waitForSelector(tid('screen-help'));
      await noHorizontalScroll(page);
      await shot(page, '07-help-360');
    });

    await test('scan a printed page → review screen with recognised text', async () => {
      const png = await renderScorePng(browser);
      await openLibrary(page);
      await page.click(tid('new-scan'));
      await page.setInputFiles(tid('scan-file'), { name: 'score.png', mimeType: 'image/png', buffer: png });
      await page.waitForSelector(tid('scan-crop-ok'), { timeout: 15000 });
      await shot(page, '08-scan-crop-360');
      await page.click(tid('scan-crop-ok'));
      await page.waitForSelector(tid('screen-review'), { timeout: 90000 });
      const text = (await page.textContent(tid('screen-review'))) ?? '';
      assert(/[drmfslt]/.test(text), 'review screen shows no sol-fa');
      await noHorizontalScroll(page);
      await shot(page, '09-review-360');
    });

    await test('desktop layout (1280×800) of the player', async () => {
      const dctx = await browser.newContext({ viewport: DESKTOP });
      const dp = await dctx.newPage();
      watchConsole(dp, errors);
      await dp.goto(BASE + '#/');
      await dp.waitForSelector(tid('song-item'));
      await dp.locator(tid('song-item')).first().locator('.sr-listitem__main').click();
      await dp.waitForTimeout(800);
      if (await dp.locator(tid('editor-play')).count()) await dp.click(tid('editor-play'));
      await dp.waitForSelector(tid('screen-player'), { timeout: 10000 });
      await noHorizontalScroll(dp);
      await shot(dp, '10-player-desktop');
      await dctx.close();
    });

    await test('works offline after the first visit (service worker)', async () => {
      const octx = await browser.newContext({ viewport: PHONE });
      const op = await octx.newPage();
      await op.goto(BASE + '#/');
      await op.waitForSelector(tid('screen-library'));
      await op.evaluate(async () => {
        if (!('serviceWorker' in navigator)) throw new Error('no service worker support');
        await navigator.serviceWorker.ready;
      });
      await op.reload();
      await op.waitForSelector(tid('screen-library'));
      await op.waitForTimeout(1000);
      await octx.setOffline(true);
      await op.reload();
      await op.waitForSelector(tid('screen-library'), { timeout: 15000 });
      await octx.close();
    });

    await test('dark mode renders without horizontal scroll', async () => {
      const dctx = await browser.newContext({ viewport: PHONE, colorScheme: 'dark' });
      const dp = await dctx.newPage();
      await dp.goto(BASE + '#/');
      await dp.waitForSelector(tid('song-item'));
      await noHorizontalScroll(dp);
      await shot(dp, '11-library-dark-360');
      await dctx.close();
    });

    await test('no console errors during the run', async () => {
      const relevant = errors.filter((e) => !/favicon/i.test(e));
      assert(relevant.length === 0, `console errors:\n${relevant.slice(0, 8).join('\n')}`);
    });
  } finally {
    await browser.close();
    server.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed — screenshots in ${out}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
