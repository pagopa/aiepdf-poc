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
}

export async function connectAppConfiguration(input: {
  endpoint: string;
  credential?: TokenCredential;
}): Promise<AppConfigurationClient> {
  const credential = input.credential ?? new DefaultAzureCredential();

  const appConfig = await load(input.endpoint, credential, {
    refreshOptions: {
      enabled: true,
      watchedSettings: [{ key: 'Sentinel' }],
      refreshIntervalInMs: 300_000,
    },
  });

  const featureManager = new FeatureManager(
    new ConfigurationMapFeatureFlagProvider(appConfig),
  );

  return {
    readSetting: (key) => {
      const value = appConfig.get<string>(key);
      return Promise.resolve(typeof value === 'string' ? value : undefined);
    },
    isFeatureEnabled: (flagName) => featureManager.isEnabled(flagName),
  };
}
