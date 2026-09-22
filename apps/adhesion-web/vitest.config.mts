import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/adhesion-web',
  plugins: [react()],
  resolve: {
    alias: {
      '@': join(import.meta.dirname, './src'),
    },
  },
  test: {
    name: 'adhesion-web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // `@pagopa/mui-italia` is ESM-only and uses directory imports that Node's
    // resolver rejects in tests; inline it so Vite transforms and resolves it.
    server: {
      deps: {
        inline: [/@pagopa\/mui-italia/],
      },
    },
    include: ['{src,app,pages,specs}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    }
  },
}));
