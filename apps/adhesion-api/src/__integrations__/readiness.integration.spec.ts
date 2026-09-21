import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runMigrations } from '../adapters/postgres-migrations.js';
import { buildIntegrationApp, withDatabase } from './support/harness.js';

/**
 * Readiness and migration behaviour against the real dependencies.
 */
describe('readiness and migrations (integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildIntegrationApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports liveness', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports readiness with both dependencies reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      checks: { 'practice-registry': 'ok', 'agreement-storage': 'ok' },
    });
  });

  it('applies migrations idempotently', async () => {
    await withDatabase(async (pool) => {
      await runMigrations(pool);
      await runMigrations(pool);

      const migrations = await pool.query<{ count: number }>(
        'select count(*)::int as count from schema_migrations',
      );
      expect(migrations.rows[0]?.count).toBe(1);

      const tables = await pool.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public'",
      );
      const names = tables.rows.map((row) => row.table_name);
      expect(names).toEqual(
        expect.arrayContaining(['practices', 'documents', 'schema_migrations']),
      );
    });
  });
});
