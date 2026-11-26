import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

// The app's HTML entry lives in app/ because hivemind/index.html must stay a redirect:
// GitHub Pages serves this repo's root, and would otherwise expose the raw Vite entry.
export default defineConfig({
  root: 'app',
  envDir: here,
  plugins: [react()],
  css: { postcss: here },
  server: { fs: { allow: [here] } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
