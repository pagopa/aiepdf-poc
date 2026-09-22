/**
 * Typed errors for the adhesion agreement flow.
 *
 * Every error carries a stable semantic identifier (`UPPER_SNAKE_CASE`) that is
 * part of the API contract (`contracts.item-001`) and is owned by the Use Case,
 * not by this module. The HTTP status mapping is the transport projection of
 * the same identifier and must stay in sync with `openapi.yaml`.
 */

export const agreementErrorCodes = [
  'AGREEMENT_EXTENSION_INVALID',
  'AGREEMENT_SIGNATURE_INVALID',
  'AGREEMENT_FILE_TOO_LARGE',
  'PRACTICE_STATE_INVALID',
  'PRACTICE_NOT_FOUND',
  'UPLOAD_DISABLED',
] as const;

export type AgreementErrorCode = (typeof agreementErrorCodes)[number];

const httpStatusByCode: Record<AgreementErrorCode, number> = {
  AGREEMENT_EXTENSION_INVALID: 400,
  AGREEMENT_SIGNATURE_INVALID: 400,
  AGREEMENT_FILE_TOO_LARGE: 400,
  PRACTICE_STATE_INVALID: 409,
  PRACTICE_NOT_FOUND: 404,
  UPLOAD_DISABLED: 503,
};

/**
 * A business failure of the adhesion flow that is safe to expose to the caller.
 *
 * `message` becomes the RFC 9457 `detail` and must never contain PII (NFR-04):
 * callers are expected to pass a constant explanation, not file content or
 * identifiers taken from the user.
 */
export class AgreementError extends Error {
  readonly code: AgreementErrorCode;
  readonly httpStatus: number;

  constructor(code: AgreementErrorCode, detail: string) {
    super(detail);
    this.name = 'AgreementError';
    this.code = code;
    this.httpStatus = httpStatusByCode[code];
  }
}
