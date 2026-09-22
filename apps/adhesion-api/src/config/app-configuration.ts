/**
 * Azure App Configuration client for settings and feature flags.
 *
 * The pilot keeps non-secret settings (`adhesion:*`) and feature flags
 * (`adhesion.*`) in one App Configuration instance, read with the Container App
 * Managed Identity. Secrets are never stored here: Key Vault references are
 * resolved by the provider instead.
 */

import { load } from '@azure/app-configuration-provider';
import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';
import {
  ConfigurationMapFeatureFlagProvider,
  FeatureManager,
} from '@microsoft/feature-management';

export interface AppConfigurationClient {
  readSetting(key: string): Promise<string | undefined>;
  isFeatureEnabled(flagName: string): Promise<boolean>;
  /** Stops the background refresh. Useful in tests; in the server it runs for the process lifetime. */
  dispose(): void;
}

/**
 * How often the provider is asked to reload watched settings (`Sentinel`) and
 * feature flags. The SDK does not poll on its own: it only checks the server
 * when `refresh()` is called, and rate-limits those calls to this interval.
 */
const refreshIntervalMs = 30_000;

export async function connectAppConfiguration(input: {
  endpoint: string;
  credential?: TokenCredential;
}): Promise<AppConfigurationClient> {
  const credential = input.credential ?? new DefaultAzureCredential();

  const appConfig = await load(input.endpoint, credential, {
    refreshOptions: {
      enabled: true,
      watchedSettings: [{ key: 'Sentinel' }],
      refreshIntervalInMs: refreshIntervalMs,
    },
    // Feature flags are not loaded unless explicitly enabled. Without this the
    // feature manager resolves every flag to its default (`false`), so the
    // upload kill switch reads as disabled in a healthy deployment.
    featureFlagOptions: {
      enabled: true,
      refresh: {
        enabled: true,
        refreshIntervalInMs: refreshIntervalMs,
      },
    },
  });

  // The provider reloads nothing by itself: without this timer the `Sentinel`
  // setting and the feature flags keep their startup values forever. Failures
  // are logged and never crash the API, which keeps serving the last good
  // configuration.
  const refreshTimer = setInterval(() => {
    void appConfig.refresh().catch((error: unknown) => {
      console.warn('App Configuration refresh failed', error);
    });
  }, refreshIntervalMs);
  refreshTimer.unref?.();

  const featureManager = new FeatureManager(
    new ConfigurationMapFeatureFlagProvider(appConfig),
  );

  return {
    readSetting: (key) => {
      const value = appConfig.get<string>(key);
      return Promise.resolve(typeof value === 'string' ? value : undefined);
    },
    isFeatureEnabled: (flagName) => featureManager.isEnabled(flagName),
    dispose: () => clearInterval(refreshTimer),
  };
}
