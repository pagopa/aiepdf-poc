/**
 * Feature flags for the adhesion pilot.
 *
 * The port exists so the HTTP layer never talks to Azure directly. In Azure the
 * flags are read from App Configuration through the feature management SDK; in
 * local runs and tests they are static values.
 */

export interface FeatureFlags {
  /** Master switch for accepting new uploads. */
  isUploadEnabled(): Promise<boolean>;
}

export function createStaticFeatureFlags(input: {
  uploadEnabled: boolean;
}): FeatureFlags {
  return {
    isUploadEnabled: () => Promise.resolve(input.uploadEnabled),
  };
}

export type FeatureFlagReader = (flagName: string) => Promise<boolean>;

/**
 * Adapter over the App Configuration feature manager. Hot reload and targeting
 * rules are delegated to the SDK; this wrapper only maps the flag names used by
 * the pilot.
 */
export function createFeatureFlagsFromReader(
  read: FeatureFlagReader,
): FeatureFlags {
  return {
    isUploadEnabled: () => read('adhesion.upload.enabled'),
  };
}
