/**
 * PostgreSQL adapter for the Practice/Document persistence port.
 *
 * `saveUploadedAgreement` runs in a single transaction and locks the Practice
 * row, so two concurrent step-1 uploads cannot both succeed (UC-01 A1,
 * `AC-03`). The unique constraint on `(onboarding_id, signing_step)` is the
 * database-level backstop for the same invariant.
 *
 * The schema is documented by `contracts.item-002`; migrations live with the
 * deployment. Passwords are never read here: authentication uses the Managed
 * Identity through the platform-provided connection string.
 */

import { hasDocumentForSigningStep } from '@aiepdf/adhesion-domain';
import type {
  AgreementDocument,
  Practice,
  PracticeRepository,
  SaveUploadedAgreementOutcome,
  UploadedAgreement,
} from '@aiepdf/adhesion-domain';
import type { Pool } from 'pg';

interface PracticeRow {
  onboarding_id: string;
  status: string;
}

interface DocumentRow {
  document_id: string;
  onboarding_id: string;
  signing_step: number;
  signature_format: string;
  digest_sha256: string;
  storage_reference: string;
  created_at: Date;
}

function toDocument(row: DocumentRow): AgreementDocument {
  return {
    documentId: row.document_id,
    onboardingId: row.onboarding_id,
    signingStep: row.signing_step,
    signatureFormat: row.signature_format as 'CAdES',
    digestSha256: row.digest_sha256,
    storageReference: row.storage_reference,
    createdAt: row.created_at.toISOString(),
  };
}

export function createPostgresPracticeRepository(
  pool: Pool,
): PracticeRepository {
  return {
    check: async () => {
      await pool.query('select 1');
    },

    async findPractice(onboardingId: string): Promise<Practice | null> {
      const result = await pool.query<PracticeRow>(
        'select onboarding_id, status from practices where onboarding_id = $1',
        [onboardingId],
      );
      const row = result.rows[0];
      return row
        ? { onboardingId: row.onboarding_id, status: row.status as Practice['status'] }
        : null;
    },

    async listDocuments(
      onboardingId: string,
    ): Promise<readonly AgreementDocument[]> {
      const result = await pool.query<DocumentRow>(
        'select * from documents where onboarding_id = $1 order by signing_step',
        [onboardingId],
      );
      return result.rows.map(toDocument);
    },

    async saveUploadedAgreement(
      uploaded: UploadedAgreement,
    ): Promise<SaveUploadedAgreementOutcome> {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const practice = await client.query<PracticeRow>(
          'select onboarding_id, status from practices where onboarding_id = $1 for update',
          [uploaded.onboardingId],
        );
        const row = practice.rows[0];
        if (!row || row.status !== 'REQUEST') {
          await client.query('rollback');
          return 'state-invalid';
        }

        const existing = await client.query<DocumentRow>(
          'select * from documents where onboarding_id = $1',
          [uploaded.onboardingId],
        );
        if (
          hasDocumentForSigningStep(
            existing.rows.map(toDocument),
            uploaded.signingStep,
          )
        ) {
          await client.query('rollback');
          return 'state-invalid';
        }

        await client.query(
          `insert into documents
             (document_id, onboarding_id, signing_step, signature_format, digest_sha256, storage_reference)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            uploaded.documentId,
            uploaded.onboardingId,
            uploaded.signingStep,
            uploaded.signatureFormat,
            uploaded.digestSha256,
            uploaded.storageReference,
          ],
        );
        await client.query(
          'update practices set status = $1 where onboarding_id = $2',
          ['PENDING', uploaded.onboardingId],
        );
        await client.query('commit');
        return 'saved';
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
