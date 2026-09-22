/**
 * In-memory adapter for the agreement blob storage port.
 *
 * Local/demo replacement for the Azure Storage adapter. It keeps blobs in a Map
 * so the upload flow can be exercised end-to-end without Azure credentials.
 */

import type { AgreementBlobWriter } from '@aiepdf/adhesion-domain';

export function createInMemoryAgreementStorage(): AgreementBlobWriter {
  const blobs = new Map<string, Uint8Array>();

  return {
    write: (input) => {
      blobs.set(input.reference, input.content);
      return Promise.resolve();
    },
    remove: (reference) => {
      blobs.delete(reference);
      return Promise.resolve();
    },
    check: () => Promise.resolve(),
  };
}
