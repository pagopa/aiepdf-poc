import { AzuriteContainer } from '@testcontainers/azurite';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

import { ensureDockerHost } from './support/docker-host.js';

/**
 * Starts the shared integration topology once per run:
 * - PostgreSQL 17 (practice registry)
 * - Azurite (agreement blob storage)
 *
 * Connection details are provided to the suites with Vitest `provide`/`inject`.
 * Containers are stopped by the returned teardown.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  ensureDockerHost();

  const postgres = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('adhesion')
    .withUsername('adhesion')
    .withPassword('adhesion')
    .start();

  const azurite = await new AzuriteContainer(
    'mcr.microsoft.com/azure-storage/azurite:latest',
  )
    .withInMemoryPersistence()
    .start();

  project.provide('postgresUri', postgres.getConnectionUri());
  project.provide('azuriteConnectionString', azurite.getConnectionString());

  console.info('[integration] PostgreSQL and Azurite are ready');

  return async () => {
    await azurite.stop();
    await postgres.stop();
  };
}
