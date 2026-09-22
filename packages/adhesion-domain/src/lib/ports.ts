/**
 * Ports (interfaces) owned by the domain and implemented by the API adapters.
 *
 * Keeping them here means the upload use case depends on behaviour, not on
 * Azure SDKs, Fastify, or PostgreSQL. Adapters live in `apps/adhesion-api` and
 * in `packages/adhesion-verification`.
 */

import type { AgreementDocument, Practice } from './practice.js';

export interface UploadedAgreement {
  readonly documentId: string;
  readonly onboardingId: string;
  readonly signingStep: number;
  readonly signatureFormat: 'CAdES';
  readonly digestSha256: string;
  readonly storageReference: string;
}

/**
 * Result of the atomic persistence of an upload.
 *
 * `state-invalid` means the practice was not in `REQUEST` anymore, or another
 * step-1 document already existed: the caller maps it to
 * `PRACTICE_STATE_INVALID` without having to re-read the practice.
 */
export type SaveUploadedAgreementOutcome = 'saved' | 'state-invalid';

export interface PracticeRepository {
  findPractice(onboardingId: string): Promise<Practice | null>;
  listDocuments(onboardingId: string): Promise<readonly AgreementDocument[]>;
  /**
   * Persists the document and moves the practice `REQUEST -> PENDING` in a
   * single atomic step, enforcing the step-1 invariant.
   */
  saveUploadedAgreement(
    uploaded: UploadedAgreement,
  ): Promise<SaveUploadedAgreementOutcome>;
  /** Readiness probe: resolves when the backing store is reachable. */
  check?(): Promise<void>;
}

export interface AgreementBlobWriter {
  write(input: {
    reference: string;
    content: Uint8Array;
    contentType: string;
  }): Promise<void>;
  remove(reference: string): Promise<void>;
  /** Optional bootstrap, e.g. creating the container in local environments. */
  initialize?(): Promise<void>;
  /** Readiness probe: resolves when the backing store is reachable. */
  check?(): Promise<void>;
}

export type SignatureVerificationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

export interface SignatureVerifier {
  verify(input: {
    filename: string;
    content: Uint8Array;
  }): Promise<SignatureVerificationResult>;
}

export interface AgreementPolicy {
  readonly allowedExtensions: readonly string[];
  readonly maxSizeBytes: number;
  readonly contentType: string;
}
