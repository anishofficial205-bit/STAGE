import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** In dev, / shows the landing page (public/index.html) the way the built site does. */
const landingInDev = (): Plugin => ({
  name: 'landing-in-dev',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/' && !req.url?.startsWith('/?')) return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(readFileSync(resolve(import.meta.dirname, 'public/index.html')));
    });
  },
});

export default defineConfig({
  plugins: [react(), landingInDev()],
  // three.js is large by nature; split it out so the app code stays small.
  build: {
    chunkSizeWarningLimit: 1200,
    // The app lives at /app/; the landing page (public/index.html, from landing/) is the front door.
    rollupOptions: { input: { app: resolve(import.meta.dirname, 'app/index.html') }, output: { manualChunks: { three: ['three'] } } },
  },
});
