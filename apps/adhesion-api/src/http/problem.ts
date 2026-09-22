/**
 * RFC 9457 problem projection of the typed adhesion errors.
 *
 * The mapping code -> HTTP status lives on the domain error; this module only
 * adds the human-readable `title` and the URI `type`, keeping the HTTP layer
 * free of business decisions and free of PII.
 */

import { buildProblem, type ProblemDetail } from '@aiepdf/adhesion-contracts';
import { AgreementError } from '@aiepdf/adhesion-domain';
import type { AgreementErrorCode } from '@aiepdf/adhesion-domain';

const titlesByCode: Record<AgreementErrorCode, string> = {
  AGREEMENT_EXTENSION_INVALID: 'Agreement extension invalid',
  AGREEMENT_SIGNATURE_INVALID: 'Agreement signature invalid',
  AGREEMENT_FILE_TOO_LARGE: 'Agreement file too large',
  PRACTICE_STATE_INVALID: 'Practice state invalid',
  PRACTICE_NOT_FOUND: 'Practice not found',
  UPLOAD_DISABLED: 'Upload disabled',
};

export function toProblemBody(error: AgreementError): ProblemDetail {
  return buildProblem({
    errorCode: error.code,
    status: error.httpStatus,
    title: titlesByCode[error.code],
    detail: error.message,
  });
}

export function internalErrorProblem(): ProblemDetail {
  return buildProblem({
    errorCode: 'INTERNAL_ERROR',
    status: 500,
    title: 'Internal error',
    detail: 'An unexpected error occurred.',
  });
}
