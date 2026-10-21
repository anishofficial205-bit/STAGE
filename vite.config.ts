import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // three.js is large by nature; split it out so the app code stays small.
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
