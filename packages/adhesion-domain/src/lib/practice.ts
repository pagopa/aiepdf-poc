/**
 * Practice and Document domain model (`UC-01`, DR `Domain model and glossary`).
 *
 * The pilot models a single transition, `REQUEST -> PENDING`, and only accepts
 * a step-1 agreement. The invariants below are enforced by the repository
 * adapter that persists them, not by mutable objects, so that a concurrent
 * upload cannot create two valid documents for the same signing step.
 */

export const practiceStatuses = ['REQUEST', 'PENDING'] as const;

export type PracticeStatus = (typeof practiceStatuses)[number];

export const agreementSigningStep = 1;

export interface Practice {
  readonly onboardingId: string;
  readonly status: PracticeStatus;
}

export interface AgreementDocument {
  readonly documentId: string;
  readonly onboardingId: string;
  readonly signingStep: number;
  readonly signatureFormat: 'CAdES';
  readonly digestSha256: string;
  readonly storageReference: string;
  readonly createdAt: string;
}

/**
 * Invariant: at most one valid document per signing step per practice.
 * The pilot only produces step 1, but the check is written for any step.
 */
export function hasDocumentForSigningStep(
  documents: readonly AgreementDocument[],
  signingStep: number,
): boolean {
  return documents.some(
    (document) =>
      document.signingStep === signingStep && document.digestSha256.length > 0,
  );
}
