// Copies the Tesseract (OCR) worker, WASM cores and English LSTM model from
// node_modules into public/tesseract so the site never needs a CDN at runtime
// (works offline, and on GitHub Pages / any static host).
// Owner: solfa-ai agent. Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'tesseract');

const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // LSTM-only cores (we run OEM.LSTM_ONLY). The worker picks one at runtime by CPU support.
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  // Small (2.9 MB) integer LSTM English model.
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
];

for (const [from, to] of files) {
  const src = join(nm, from);
  const dst = join(out, to);
  if (!existsSync(src)) {
    console.error(`[assets] missing ${src} — run npm install`);
    process.exit(1);
  }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
}
console.log(`[assets] tesseract assets ready in ${out}`);
