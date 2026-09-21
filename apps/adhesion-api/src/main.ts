/**
 * Entry point of the adhesion API.
 *
 * Reads configuration from the environment, overlays Azure App Configuration
 * when available, builds the dependency graph, initialises telemetry, and
 * starts Fastify. This is the only module allowed to touch `process.env`.
 */

import { connectAppConfiguration } from './config/app-configuration.js';
import {
  createFeatureFlagsFromReader,
  createStaticFeatureFlags,
  type FeatureFlags,
} from './config/feature-flags.js';
import {
  loadSettingsFromEnvironment,
  overlayAppConfiguration,
  type Settings,
} from './config/settings.js';
import { createAppDependencies } from './app/create-app-dependencies.js';
import { buildApp } from './app/app.js';
import { initTelemetry } from './telemetry/telemetry.js';

async function resolveConfiguration(
  environment: Record<string, string | undefined>,
): Promise<{ settings: Settings; featureFlags: FeatureFlags }> {
  const settings = loadSettingsFromEnvironment(environment);
  if (!settings.appConfigEndpoint) {
    return {
      settings,
      featureFlags: createStaticFeatureFlags({ uploadEnabled: true }),
    };
  }

  try {
    const appConfig = await connectAppConfiguration({
      endpoint: settings.appConfigEndpoint,
    });
    const overlay = await overlayAppConfiguration({
      settings,
      read: (key) => appConfig.readSetting(key),
    });
    return {
      settings: { ...settings, ...overlay },
      featureFlags: createFeatureFlagsFromReader((flagName) =>
        appConfig.isFeatureEnabled(flagName),
      ),
    };
  } catch (error) {
    // App Configuration is an enhancement for the pilot: if it is unreachable
    // the validated environment values still start the API, but the failure is
    // surfaced with its cause.
    console.warn(
      'App Configuration unavailable; using environment settings',
      error,
    );
    return {
      settings,
      featureFlags: createStaticFeatureFlags({ uploadEnabled: true }),
    };
  }
}

async function main(): Promise<void> {
  const configuration = await resolveConfiguration(process.env);
  initTelemetry({
    connectionString: configuration.settings.appInsightsConnectionString,
    instrumentationKey:
      configuration.settings.appInsightsInstrumentationKey,
  });

  const dependencies = await createAppDependencies(configuration);
  const app = buildApp(dependencies, { logger: true });

  // Container Apps sends SIGTERM on revision shutdown; drain gracefully so
  // in-flight uploads are not cut off.
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', (signal) => void shutdown(signal));
  process.on('SIGINT', (signal) => void shutdown(signal));

  await app.listen({
    host: configuration.settings.host,
    port: configuration.settings.port,
  });
}

main().catch((error: unknown) => {
  console.error('Failed to start the adhesion API', error);
  process.exit(1);
});
