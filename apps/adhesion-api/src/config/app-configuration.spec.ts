import { afterEach, describe, expect, it, vi } from 'vitest';

const provider = vi.hoisted(() => ({
  get: vi.fn(),
  refresh: vi.fn(() => Promise.resolve()),
}));

vi.mock('@azure/app-configuration-provider', () => ({
  load: vi.fn(() =>
    Promise.resolve({
      get: provider.get,
      refresh: provider.refresh,
      onRefresh: vi.fn(),
    }),
  ),
}));

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
}));

vi.mock('@microsoft/feature-management', () => ({
  ConfigurationMapFeatureFlagProvider: class {},
  FeatureManager: class {
    isEnabled() {
      return Promise.resolve(true);
    }
  },
}));

import { connectAppConfiguration } from './app-configuration.js';

describe('connectAppConfiguration', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reloads watched settings and feature flags on an interval', async () => {
    vi.useFakeTimers();

    const client = await connectAppConfiguration({
      endpoint: 'https://example.azconfig.io',
    });

    // The SDK never polls by itself, so nothing happens until the timer fires.
    expect(provider.refresh).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(provider.refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(provider.refresh).toHaveBeenCalledTimes(2);

    // Disposing stops the background refresh.
    client.dispose();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(provider.refresh).toHaveBeenCalledTimes(2);
  });

  it('reads settings and delegates feature flags to the feature manager', async () => {
    provider.get.mockReturnValue('10');

    const client = await connectAppConfiguration({
      endpoint: 'https://example.azconfig.io',
    });

    await expect(
      client.readSetting('adhesion:upload:maxSizeMb'),
    ).resolves.toBe('10');
    await expect(
      client.isFeatureEnabled('adhesion.upload.enabled'),
    ).resolves.toBe(true);

    client.dispose();
  });
});
