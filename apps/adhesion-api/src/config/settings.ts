/**
 * Runtime settings for the adhesion API.
 *
 * Values come from the process environment and are validated with zod; when
 * `APP_CONFIG_ENDPOINT` is set they are overlaid with the values stored in
 * Azure App Configuration (the pilot's single place for settings and feature
 * flags). No secret literal is read here: the database password and the
 * Application Insights key arrive from Key Vault through Container App secret
 * references, and are only composed into connection strings in memory.
 */

import { z } from 'zod';

export type PersistenceKind = 'memory' | 'postgres';
export type StorageKind = 'memory' | 'azure';

export interface Settings {
  readonly host: string;
  readonly port: number;
  readonly maxUploadMb: number;
  readonly persistence: PersistenceKind;
  readonly databaseUrl: string | undefined;
  readonly postgresSsl: boolean;
  readonly storage: StorageKind;
  readonly storageBlobEndpoint: string | undefined;
  readonly storageConnectionString: string | undefined;
  readonly storageContainer: string;
  readonly storageCreateContainer: boolean;
  readonly appConfigEndpoint: string | undefined;
  readonly appInsightsConnectionString: string | undefined;
  readonly appInsightsInstrumentationKey: string | undefined;
  readonly corsAllowedOrigins: readonly string[];
}

const environmentSchema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Pilot limit decided on 2026-09-21 (open.item-010); override via App Configuration.
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  PERSISTENCE: z.enum(['memory', 'postgres']).default('memory'),
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_HOST: z.string().min(1).optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_ADMIN_PASSWORD: z.string().min(1).optional(),
  POSTGRES_DB: z.string().min(1).default('adhesion'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  // Azure Database for PostgreSQL requires TLS; local containers do not.
  POSTGRES_SSL: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  STORAGE: z.enum(['memory', 'azure']).default('memory'),
  AZURE_STORAGE_BLOB_ENDPOINT: z.string().url().optional(),
  AZURE_STORAGE_CONNECTION_STRING: z.string().min(1).optional(),
  AZURE_STORAGE_CONTAINER: z.string().min(1).default('agreements'),
  AZURE_STORAGE_CREATE_CONTAINER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  APP_CONFIG_ENDPOINT: z.string().url().optional(),
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().min(1).optional(),
  APPLICATIONINSIGHTS_INSTRUMENTATION_KEY: z.string().min(1).optional(),
  // Comma-separated list of browser origins allowed to call the API. The UI is
  // served from a different origin (Static Web App / nginx), so this is required
  // in every deployed environment.
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

/**
 * Builds the PostgreSQL connection string from the Container App settings.
 *
 * The password is injected from Key Vault and is URL-encoded here; it is never
 * logged. TLS is required by the Flexible Server.
 */
function composeDatabaseUrl(input: {
  explicit: string | undefined;
  host: string | undefined;
  user: string | undefined;
  password: string | undefined;
  database: string;
  port: number;
  ssl: boolean;
}): string | undefined {
  if (input.explicit) {
    return input.explicit;
  }
  if (!input.host || !input.user || !input.password) {
    return undefined;
  }
  const credentials = `${encodeURIComponent(input.user)}:${encodeURIComponent(input.password)}`;
  const sslMode = input.ssl ? 'require' : 'disable';
  return `postgres://${credentials}@${input.host}:${input.port}/${input.database}?sslmode=${sslMode}`;
}

export function loadSettingsFromEnvironment(
  environment: Record<string, string | undefined>,
): Settings {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.message}`,
    );
  }
  const env = parsed.data;
  return {
    host: env.HOST,
    port: env.PORT,
    maxUploadMb: env.MAX_UPLOAD_MB,
    persistence: env.PERSISTENCE,
    databaseUrl: composeDatabaseUrl({
      explicit: env.DATABASE_URL,
      host: env.POSTGRES_HOST,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_ADMIN_PASSWORD,
      database: env.POSTGRES_DB,
      port: env.POSTGRES_PORT,
      ssl: env.POSTGRES_SSL,
    }),
    postgresSsl: env.POSTGRES_SSL,
    storage: env.STORAGE,
    storageBlobEndpoint: env.AZURE_STORAGE_BLOB_ENDPOINT,
    storageConnectionString: env.AZURE_STORAGE_CONNECTION_STRING,
    storageContainer: env.AZURE_STORAGE_CONTAINER,
    storageCreateContainer: env.AZURE_STORAGE_CREATE_CONTAINER,
    appConfigEndpoint: env.APP_CONFIG_ENDPOINT,
    appInsightsConnectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    appInsightsInstrumentationKey:
      env.APPLICATIONINSIGHTS_INSTRUMENTATION_KEY,
    corsAllowedOrigins: parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
  };
}

function parseAllowedOrigins(value: string | undefined): readonly string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * Overlays the environment settings with the App Configuration values.
 *
 * Only non-secret pilot settings are read. A failure to reach App
 * Configuration is not fatal for the pilot: the validated environment values
 * remain in effect.
 */
export async function overlayAppConfiguration(input: {
  settings: Settings;
  read: (key: string) => Promise<string | undefined>;
}): Promise<Partial<Settings>> {
  const maxUploadMb = await input.read('adhesion:upload:maxSizeMb');
  const storageContainer = await input.read('adhesion:storage:container');

  const parsedMaxUploadMb = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(maxUploadMb);
  return {
    ...(parsedMaxUploadMb.success
      ? { maxUploadMb: parsedMaxUploadMb.data }
      : {}),
    ...(storageContainer ? { storageContainer } : {}),
  };
}
