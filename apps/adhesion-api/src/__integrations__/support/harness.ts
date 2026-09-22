import { BlobServiceClient } from '@azure/storage-blob';
import type { FastifyInstance } from 'fastify';
import { inject } from 'vitest';

import { createPostgresPool } from '../../adapters/postgres-pool.js';
import { buildApp } from '../../app/app.js';
import { createAppDependencies } from '../../app/create-app-dependencies.js';
import { createStaticFeatureFlags } from '../../config/feature-flags.js';
import { loadSettingsFromEnvironment } from '../../config/settings.js';

/**
 * Shared helpers for the integration suites.
 *
 * The app is built through `createAppDependencies`, the same composition root
 * the server uses, so a wiring regression (adapter selection, CORS, readiness)
 * fails here too. Postgres and Azurite come from the global setup containers.
 */

export const UI_ORIGIN = 'http://localhost:8080';
export const AGREEMENTS_CONTAINER = 'agreements';

export function integrationEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    HOST: '127.0.0.1',
    PORT: '3000',
    PERSISTENCE: 'postgres',
    DATABASE_URL: inject('postgresUri'),
    POSTGRES_SSL: 'false',
    STORAGE: 'azure',
    AZURE_STORAGE_CONNECTION_STRING: inject('azuriteConnectionString'),
    AZURE_STORAGE_CONTAINER: AGREEMENTS_CONTAINER,
    AZURE_STORAGE_CREATE_CONTAINER: 'true',
    CORS_ALLOWED_ORIGINS: UI_ORIGIN,
    MAX_UPLOAD_MB: '10',
    ...overrides,
  };
}

export async function buildIntegrationApp(
  overrides: Record<string, string | undefined> = {},
): Promise<FastifyInstance> {
  const settings = loadSettingsFromEnvironment(integrationEnvironment(overrides));
  const dependencies = await createAppDependencies({
    settings,
    featureFlags: createStaticFeatureFlags({ uploadEnabled: true }),
  });
  return buildApp(dependencies, { logger: false });
}

export async function withDatabase<T>(
  operation: (pool: ReturnType<typeof createPostgresPool>) => Promise<T>,
): Promise<T> {
  const pool = createPostgresPool({
    connectionString: inject('postgresUri'),
    ssl: false,
  });
  try {
    return await operation(pool);
  } finally {
    await pool.end();
  }
}

function agreementsContainer() {
  const service = BlobServiceClient.fromConnectionString(
    inject('azuriteConnectionString'),
  );
  return service.getContainerClient(AGREEMENTS_CONTAINER);
}

/** Deletes every row and blob so each test starts from a clean state. */
export async function resetState(): Promise<void> {
  await withDatabase(async (pool) => {
    await pool.query('delete from documents;');
    await pool.query('delete from practices;');
  });

  const container = agreementsContainer();
  if (await container.exists()) {
    for await (const blob of container.listBlobsFlat()) {
      await container.getBlockBlobClient(blob.name).deleteIfExists();
    }
  }
}

export async function seedPractice(
  onboardingId: string,
  status: 'REQUEST' | 'PENDING' = 'REQUEST',
): Promise<void> {
  await withDatabase(async (pool) => {
    await pool.query(
      'insert into practices (onboarding_id, status) values ($1, $2)',
      [onboardingId, status],
    );
  });
}

export async function practiceStatus(
  onboardingId: string,
): Promise<string | undefined> {
  return withDatabase(async (pool) => {
    const result = await pool.query<{ status: string }>(
      'select status from practices where onboarding_id = $1',
      [onboardingId],
    );
    return result.rows[0]?.status;
  });
}

export async function documentCount(onboardingId: string): Promise<number> {
  return withDatabase(async (pool) => {
    const result = await pool.query<{ count: number }>(
      'select count(*)::int as count from documents where onboarding_id = $1',
      [onboardingId],
    );
    return result.rows[0]?.count ?? 0;
  });
}

export async function listAgreementBlobs(): Promise<string[]> {
  const names: string[] = [];
  const container = agreementsContainer();
  if (!(await container.exists())) {
    return names;
  }
  for await (const blob of container.listBlobsFlat()) {
    names.push(blob.name);
  }
  return names;
}

export async function readAgreementBlob(name: string): Promise<Buffer> {
  return agreementsContainer().getBlockBlobClient(name).downloadToBuffer();
}

export interface MultipartUploadRequest {
  method: 'POST';
  url: string;
  payload: Buffer;
  headers: Record<string, string>;
}

/** Builds a multipart upload request that preserves binary file content. */
export function multipartUpload(input: {
  url: string;
  filename: string;
  content: Buffer;
  origin?: string;
}): MultipartUploadRequest {
  const boundary = '----adhesionIntegrationBoundary';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${input.filename}"\r\n` +
      'Content-Type: application/pkcs7-mime\r\n\r\n',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    method: 'POST',
    url: input.url,
    payload: Buffer.concat([head, input.content, tail]),
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      ...(input.origin ? { origin: input.origin } : {}),
    },
  };
}
