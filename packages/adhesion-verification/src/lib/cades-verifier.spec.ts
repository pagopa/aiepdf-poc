import { describe, expect, it } from 'vitest';

import { createCadesVerifier } from './cades-verifier.js';

describe('createCadesVerifier', () => {
  it('rejects content that is not a DER-encoded CMS structure', async () => {
    const verifier = createCadesVerifier();

    const result = await verifier.verify({
      filename: 'agreement.p7m',
      content: new TextEncoder().encode('not a signed document'),
    });

    expect(result.valid).toBe(false);
  });

  it('rejects an empty file', async () => {
    const verifier = createCadesVerifier();

    const result = await verifier.verify({
      filename: 'agreement.p7m',
      content: new Uint8Array(),
    });

    expect(result.valid).toBe(false);
  });
});
