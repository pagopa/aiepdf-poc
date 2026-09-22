/**
 * In-memory adapter for the Practice/Document persistence port.
 *
 * Used by the local demo and by the HTTP tests. It keeps the same invariants as
 * the PostgreSQL adapter but without I/O: the check and the transition happen
 * in one synchronous block, which is atomic in a single-threaded runtime.
 */

import {
  hasDocumentForSigningStep,
  type AgreementDocument,
  type Practice,
  type PracticeRepository,
  type SaveUploadedAgreementOutcome,
  type UploadedAgreement,
} from '@aiepdf/adhesion-domain';

export interface InMemoryPracticeSeed {
  readonly practices?: readonly Practice[];
  readonly documents?: readonly AgreementDocument[];
}

export function createInMemoryPracticeRepository(
  seed: InMemoryPracticeSeed = {},
  now: () => Date = () => new Date(),
): PracticeRepository {
  const practices = new Map<string, Practice>(
    (seed.practices ?? []).map((practice) => [practice.onboardingId, practice]),
  );
  const documents = new Map<string, AgreementDocument[]>(
    (seed.documents ?? []).reduce<Array<[string, AgreementDocument[]]>>(
      (accumulator, document) => {
        const existing = accumulator.find(
          ([onboardingId]) => onboardingId === document.onboardingId,
        );
        if (existing) {
          existing[1].push(document);
        } else {
          accumulator.push([document.onboardingId, [document]]);
        }
        return accumulator;
      },
      [],
    ),
  );

  return {
    findPractice: (onboardingId) =>
      Promise.resolve(practices.get(onboardingId) ?? null),

    listDocuments: (onboardingId) =>
      Promise.resolve(documents.get(onboardingId) ?? []),

    check: () => Promise.resolve(),

    saveUploadedAgreement: (
      uploaded: UploadedAgreement,
    ): Promise<SaveUploadedAgreementOutcome> => {
      const practice = practices.get(uploaded.onboardingId);
      const existing = documents.get(uploaded.onboardingId) ?? [];
      if (
        !practice ||
        practice.status !== 'REQUEST' ||
        hasDocumentForSigningStep(existing, uploaded.signingStep)
      ) {
        return Promise.resolve('state-invalid');
      }

      documents.set(uploaded.onboardingId, [
        ...existing,
        { ...uploaded, createdAt: now().toISOString() },
      ]);
      practices.set(uploaded.onboardingId, {
        ...practice,
        status: 'PENDING',
      });
      return Promise.resolve('saved');
    },
  };
}
