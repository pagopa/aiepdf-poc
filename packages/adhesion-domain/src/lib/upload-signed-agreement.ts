/**
 * `UC-01` upload of a signed agreement (step 1).
 *
 * Orchestrates the synchronous validation described in the Use Case main flow:
 * practice state, size, extension and CAdES signature, then the confidential
 * blob and the atomic `REQUEST -> PENDING` transition.
 *
 * Failure ordering is deliberate: cheap, non-revealing checks run before the
 * signature check, and no blob is written for any rejected upload.
 */

import { AgreementError } from './errors.js';
import { agreementSigningStep } from './practice.js';
import type {
  AgreementBlobWriter,
  AgreementPolicy,
  PracticeRepository,
  SignatureVerifier,
  UploadedAgreement,
} from './ports.js';

export interface UploadSignedAgreementDependencies {
  readonly practices: PracticeRepository;
  readonly storage: AgreementBlobWriter;
  readonly verifier: SignatureVerifier;
  readonly policy: AgreementPolicy;
  readonly digestSha256: (content: Uint8Array) => string;
  readonly newDocumentId: () => string;
  readonly now: () => Date;
}

export interface UploadSignedAgreementInput {
  readonly onboardingId: string;
  readonly filename: string;
  readonly content: Uint8Array;
}

export interface UploadSignedAgreementOutput {
  readonly documentId: string;
  readonly status: 'PENDING';
  readonly signingStep: number;
}

function extensionOf(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.slice(lastDot).toLowerCase();
}

export async function uploadSignedAgreement(
  dependencies: UploadSignedAgreementDependencies,
  input: UploadSignedAgreementInput,
): Promise<UploadSignedAgreementOutput> {
  const { practices, storage, verifier, policy } = dependencies;

  const practice = await practices.findPractice(input.onboardingId);
  if (!practice) {
    // `PRACTICE_NOT_FOUND` is not defined by UC-01 (precondition: the practice
    // exists); it is the only honest answer the pilot API can give and is
    // tracked as a contract gap.
    throw new AgreementError(
      'PRACTICE_NOT_FOUND',
      'The practice does not exist.',
    );
  }

  if (practice.status !== 'REQUEST') {
    throw new AgreementError(
      'PRACTICE_STATE_INVALID',
      'The practice is not in the REQUEST state.',
    );
  }

  if (input.content.byteLength > policy.maxSizeBytes) {
    throw new AgreementError(
      'AGREEMENT_FILE_TOO_LARGE',
      'The uploaded file exceeds the allowed size.',
    );
  }

  const extension = extensionOf(input.filename);
  if (!policy.allowedExtensions.includes(extension)) {
    throw new AgreementError(
      'AGREEMENT_EXTENSION_INVALID',
      'The uploaded file has a disallowed extension.',
    );
  }

  const verification = await verifier.verify({
    filename: input.filename,
    content: input.content,
  });
  if (!verification.valid) {
    throw new AgreementError(
      'AGREEMENT_SIGNATURE_INVALID',
      'The agreement signature is malformed or invalid.',
    );
  }

  const documentId = dependencies.newDocumentId();
  const storageReference = `${input.onboardingId}/${documentId}${extension}`;
  const digestSha256 = dependencies.digestSha256(input.content);

  await storage.write({
    reference: storageReference,
    content: input.content,
    contentType: policy.contentType,
  });

  const uploaded: UploadedAgreement = {
    documentId,
    onboardingId: input.onboardingId,
    signingStep: agreementSigningStep,
    signatureFormat: 'CAdES',
    digestSha256,
    storageReference,
  };

  const outcome = await practices.saveUploadedAgreement(uploaded);
  if (outcome === 'state-invalid') {
    // The invariant rejected the upload after the blob was written: remove the
    // orphan blob so a rejected request never leaves a stored document behind.
    await storage.remove(storageReference);
    throw new AgreementError(
      'PRACTICE_STATE_INVALID',
      'The practice is not in the REQUEST state.',
    );
  }

  return {
    documentId,
    status: 'PENDING',
    signingStep: agreementSigningStep,
  };
}
