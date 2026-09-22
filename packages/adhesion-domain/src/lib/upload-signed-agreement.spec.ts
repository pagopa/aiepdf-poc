import { describe, expect, it } from 'vitest';

import { AgreementError } from './errors.js';
import { hasDocumentForSigningStep, type AgreementDocument, type Practice } from './practice.js';
import type {
  AgreementBlobWriter,
  AgreementPolicy,
  PracticeRepository,
  SaveUploadedAgreementOutcome,
  SignatureVerificationResult,
  SignatureVerifier,
  UploadedAgreement,
} from './ports.js';
import { uploadSignedAgreement } from './upload-signed-agreement.js';

const policy: AgreementPolicy = {
  allowedExtensions: ['.p7m'],
  maxSizeBytes: 10 * 1024 * 1024,
  contentType: 'application/pkcs7-mime',
};

class FakePracticeRepository implements PracticeRepository {
  practice: Practice | null = { onboardingId: 'practice-1', status: 'REQUEST' };
  documents: AgreementDocument[] = [];
  saved: UploadedAgreement[] = [];

  findPractice(onboardingId: string): Promise<Practice | null> {
    return Promise.resolve(
      this.practice && this.practice.onboardingId === onboardingId
        ? this.practice
        : null,
    );
  }

  listDocuments(): Promise<readonly AgreementDocument[]> {
    return Promise.resolve(this.documents);
  }

  saveUploadedAgreement(
    uploaded: UploadedAgreement,
  ): Promise<SaveUploadedAgreementOutcome> {
    if (!this.practice || this.practice.status !== 'REQUEST') {
      return Promise.resolve('state-invalid');
    }
    if (hasDocumentForSigningStep(this.documents, uploaded.signingStep)) {
      return Promise.resolve('state-invalid');
    }
    this.saved.push(uploaded);
    this.documents = [
      ...this.documents,
      { ...uploaded, createdAt: new Date(0).toISOString() },
    ];
    this.practice = { ...this.practice, status: 'PENDING' };
    return Promise.resolve('saved');
  }
}

class FakeStorage implements AgreementBlobWriter {
  written = new Map<string, Uint8Array>();
  removed: string[] = [];

  write(input: {
    reference: string;
    content: Uint8Array;
    contentType: string;
  }): Promise<void> {
    this.written.set(input.reference, input.content);
    return Promise.resolve();
  }

  remove(reference: string): Promise<void> {
    this.removed.push(reference);
    this.written.delete(reference);
    return Promise.resolve();
  }
}

class FakeVerifier implements SignatureVerifier {
  result: SignatureVerificationResult = { valid: true };

  verify(): Promise<SignatureVerificationResult> {
    return Promise.resolve(this.result);
  }
}

function buildDependencies() {
  const practices = new FakePracticeRepository();
  const storage = new FakeStorage();
  const verifier = new FakeVerifier();
  return {
    practices,
    storage,
    verifier,
    dependencies: {
      practices,
      storage,
      verifier,
      policy,
      digestSha256: () => 'a'.repeat(64),
      newDocumentId: () => 'document-1',
      now: () => new Date('2026-09-21T00:00:00.000Z'),
    },
  };
}

const validUpload = {
  onboardingId: 'practice-1',
  filename: 'agreement.p7m',
  content: new Uint8Array([1, 2, 3]),
};

describe('uploadSignedAgreement', () => {
  it('AC-01: moves the practice to PENDING and returns the document id', async () => {
    const { dependencies, practices, storage } = buildDependencies();

    const result = await uploadSignedAgreement(dependencies, validUpload);

    expect(result).toEqual({
      documentId: 'document-1',
      status: 'PENDING',
      signingStep: 1,
    });
    expect(practices.practice?.status).toBe('PENDING');
    expect(storage.written.size).toBe(1);
  });

  it('AC-02: rejects a disallowed extension without writing a blob', async () => {
    const { dependencies, storage } = buildDependencies();

    await expect(
      uploadSignedAgreement(dependencies, {
        ...validUpload,
        filename: 'agreement.pdf',
      }),
    ).rejects.toMatchObject({
      code: 'AGREEMENT_EXTENSION_INVALID',
      httpStatus: 400,
    } satisfies Partial<AgreementError>);
    expect(storage.written.size).toBe(0);
  });

  it('AC-02: rejects an invalid signature without writing a blob', async () => {
    const { dependencies, storage, verifier } = buildDependencies();
    verifier.result = { valid: false, reason: 'malformed' };

    await expect(
      uploadSignedAgreement(dependencies, validUpload),
    ).rejects.toMatchObject({ code: 'AGREEMENT_SIGNATURE_INVALID' });
    expect(storage.written.size).toBe(0);
  });

  it('AC-03: rejects a second step-1 upload once the practice is PENDING', async () => {
    const { dependencies, storage } = buildDependencies();

    await uploadSignedAgreement(dependencies, validUpload);

    await expect(
      uploadSignedAgreement(dependencies, validUpload),
    ).rejects.toMatchObject({
      code: 'PRACTICE_STATE_INVALID',
      httpStatus: 409,
    });
    // The state check rejects before any blob is written.
    expect(storage.written.size).toBe(1);
    expect(storage.removed).toHaveLength(0);
  });

  it('AC-03: rolls back the orphan blob when the invariant rejects a concurrent upload', async () => {
    const { dependencies, storage } = buildDependencies();
    // Simulate the race: the practice still looks REQUEST when read, but the
    // atomic persistence refuses the upload.
    const racingDependencies = {
      ...dependencies,
      practices: {
        findPractice: () =>
          Promise.resolve({ onboardingId: 'practice-1', status: 'REQUEST' as const }),
        listDocuments: () => Promise.resolve([]),
        saveUploadedAgreement: () => Promise.resolve('state-invalid' as const),
      },
    };

    await expect(
      uploadSignedAgreement(racingDependencies, validUpload),
    ).rejects.toMatchObject({ code: 'PRACTICE_STATE_INVALID' });
    expect(storage.removed).toHaveLength(1);
    expect(storage.written.size).toBe(0);
  });

  it('rejects an oversized file before any other check', async () => {
    const { dependencies, storage } = buildDependencies();

    await expect(
      uploadSignedAgreement(dependencies, {
        ...validUpload,
        content: new Uint8Array(policy.maxSizeBytes + 1),
      }),
    ).rejects.toMatchObject({ code: 'AGREEMENT_FILE_TOO_LARGE' });
    expect(storage.written.size).toBe(0);
  });

  it('rejects a missing practice with 404', async () => {
    const { dependencies, practices } = buildDependencies();
    practices.practice = null;

    await expect(
      uploadSignedAgreement(dependencies, validUpload),
    ).rejects.toMatchObject({
      code: 'PRACTICE_NOT_FOUND',
      httpStatus: 404,
    });
  });
});
