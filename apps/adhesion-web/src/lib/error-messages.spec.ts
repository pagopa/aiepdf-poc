import { describe, expect, it } from 'vitest';

import { ApiError } from './adhesion-api';
import { errorCodeSchema } from './adhesion-contract';
import { describeError } from './error-messages';

// Derived from the contract, not hand-listed: adding a code to the contract
// source makes this suite fail until the UI gives it a message.
const knownErrorCodes = errorCodeSchema.options;

describe('describeError', () => {
  it.each(knownErrorCodes)(
    'gives %s a specific explanatory message',
    (code) => {
      const presentation = describeError(new ApiError('internal detail', 400, code));

      expect(presentation.title.length).toBeGreaterThan(0);
      expect(presentation.message.length).toBeGreaterThan(30);
      // No raw HTTP/status or code leaking for known codes.
      expect(presentation.message).not.toMatch(/HTTP \d/);
      expect(presentation.message).not.toContain('codice:');
      // The internal API detail is never shown.
      expect(presentation.message).not.toContain('internal detail');
    },
  );

  it('uses a distinct message per known error code', () => {
    const messages = knownErrorCodes.map(
      (code) => describeError(new ApiError('detail', 400, code)).message,
    );
    expect(new Set(messages).size).toBe(knownErrorCodes.length);
  });

  it('explains PRACTICE_NOT_FOUND explicitly', () => {
    const presentation = describeError(
      new ApiError('The practice does not exist.', 404, 'PRACTICE_NOT_FOUND'),
    );

    expect(presentation.message).toMatch(/non esiste/i);
  });

  it('falls back to the HTTP status for an unknown error code', () => {
    const presentation = describeError(
      new ApiError('unexpected', 409, 'SOME_NEW_CODE'),
    );

    expect(presentation.message).toMatch(/stato attuale della pratica/i);
    expect(presentation.message).toContain('SOME_NEW_CODE');
  });

  it('falls back to the HTTP status when no code is present', () => {
    const presentation = describeError(new ApiError('boom', 503, undefined));

    expect(presentation.message).toMatch(/non è disponibile/i);
  });

  it('never shows a bare error for an unmapped status', () => {
    const presentation = describeError(new ApiError('teapot', 418, undefined));

    expect(presentation.message).toContain('HTTP 418');
    expect(presentation.message.length).toBeGreaterThan(30);
  });

  it('reports a network failure as an unreachable service', () => {
    const presentation = describeError(new TypeError('Failed to fetch'));

    expect(presentation.title).toMatch(/non raggiungibile/i);
    expect(presentation.message).toMatch(/connessione/i);
  });

  it('reports any other unexpected error safely', () => {
    const presentation = describeError(new Error('internal boom'));

    expect(presentation.title).toMatch(/imprevisto/i);
    expect(presentation.message).not.toContain('internal boom');
  });
});
