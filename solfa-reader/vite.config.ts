import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' = relative asset URLs, so the built site works from any sub-path
// (GitHub Pages project site, Netlify, a USB stick...). Routing is hash-based.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    passWithNoTests: true,
  },
});
