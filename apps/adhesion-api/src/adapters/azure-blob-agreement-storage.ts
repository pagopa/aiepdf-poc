/**
 * Azure Blob Storage adapter for the confidential agreement blobs (UC-01 flow
 * 4, NFR-04).
 *
 * In Azure, authentication uses the Container App Managed Identity and the
 * container is created by Terraform. Locally (docker compose + Azurite) a
 * connection string is used instead and the container can be created on
 * startup. Secrets are never logged.
 */

import type { AgreementBlobWriter } from '@aiepdf/adhesion-domain';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';

export interface AzureBlobAgreementStorageOptions {
  readonly containerName: string;
  /** Managed Identity against the real Storage Account. */
  readonly blobEndpoint?: string;
  /** Connection string, used for Azurite in local environments. */
  readonly connectionString?: string;
  /** Create the container on startup when missing (local/Azurite only). */
  readonly createContainerIfMissing?: boolean;
}

export function createAzureBlobAgreementStorage(
  options: AzureBlobAgreementStorageOptions,
): AgreementBlobWriter {
  const service = options.connectionString
    ? BlobServiceClient.fromConnectionString(options.connectionString)
    : new BlobServiceClient(
        options.blobEndpoint ?? '',
        new DefaultAzureCredential(),
      );
  const container = service.getContainerClient(options.containerName);

  return {
    async initialize() {
      if (options.createContainerIfMissing) {
        await container.createIfNotExists();
      }
    },
    async check() {
      await container.getProperties();
    },
    async write({ reference, content, contentType }) {
      const blockBlob = container.getBlockBlobClient(reference);
      await blockBlob.uploadData(content, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
    },
    async remove(reference) {
      await container.getBlockBlobClient(reference).deleteIfExists();
    },
  };
}
