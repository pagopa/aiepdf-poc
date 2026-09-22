/**
 * HTTP surface for `UC-01`: upload a signed agreement and read the practice
 * status.
 *
 * The routes are thin: they translate HTTP into a domain call and let the
 * shared error handler project the typed errors. All validation and ordering
 * lives in the `uploadSignedAgreement` use case.
 */

import {
  AgreementError,
  sha256Hex as digestSha256,
  uploadSignedAgreement,
  type AgreementPolicy,
} from '@aiepdf/adhesion-domain';
import type { FastifyInstance } from 'fastify';

import type { AppDependencies } from '../../app/dependencies.js';

const multipartFileTooLargeCodes = new Set([
  'FST_REQ_FILE_TOO_LARGE',
  'FST_FILES_LIMIT',
]);

function isMultipartLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return multipartFileTooLargeCodes.has(String(error.code));
}

export function registerPracticeRoutes(
  app: FastifyInstance,
  dependencies: AppDependencies,
): void {
  const policy: AgreementPolicy = {
    allowedExtensions: ['.p7m'],
    maxSizeBytes: dependencies.settings.maxUploadMb * 1024 * 1024,
    contentType: 'application/pkcs7-mime',
  };

  app.get('/config', async () => ({
    uploadEnabled: await dependencies.featureFlags.isUploadEnabled(),
    maxUploadMb: dependencies.settings.maxUploadMb,
  }));

  app.post(
    '/practices/:onboardingId/agreements',
    async (request, reply) => {
      if (!(await dependencies.featureFlags.isUploadEnabled())) {
        throw new AgreementError(
          'UPLOAD_DISABLED',
          'Uploads are temporarily disabled.',
        );
      }

      const { onboardingId } = request.params as { onboardingId: string };

      let filename: string;
      let content: Uint8Array;
      try {
        const part = await request.file();
        if (!part) {
          throw new AgreementError(
            'AGREEMENT_EXTENSION_INVALID',
            'A file part is required.',
          );
        }
        filename = part.filename;
        content = await part.toBuffer();
      } catch (error) {
        if (isMultipartLimitError(error)) {
          throw new AgreementError(
            'AGREEMENT_FILE_TOO_LARGE',
            'The uploaded file exceeds the allowed size.',
          );
        }
        throw error;
      }

      const result = await uploadSignedAgreement(
        {
          practices: dependencies.practices,
          storage: dependencies.storage,
          verifier: dependencies.verifier,
          policy,
          digestSha256,
          newDocumentId: dependencies.newDocumentId,
          now: dependencies.now,
        },
        { onboardingId, filename, content },
      );

      reply.code(201);
      return {
        documentId: result.documentId,
        status: result.status,
        signingStep: result.signingStep,
      };
    },
  );

  app.get('/practices/:onboardingId', async (request) => {
    const { onboardingId } = request.params as { onboardingId: string };
    const practice = await dependencies.practices.findPractice(onboardingId);
    if (!practice) {
      throw new AgreementError(
        'PRACTICE_NOT_FOUND',
        'The practice does not exist.',
      );
    }
    return { onboardingId: practice.onboardingId, status: practice.status };
  });
}
