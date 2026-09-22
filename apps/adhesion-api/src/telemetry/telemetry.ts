/**
 * Azure Monitor / Application Insights bootstrap (NFR-07).
 *
 * `@pagopa/azure-tracing` is the DX package that configures OpenTelemetry for
 * Azure Monitor. Initialisation is opt-in so local runs and tests never try to
 * reach Azure.
 */

import { initAzureMonitor } from '@pagopa/azure-tracing/azure-monitor';

/**
 * Resolves the connection string the Azure Monitor exporter expects.
 *
 * The core infrastructure exposes the Application Insights instrumentation key
 * as a Key Vault secret, while the exporter prefers a connection string. A
 * connection string containing only `InstrumentationKey` is valid and makes the
 * exporter use the default ingestion endpoint.
 */
function resolveConnectionString(input: {
  connectionString: string | undefined;
  instrumentationKey: string | undefined;
}): string | undefined {
  if (input.connectionString) {
    return input.connectionString;
  }
  if (input.instrumentationKey) {
    return `InstrumentationKey=${input.instrumentationKey}`;
  }
  return undefined;
}

export function initTelemetry(input: {
  readonly connectionString: string | undefined;
  readonly instrumentationKey: string | undefined;
}): void {
  const connectionString = resolveConnectionString(input);
  if (!connectionString) {
    return;
  }

  initAzureMonitor([], {
    azureMonitorExporterOptions: { connectionString },
  });
}
