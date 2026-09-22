/**
 * Type of the values shared by the integration global setup with the suites
 * through Vitest `provide` / `inject`.
 */
declare module 'vitest' {
  interface ProvidedContext {
    postgresUri: string;
    azuriteConnectionString: string;
  }
}

export {};
