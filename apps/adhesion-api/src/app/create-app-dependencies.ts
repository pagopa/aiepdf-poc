/**
 * Composition root for the API dependencies.
 *
 * Kept separate from `main.ts` so integration tests can build the exact same
 * dependency graph the server uses (adapters, migrations, readiness) instead of
 * a test-only wiring that could drift from production.
 */

import { randomUUID } from 'node:crypto';

import type { AgreementBlobWriter } from '@aiepdf/adhesion-domain';
import { createCadesVerifier } from '@aiepdf/adhesion-verification';

import { createAzureBlobAgreementStorage } from '../adapters/azure-blob-agreement-storage.js';
import { createInMemoryAgreementStorage } from '../adapters/in-memory-agreement-storage.js';
import { createInMemoryPracticeRepository } from '../adapters/in-memory-practice-repository.js';
import { runMigrations } from '../adapters/postgres-migrations.js';
import { createPostgresPool } from '../adapters/postgres-pool.js';
import { createPostgresPracticeRepository } from '../adapters/postgres-practice-repository.js';
import {
  createReadinessProbe,
  type NamedReadinessCheck,
  type ReadinessProbe,
} from '../health/readiness.js';
import type { FeatureFlags } from '../config/feature-flags.js';
import type { Settings } from '../config/settings.js';
import type { AppDependencies } from './dependencies.js';

async function createPracticeRepository(
  settings: Settings,
): Promise<AppDependencies['practices']> {
  if (settings.persistence !== 'postgres') {
    return createInMemoryPracticeRepository();
  }
  if (!settings.databaseUrl) {
    throw new Error(
      'PERSISTENCE=postgres requires DATABASE_URL or POSTGRES_* settings.',
    );
  }
  const pool = createPostgresPool({
    connectionString: settings.databaseUrl,
    ssl: settings.postgresSsl,
  });
  // Startup migrations (`contracts.item-002`) are idempotent and
  // advisory-locked, so they are safe on every replica boot.
  await runMigrations(pool);
  return createPostgresPracticeRepository(pool);
}

function createStorageAdapter(settings: Settings): AgreementBlobWriter {
  if (settings.storage !== 'azure') {
    return createInMemoryAgreementStorage();
  }
  if (!settings.storageBlobEndpoint && !settings.storageConnectionString) {
    throw new Error(
      'STORAGE=azure requires AZURE_STORAGE_BLOB_ENDPOINT or AZURE_STORAGE_CONNECTION_STRING to be configured.',
    );
  }
  return createAzureBlobAgreementStorage({
    blobEndpoint: settings.storageBlobEndpoint,
    connectionString: settings.storageConnectionString,
    containerName: settings.storageContainer,
    createContainerIfMissing: settings.storageCreateContainer,
  });
}

function createDependencyReadinessProbe(input: {
  practices: AppDependencies['practices'];
  storage: AppDependencies['storage'];
}): ReadinessProbe {
  const checks: NamedReadinessCheck[] = [];
  const { practices, storage } = input;

  const practiceCheck = practices.check;
  if (practiceCheck) {
    checks.push({
      name: 'practice-registry',
      check: () => practiceCheck.call(practices),
    });
  }

  const storageCheck = storage.check;
  if (storageCheck) {
    checks.push({
      name: 'agreement-storage',
      check: () => storageCheck.call(storage),
    });
  }

  return createReadinessProbe(checks);
}

export async function createAppDependencies(configuration: {
  settings: Settings;
  featureFlags: FeatureFlags;
}): Promise<AppDependencies> {
  const { settings, featureFlags } = configuration;

  const practices = await createPracticeRepository(settings);
  const storage = createStorageAdapter(settings);
  // Local environments (Azurite) can create the container on startup; in Azure
  // the container is provisioned by Terraform.
  await storage.initialize?.();

  return {
    settings,
    featureFlags,
    practices,
    storage,
    verifier: createCadesVerifier(),
    readiness: createDependencyReadinessProbe({ practices, storage }),
    newDocumentId: () => randomUUID(),
    now: () => new Date(),
  };
}
