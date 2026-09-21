import { defineConfig } from 'vitest/config';

/**
 * Live integration suite.
 *
 * Requires Docker: it starts one PostgreSQL and one Azurite container for the
 * whole run (global setup) and drives the real Fastify runtime with the real
 * adapters. It is opt-in (`nx run adhesion-api:test:integration`) and excluded
 * from the default unit config.
 */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/adhesion-api-integration',
  test: {
    name: 'adhesion-api-integration',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/__integrations__/**/*.integration.spec.ts'],
    globalSetup: ['src/__integrations__/global-setup.ts'],
    // Shared containers are started once; files run sequentially to avoid
    // cross-file state interference.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    reporters: ['default'],
  },
}));
