import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
  build: {
    rollupOptions: {
      external: ['electron', 'node:sqlite', 'node:fs', 'node:path', 'node:http', 'node:crypto', 'node:os'],
      output: {
        entryFileNames: 'main.js',
      },
    },
  },
});

