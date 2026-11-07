// Vite config for the OCR benchmark only: serves the project root (src/, public/tesseract/)
// without HMR, so edits by other agents during a run do not reload the bench page.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export default {
  root,
  configFile: false,
  server: { hmr: false, watch: { ignored: ['**/*'] } },
  logLevel: 'warn',
};
