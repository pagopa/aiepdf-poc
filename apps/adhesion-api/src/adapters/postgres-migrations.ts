/**
 * Idempotent, startup-run schema migrations for `contracts.item-002`
 * (Practice and Document persistence).
 *
 * Migrations run inside a transaction and take a session-level advisory lock,
 * so two Container App replicas starting at the same time cannot apply the same
 * migration twice. Each migration is recorded in `schema_migrations`. The
 * runner is safe to call on every boot.
 */

import type { Pool } from 'pg';

interface Migration {
  readonly id: string;
  readonly sql: string;
}

const migrations: readonly Migration[] = [
  {
    id: '0001-practices-and-documents',
    sql: `
      create table if not exists practices (
        onboarding_id text primary key,
        status text not null check (status in ('REQUEST', 'PENDING')),
        created_at timestamptz not null default now()
      );

      create table if not exists documents (
        document_id text primary key,
        onboarding_id text not null
          references practices (onboarding_id) on delete cascade,
        signing_step integer not null check (signing_step > 0),
        signature_format text not null,
        digest_sha256 text not null,
        storage_reference text not null,
        created_at timestamptz not null default now(),
        constraint documents_unique_signing_step
          unique (onboarding_id, signing_step)
      );

      create index if not exists documents_onboarding_idx
        on documents (onboarding_id);
    `,
  },
];

/**
 * Fixed, project-specific advisory lock key. Keeping it constant means every
 * instance of this application competes for the same lock during migration.
 */
const migrationLockKey = 515_274_001;

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock($1)', [migrationLockKey]);

    await client.query(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    for (const migration of migrations) {
      const applied = await client.query(
        'select 1 from schema_migrations where id = $1',
        [migration.id],
      );
      if (applied.rowCount && applied.rowCount > 0) {
        continue;
      }
      await client.query(migration.sql);
      await client.query('insert into schema_migrations (id) values ($1)', [
        migration.id,
      ]);
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw new Error('Database migration failed', { cause: error });
  } finally {
    client.release();
  }
}
