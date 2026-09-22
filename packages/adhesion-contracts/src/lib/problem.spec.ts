import { describe, expect, it } from 'vitest';

import { buildProblem, errorTypeFor } from './problem.js';

describe('problem detail', () => {
  it('builds the dereferenceable type URI from the semantic code', () => {
    expect(errorTypeFor('AGREEMENT_FILE_TOO_LARGE')).toBe(
      'https://errors.ced.pagopa.it/agreement-file-too-large',
    );
  });

  it('keeps the semantic error code on the problem body', () => {
    expect(
      buildProblem({
        errorCode: 'PRACTICE_STATE_INVALID',
        status: 409,
        title: 'Practice state invalid',
        detail: 'The practice is not in the REQUEST state.',
      }),
    ).toEqual({
      type: 'https://errors.ced.pagopa.it/practice-state-invalid',
      title: 'Practice state invalid',
      status: 409,
      detail: 'The practice is not in the REQUEST state.',
      errorCode: 'PRACTICE_STATE_INVALID',
    });
  });
});
