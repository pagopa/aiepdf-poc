/**
 * PostgreSQL connection pool factory.
 *
 * The pool is created once at startup and shared by the migration runner and
 * the repository adapter, so migrations and queries use the same connections.
 * The connection string carries the Key Vault-provided password and is never
 * logged. TLS is on by default (Azure requires it) and can be disabled for the
 * local containerized environment.
 */

import { Pool } from 'pg';

export function createPostgresPool(input: {
  connectionString: string;
  ssl: boolean;
}): Pool {
  return new Pool({
    connectionString: input.connectionString,
    ...(input.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}
