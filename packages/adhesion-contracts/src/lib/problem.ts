/**
 * RFC 9457 problem detail shared by the adhesion API contract
 * (`contracts.item-001`) and the HTTP layer.
 *
 * The `errorCode` is the stable semantic identifier owned by the Use Case;
 * `type` is its dereferenceable URI form. No PII may ever be placed in
 * `detail` (NFR-04).
 */

export interface ProblemDetail {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errorCode: string;
}

const errorTypeBaseUri = 'https://errors.ced.pagopa.it';

function kebabCase(code: string): string {
  return code.toLowerCase().replace(/_/g, '-');
}

export function errorTypeFor(errorCode: string): string {
  return `${errorTypeBaseUri}/${kebabCase(errorCode)}`;
}

export function buildProblem(input: {
  errorCode: string;
  status: number;
  title: string;
  detail: string;
}): ProblemDetail {
  return {
    type: errorTypeFor(input.errorCode),
    title: input.title,
    status: input.status,
    detail: input.detail,
    errorCode: input.errorCode,
  };
}
